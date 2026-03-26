import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * wooConnect
 * ─────────────────────────────────────────────────────────────────────────────
 * WooCommerce connection management (no OAuth — uses Consumer Key/Secret)
 *   POST { action: 'connect', company_id, store_url, consumer_key, consumer_secret }
 *   POST { action: 'test', company_id }
 *   POST { action: 'install_webhooks', company_id }
 *   POST { action: 'disconnect', company_id }
 * ─────────────────────────────────────────────────────────────────────────────
 */

const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://mooadon.base44.app';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole;

  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, company_id, store_url, consumer_key, consumer_secret } = body;

  if (!company_id) return Response.json({ error: 'Missing company_id' }, { status: 400 });

  // ── CONNECT ───────────────────────────────────────────────────────────────
  if (action === 'connect') {
    if (!store_url || !consumer_key || !consumer_secret) {
      return Response.json({ error: 'Missing store_url, consumer_key, or consumer_secret' }, { status: 400 });
    }

    const cleanUrl = store_url.replace(/\/$/, '');

    // Test credentials first
    const testRes = await fetch(`${cleanUrl}/wp-json/wc/v3/orders?per_page=1`, {
      headers: {
        'Authorization': 'Basic ' + btoa(`${consumer_key}:${consumer_secret}`)
      }
    });

    if (!testRes.ok) {
      return Response.json({
        error: `Cannot connect to WooCommerce store. Status: ${testRes.status}. Check URL and API keys.`,
        http_status: testRes.status
      }, { status: 400 });
    }

    // Generate webhook secret
    const webhookSecret = crypto.randomUUID().replace(/-/g, '');

    // Upsert IntegrationConnection
    const existing = await db.entities.IntegrationConnection.filter({
      company_id,
      source: 'woocommerce'
    });

    let conn;
    if (existing.length > 0) {
      conn = await db.entities.IntegrationConnection.update(existing[0].id, {
        store_url: cleanUrl,
        consumer_key,
        consumer_secret,
        webhook_secret: webhookSecret,
        status: 'connected',
        connected_at: new Date().toISOString(),
        last_error: null,
        test_passed_at: new Date().toISOString()
      });
      conn = { ...existing[0], ...conn };
    } else {
      conn = await db.entities.IntegrationConnection.create({
        company_id,
        source: 'woocommerce',
        store_url: cleanUrl,
        consumer_key,
        consumer_secret,
        webhook_secret: webhookSecret,
        status: 'connected',
        connected_at: new Date().toISOString(),
        test_passed_at: new Date().toISOString()
      });
    }

    // Auto-install webhooks via Woo REST API
    const webhookResults = await installWooWebhooks(cleanUrl, consumer_key, consumer_secret, company_id, webhookSecret);

    await db.entities.IntegrationConnection.update(conn.id, {
      webhooks_installed: webhookResults.success.length > 0,
      webhooks_failed: webhookResults.failed,
      webhooks_installed_at: new Date().toISOString()
    });

    await db.entities.AuditLog.create({
      company_id,
      action: 'woocommerce_connected',
      entity_type: 'IntegrationConnection',
      entity_id: conn.id,
      performed_by: user.email,
      details: { store_url: cleanUrl, webhooks: webhookResults }
    }).catch(() => {});

    return Response.json({
      ok: true,
      connection_id: conn.id,
      store_url: cleanUrl,
      webhook_secret: webhookSecret,
      webhook_url: `${APP_BASE_URL}/functions/wooWebhook?company_id=${company_id}`,
      webhooks_installed: webhookResults.success,
      webhooks_failed: webhookResults.failed
    });
  }

  // ── TEST ──────────────────────────────────────────────────────────────────
  if (action === 'test') {
    const conn = await getConn(db, company_id, 'woocommerce');
    if (!conn) return Response.json({ error: 'No WooCommerce connection found' }, { status: 404 });

    try {
      const res = await fetch(`${conn.store_url}/wp-json/wc/v3/orders?per_page=1`, {
        headers: { 'Authorization': 'Basic ' + btoa(`${conn.consumer_key}:${conn.consumer_secret}`) }
      });
      if (!res.ok) throw new Error(`Woo API returned ${res.status}`);

      await db.entities.IntegrationConnection.update(conn.id, {
        test_passed_at: new Date().toISOString(),
        last_error: null
      });
      return Response.json({ ok: true, store: conn.store_url });
    } catch (e) {
      await db.entities.IntegrationConnection.update(conn.id, { last_error: e.message });
      return Response.json({ ok: false, error: e.message }, { status: 502 });
    }
  }

  // ── INSTALL WEBHOOKS (manual re-install) ─────────────────────────────────
  if (action === 'install_webhooks') {
    const conn = await getConn(db, company_id, 'woocommerce');
    if (!conn) return Response.json({ error: 'No WooCommerce connection found' }, { status: 404 });

    const results = await installWooWebhooks(conn.store_url, conn.consumer_key, conn.consumer_secret, company_id, conn.webhook_secret);
    await db.entities.IntegrationConnection.update(conn.id, {
      webhooks_installed: results.success.length > 0,
      webhooks_failed: results.failed,
      webhooks_installed_at: new Date().toISOString()
    });
    return Response.json({ ok: true, ...results });
  }

  // ── DISCONNECT ────────────────────────────────────────────────────────────
  if (action === 'disconnect') {
    const conn = await getConn(db, company_id, 'woocommerce');
    if (!conn) return Response.json({ error: 'No WooCommerce connection found' }, { status: 404 });

    await db.entities.IntegrationConnection.update(conn.id, {
      status: 'disconnected',
      disconnected_at: new Date().toISOString(),
      consumer_key: null,
      consumer_secret: null
    });
    return Response.json({ ok: true, disconnected: true });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function installWooWebhooks(storeUrl: string, ck: string, cs: string, companyId: string, secret: string) {
  const topics  = ['order.paid', 'order.updated', 'order.refunded'];
  const endpoint = `${Deno.env.get('APP_BASE_URL') || 'https://mooadon.base44.app'}/functions/wooWebhook?company_id=${companyId}`;
  const success: string[] = [];
  const failed: string[] = [];

  for (const topic of topics) {
    try {
      const res = await fetch(`${storeUrl}/wp-json/wc/v3/webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${ck}:${cs}`),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `Mooadon - ${topic}`,
          topic,
          delivery_url: endpoint,
          secret,
          status: 'active'
        })
      });
      if (res.ok) success.push(topic);
      else failed.push(topic);
    } catch { failed.push(topic); }
  }

  return { success, failed };
}

async function getConn(db: any, companyId: string, source: string) {
  const conns = await db.entities.IntegrationConnection.filter({ company_id: companyId, source, status: 'connected' });
  return conns[0] || null;
}