import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * shopifyWebhook
 * ─────────────────────────────────────────────────────────────────────────────
 * Receives Shopify webhook events (orders/paid, refunds/create, app/uninstalled)
 * Verifies HMAC-SHA256 signature, deduplicates, normalizes, and triggers rewards.
 */

Deno.serve(async (req) => {
  const startTime = Date.now();

  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const bodyText = await req.text();
  let body: any = {};
  try { body = JSON.parse(bodyText); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const shopifyHmac = req.headers.get('x-shopify-hmac-sha256') || '';
  const shopDomain = req.headers.get('x-shopify-shop-domain') || '';
  const shopifyTopic = req.headers.get('x-shopify-topic') || '';
  const shopifyEventId = req.headers.get('x-shopify-webhook-id') || '';

  if (!shopDomain) {
    return Response.json({ error: 'Missing X-Shopify-Shop-Domain header' }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole;

  try {
    // Load IntegrationConnection for this shop
    const connections = await db.entities.IntegrationConnection.filter({
      source: 'shopify',
      shop_domain: shopDomain,
      status: 'connected'
    });

    if (connections.length === 0) {
      console.warn(`[shopifyWebhook] No active connection for shop: ${shopDomain}`);
      return Response.json({ error: 'Shop not connected' }, { status: 401 });
    }

    const conn = connections[0];
    const companyId = conn.company_id;

    // Verify HMAC-SHA256 signature
    if (!shopifyHmac) {
      await logEvent(db, companyId, shopDomain, shopifyTopic, 'signature_missing', body, null);
      return Response.json({ error: 'Missing HMAC' }, { status: 401 });
    }

    const isValid = await verifyShopifyHmac(bodyText, shopifyHmac, conn.webhook_secret);
    if (!isValid) {
      await logEvent(db, companyId, shopDomain, shopifyTopic, 'signature_invalid', body, null);
      return Response.json({ error: 'Invalid HMAC' }, { status: 401 });
    }

    // Idempotency check
    const orderId = String(body.id || '');
    const idempKey = `shopify:${shopDomain}:${shopifyTopic}:${shopifyEventId || orderId}`;

    const existing = await db.entities.IntegrationEventLog.filter({
      idempotency_key: idempKey,
      company_id: companyId
    });
    if (existing.length > 0) {
      console.log(`[shopifyWebhook] Duplicate event — skipping: ${idempKey}`);
      return Response.json({ ok: true, duplicate: true });
    }

    // Handle app/uninstalled
    if (shopifyTopic === 'app/uninstalled') {
      await db.entities.IntegrationConnection.update(conn.id, {
        status: 'disconnected',
        disconnected_at: new Date().toISOString(),
        disconnect_reason: 'app_uninstalled'
      });
      await logEvent(db, companyId, shopDomain, shopifyTopic, 'processed', body, idempKey);
      return Response.json({ ok: true, action: 'disconnected' });
    }

    // Normalize order
    const normalized = normalizeShopifyOrder(body, shopDomain, shopifyTopic);

    // Find or create Client
    const customerPhone = normalized.customer_phone;
    const customerEmail = normalized.customer_email;

    if (!customerPhone && !customerEmail) {
      await logEvent(db, companyId, shopDomain, shopifyTopic, 'no_customer_id', body, idempKey);
      return Response.json({ ok: true, skipped: 'no customer identifier' });
    }

    let client = null;
    if (customerPhone) {
      const found = await db.entities.Client.filter({ company_id: companyId, phone: customerPhone });
      client = found[0] || null;
    }
    if (!client && customerEmail) {
      const found = await db.entities.Client.filter({ company_id: companyId, email: customerEmail });
      client = found[0] || null;
    }

    if (!client) {
      client = await db.entities.Client.create({
        company_id: companyId,
        phone: customerPhone || null,
        email: customerEmail || null,
        full_name: normalized.customer_name || null,
        current_balance: 0,
        total_earned: 0,
        total_redeemed: 0
      });
    }

    // Process reward for paid orders
    let rewardResult = null;
    if (shopifyTopic === 'orders/paid' || shopifyTopic === 'orders/created') {
      rewardResult = await db.asServiceRole.functions.invoke('createPOSTransaction', {
        company_id: companyId,
        phone: client.phone || customerPhone,
        amount: normalized.total_amount,
        order_id: normalized.external_order_id,
        currency: normalized.currency,
        reward_type: 'token',
        source: 'shopify',
        items: normalized.line_items
      });
    }

    // Update connection
    await db.entities.IntegrationConnection.update(conn.id, {
      last_event_at: new Date().toISOString(),
      last_event_type: shopifyTopic,
      total_events: (conn.total_events || 0) + 1
    });

    // Log event
    await logEvent(db, companyId, shopDomain, shopifyTopic, 'processed', body, idempKey);

    const duration = Date.now() - startTime;
    console.log(`[shopifyWebhook] ✅ ${shopifyTopic} processed in ${duration}ms`);

    return Response.json({
      ok: true,
      topic: shopifyTopic,
      order_id: normalized.external_order_id,
      client_id: client.id,
      reward: rewardResult
    });

  } catch (error) {
    console.error('[shopifyWebhook] Error:', error.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

async function verifyShopifyHmac(body: string, shopifyHmac: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const computed = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
    return computed === shopifyHmac;
  } catch { return false; }
}

function normalizeShopifyOrder(body: any, shopDomain: string, topic: string) {
  const customer = body.customer || {};
  const address = body.billing_address || body.shipping_address || {};
  const phone = normalizePhone(customer.phone || address.phone || body.phone || '');
  const email = (customer.email || body.email || '').toLowerCase().trim();

  return {
    source: 'shopify',
    external_order_id: String(body.id || ''),
    event_type: topic,
    shop_domain: shopDomain,
    total_amount: parseFloat(body.total_price || body.subtotal_price || '0'),
    currency: (body.currency || 'USD').toUpperCase(),
    customer_phone: phone || null,
    customer_email: email || null,
    customer_name: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || address.name || null,
    line_items: (body.line_items || []).map((i: any) => ({
      sku: i.sku || i.id,
      name: i.name || i.title,
      qty: i.quantity || 1,
      unit_price: parseFloat(i.price || '0')
    }))
  };
}

function normalizePhone(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return '+972' + digits.slice(1);
  if (digits.length > 10) return '+' + digits;
  return digits;
}

async function logEvent(db: any, companyId: string, shopDomain: string, topic: string, status: string, payload: any, idempKey: string | null) {
  try {
    await db.entities.IntegrationEventLog.create({
      company_id: companyId,
      source: 'shopify',
      shop_domain: shopDomain,
      event_type: topic,
      status,
      payload,
      idempotency_key: idempKey,
      created_at: new Date().toISOString()
    });
  } catch (_) {}
}