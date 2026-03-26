import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * shopifyOAuth
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles Shopify OAuth 2.0 app installation flow:
 *   GET ?action=install&shop=mystore.myshopify.com&company_id=xxx  → redirect to Shopify
 *   GET ?action=callback&code=xxx&shop=xxx&state=xxx               → exchange token + save
 *   POST ?action=test&company_id=xxx                               → test connection
 *   POST ?action=disconnect&company_id=xxx                         → disconnect
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SHOPIFY_SCOPES = 'read_orders,read_customers,read_products';
const SHOPIFY_WEBHOOK_TOPICS = ['orders/paid', 'refunds/create', 'app/uninstalled'];

Deno.serve(async (req) => {
  const url    = new URL(req.url);
  const action = url.searchParams.get('action') || '';

  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole;

  const SHOPIFY_API_KEY    = Deno.env.get('SHOPIFY_API_KEY') || '';
  const SHOPIFY_API_SECRET = Deno.env.get('SHOPIFY_API_SECRET') || '';
  const APP_BASE_URL       = Deno.env.get('APP_BASE_URL') || 'https://mooadon.base44.app';

  // ── INSTALL — redirect user to Shopify OAuth page ───────────────────────
  if (req.method === 'GET' && action === 'install') {
    const shop      = url.searchParams.get('shop') || '';
    const companyId = url.searchParams.get('company_id') || '';

    if (!shop || !companyId) {
      return Response.json({ error: 'Missing shop or company_id' }, { status: 400 });
    }
    if (!isValidShopDomain(shop)) {
      return Response.json({ error: 'Invalid shop domain' }, { status: 400 });
    }

    const state    = crypto.randomUUID();
    const redirect = `${APP_BASE_URL}/functions/shopifyOAuth?action=callback`;
    const authUrl  = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SHOPIFY_SCOPES}&redirect_uri=${encodeURIComponent(redirect)}&state=${state}`;

    // Save state for CSRF verification
    await db.entities.IntegrationConnection.create({
      source: 'shopify',
      company_id: companyId,
      shop_domain: shop,
      status: 'pending',
      oauth_state: state,
      created_at: new Date().toISOString()
    }).catch(() => {});

    return Response.redirect(authUrl, 302);
  }

  // ── CALLBACK — exchange code for access token ────────────────────────────
  if (req.method === 'GET' && action === 'callback') {
    const shop  = url.searchParams.get('shop') || '';
    const code  = url.searchParams.get('code') || '';
    const state = url.searchParams.get('state') || '';

    if (!shop || !code) {
      return Response.json({ error: 'Missing shop or code' }, { status: 400 });
    }

    // Find pending connection
    const pending = await db.entities.IntegrationConnection.filter({
      source: 'shopify',
      shop_domain: shop,
      status: 'pending',
      oauth_state: state
    });

    if (pending.length === 0) {
      return Response.json({ error: 'Invalid OAuth state — CSRF check failed' }, { status: 401 });
    }
    const conn      = pending[0];
    const companyId = conn.company_id;

    // Exchange code for access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: SHOPIFY_API_KEY, client_secret: SHOPIFY_API_SECRET, code })
    });

    if (!tokenRes.ok) {
      return Response.json({ error: 'Failed to exchange Shopify OAuth code' }, { status: 502 });
    }

    const { access_token, scope } = await tokenRes.json();

    // Generate webhook secret for HMAC verification
    const webhookSecret = crypto.randomUUID().replace(/-/g, '');

    // Update connection with token
    await db.entities.IntegrationConnection.update(conn.id, {
      status: 'connected',
      access_token,
      webhook_secret: webhookSecret,
      scopes: scope,
      connected_at: new Date().toISOString(),
      oauth_state: null
    });

    // Auto-install Shopify webhooks
    const webhookEndpoint = `${APP_BASE_URL}/functions/shopifyWebhook`;
    const installedWebhooks = [];
    const failedWebhooks = [];

    for (const topic of SHOPIFY_WEBHOOK_TOPICS) {
      try {
        const wRes = await fetch(`https://${shop}/admin/api/2024-01/webhooks.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': access_token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            webhook: { topic, address: webhookEndpoint, format: 'json' }
          })
        });
        if (wRes.ok) {
          installedWebhooks.push(topic);
        } else {
          failedWebhooks.push(topic);
        }
      } catch (e) {
        failedWebhooks.push(topic);
      }
    }

    // Update webhooks status
    await db.entities.IntegrationConnection.update(conn.id, {
      webhooks_installed: installedWebhooks,
      webhooks_failed: failedWebhooks,
      webhooks_installed_at: new Date().toISOString()
    });

    // Log audit
    await db.entities.AuditLog.create({
      company_id: companyId,
      action: 'shopify_connected',
      entity_type: 'IntegrationConnection',
      entity_id: conn.id,
      performed_by: 'oauth_flow',
      details: { shop_domain: shop, topics_installed: installedWebhooks }
    }).catch(() => {});

    // Redirect back to app settings page
    return Response.redirect(`${APP_BASE_URL}/#/CompanySettings?tab=integrations&shopify=connected`, 302);
  }

  // ── POST actions (test / disconnect) ────────────────────────────────────
  if (req.method === 'POST') {
    let body: any = {};
    try { body = await req.json(); } catch {}

    const { action: postAction, company_id } = body;

    // Auth check
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const conn = await getConnection(db, company_id, 'shopify');
    if (!conn) return Response.json({ error: 'No Shopify connection found' }, { status: 404 });

    // TEST
    if (postAction === 'test') {
      try {
        const res = await fetch(`https://${conn.shop_domain}/admin/api/2024-01/orders.json?limit=1&status=paid`, {
          headers: { 'X-Shopify-Access-Token': conn.access_token }
        });
        if (!res.ok) throw new Error(`Shopify API returned ${res.status}`);
        const data = await res.json();

        await db.entities.IntegrationConnection.update(conn.id, {
          test_passed_at: new Date().toISOString(),
          last_error: null
        });

        return Response.json({ ok: true, orders_sample: data.orders?.length, shop: conn.shop_domain });
      } catch (e) {
        await db.entities.IntegrationConnection.update(conn.id, { last_error: e.message });
        return Response.json({ ok: false, error: e.message }, { status: 502 });
      }
    }

    // DISCONNECT
    if (postAction === 'disconnect') {
      await db.entities.IntegrationConnection.update(conn.id, {
        status: 'disconnected',
        disconnected_at: new Date().toISOString(),
        access_token: null
      });
      return Response.json({ ok: true, disconnected: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidShopDomain(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop);
}

async function getConnection(db: any, companyId: string, source: string) {
  const conns = await db.entities.IntegrationConnection.filter({ company_id: companyId, source, status: 'connected' });
  return conns[0] || null;
}