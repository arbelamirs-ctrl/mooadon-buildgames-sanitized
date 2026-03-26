import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * wooWebhook
 * ─────────────────────────────────────────────────────────────────────────────
 * Receives WooCommerce webhook events (order.paid, order.updated, refund.created)
 * Auth: HMAC-SHA256 via X-WC-Webhook-Signature header (base64)
 * Setup: IntegrationConnection must exist with source='woocommerce' + webhook_secret
 *
 * WooCommerce webhook payload includes: company_id in delivery URL as ?company_id=xxx
 * URL: /functions/wooWebhook?company_id=COMPANY_ID
 * ─────────────────────────────────────────────────────────────────────────────
 */

Deno.serve(async (req) => {
  const startTime = Date.now();

  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const url       = new URL(req.url);
  const companyId = url.searchParams.get('company_id') || '';

  if (!companyId) {
    return Response.json({ error: 'Missing company_id in URL params' }, { status: 400 });
  }

  const bodyText = await req.text();
  let body: any = {};
  try { body = JSON.parse(bodyText); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ── WooCommerce headers ──────────────────────────────────────────────────
  const wcSignature = req.headers.get('x-wc-webhook-signature') || '';
  const wcTopic     = req.headers.get('x-wc-webhook-topic') || '';
  const wcEventId   = req.headers.get('x-wc-webhook-id') || '';
  const wcDelivery  = req.headers.get('x-wc-webhook-delivery-id') || '';
  const wcSource    = req.headers.get('x-wc-webhook-source') || '';

  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole;

  try {
    // ── 1. Load IntegrationConnection ────────────────────────────────────
    const connections = await db.entities.IntegrationConnection.filter({
      company_id: companyId,
      source: 'woocommerce',
      status: 'connected'
    });

    if (connections.length === 0) {
      return Response.json({ error: 'WooCommerce not connected for this company' }, { status: 401 });
    }

    const conn = connections[0];

    // ── 2. Verify HMAC-SHA256 signature ──────────────────────────────────
    if (!wcSignature) {
      await logEvent(db, companyId, wcSource, wcTopic, 'signature_missing', body, null);
      return Response.json({ error: 'Missing X-WC-Webhook-Signature' }, { status: 401 });
    }

    const isValid = await verifyWooHmac(bodyText, wcSignature, conn.webhook_secret);
    if (!isValid) {
      await logEvent(db, companyId, wcSource, wcTopic, 'signature_invalid', body, null);
      return Response.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    // ── 3. Idempotency ───────────────────────────────────────────────────
    const orderId  = String(body.id || '');
    const idempKey = `woo:${companyId}:${wcTopic}:${wcDelivery || wcEventId || orderId}`;

    const existing = await db.entities.IntegrationEventLog.filter({
      idempotency_key: idempKey,
      company_id: companyId
    });
    if (existing.length > 0) {
      return Response.json({ ok: true, duplicate: true });
    }

    // ── 4. Filter relevant topics ────────────────────────────────────────
    const processableTopics = ['order.created', 'order.updated', 'order.paid', 'order.completed'];
    const refundTopics      = ['order.refunded'];

    if (!processableTopics.includes(wcTopic) && !refundTopics.includes(wcTopic)) {
      await logEvent(db, companyId, wcSource, wcTopic, 'skipped_topic', body, idempKey);
      return Response.json({ ok: true, skipped: `topic ${wcTopic} not processed` });
    }

    // For order.updated — only process if status is completed/processing
    if (wcTopic === 'order.updated') {
      const status = body.status || '';
      if (!['completed', 'processing'].includes(status)) {
        return Response.json({ ok: true, skipped: `order status ${status} not eligible` });
      }
    }

    // ── 5. Normalize ─────────────────────────────────────────────────────
    const normalized = normalizeWooOrder(body, wcSource, wcTopic);

    if (!normalized.customer_phone && !normalized.customer_email) {
      await logEvent(db, companyId, wcSource, wcTopic, 'no_customer_id', body, idempKey);
      return Response.json({ ok: true, skipped: 'no customer identifier' });
    }

    // ── 6. Find or create client ─────────────────────────────────────────
    let client = null;
    if (normalized.customer_phone) {
      const found = await db.entities.Client.filter({ company_id: companyId, phone: normalized.customer_phone });
      client = found[0] || null;
    }
    if (!client && normalized.customer_email) {
      const found = await db.entities.Client.filter({ company_id: companyId, email: normalized.customer_email });
      client = found[0] || null;
    }
    if (!client) {
      client = await db.entities.Client.create({
        company_id: companyId,
        phone: normalized.customer_phone || null,
        email: normalized.customer_email || null,
        full_name: normalized.customer_name || null,
        current_balance: 0,
        total_earned: 0,
        total_redeemed: 0
      });
    }

    // ── 7. Trigger reward ────────────────────────────────────────────────
    let rewardResult = null;
    if (processableTopics.includes(wcTopic)) {
      rewardResult = await db.asServiceRole.functions.invoke('createPOSTransaction', {
        company_id: companyId,
        phone: client.phone || normalized.customer_phone,
        amount: normalized.total_amount,
        order_id: normalized.external_order_id,
        currency: normalized.currency,
        reward_type: 'token',
        source: 'woocommerce',
        items: normalized.line_items
      });
    }

    // ── 8. Update connection stats ────────────────────────────────────────
    await db.entities.IntegrationConnection.update(conn.id, {
      last_event_at: new Date().toISOString(),
      last_event_type: wcTopic,
      total_events: (conn.total_events || 0) + 1
    });

    // ── 9. Log event ─────────────────────────────────────────────────────
    await logEvent(db, companyId, wcSource, wcTopic, 'processed', body, idempKey);

    const duration = Date.now() - startTime;
    console.log(`[wooWebhook] ✅ ${wcTopic} for company ${companyId} processed in ${duration}ms`);

    return Response.json({
      ok: true,
      topic: wcTopic,
      order_id: normalized.external_order_id,
      client_id: client.id,
      reward: rewardResult
    });

  } catch (error) {
    console.error('[wooWebhook] Error:', error.message);
    try {
      await db.entities.WebhookRetryQueue.create({
        company_id: companyId,
        endpoint: 'wooWebhook',
        payload: body,
        error: error.message,
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
        next_retry_at: new Date(Date.now() + 60_000).toISOString(),
        created_at: new Date().toISOString()
      });
    } catch (_) {}
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function verifyWooHmac(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const computed  = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
    return computed === signature;
  } catch { return false; }
}

function normalizeWooOrder(body: any, storeUrl: string, topic: string) {
  const billing  = body.billing || {};
  const shipping = body.shipping || {};
  const phone    = normalizePhone(billing.phone || shipping.phone || '');
  const email    = (billing.email || body.customer?.email || '').toLowerCase().trim();

  return {
    source: 'woocommerce',
    external_order_id: String(body.id || body.number || ''),
    event_type: topic,
    store_url: storeUrl,
    total_amount: parseFloat(body.total || '0'),
    currency: (body.currency || 'ILS').toUpperCase(),
    customer_phone: phone || null,
    customer_email: email || null,
    customer_name: [billing.first_name, billing.last_name].filter(Boolean).join(' ') || null,
    payment_status: body.payment_method || body.payment_method_title || null,
    fulfillment_status: body.status || null,
    line_items: (body.line_items || []).map((i: any) => ({
      sku: i.sku || String(i.product_id),
      name: i.name,
      qty: i.quantity || 1,
      unit_price: parseFloat(i.price || '0'),
      total: parseFloat(i.total || '0')
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

async function logEvent(db: any, companyId: string, storeUrl: string, topic: string, status: string, payload: any, idempKey: string | null) {
  try {
    await db.entities.IntegrationEventLog.create({
      company_id: companyId,
      source: 'woocommerce',
      shop_domain: storeUrl,
      event_type: topic,
      status,
      payload,
      idempotency_key: idempKey,
      created_at: new Date().toISOString()
    });
  } catch (_) {}
}