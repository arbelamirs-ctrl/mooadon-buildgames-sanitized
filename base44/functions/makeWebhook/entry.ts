import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * makeWebhook
 * ─────────────────────────────────────────────────────────────────────────────
 * Generic webhook for Make.com / Zapier / custom sources.
 * Auth: X-Mooadon-Api-Key header (per-company API key from IntegrationConnection)
 * URL: /functions/makeWebhook?company_id=xxx&source=make|zapier|custom
 *
 * Normalized payload (Make/Zapier should send this format):
 * {
 *   event_type: "order_paid" | "order_created" | "test_ping",
 *   external_order_id: "123",
 *   total_amount: 150.00,
 *   currency: "ILS",
 *   customer_phone: "+972501234567",
 *   customer_email: "user@example.com",
 *   customer_name: "John Doe",
 *   items: [{ sku, name, qty, unit_price }]
 * }
 * ─────────────────────────────────────────────────────────────────────────────
 */

Deno.serve(async (req) => {
  const startTime = Date.now();

  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const url       = new URL(req.url);
  const companyId = url.searchParams.get('company_id') || '';
  const source    = url.searchParams.get('source') || 'make'; // make | zapier | custom

  if (!companyId) {
    return Response.json({ error: 'Missing company_id in URL' }, { status: 400 });
  }

  const bodyText = await req.text();
  let body: any = {};
  try { body = JSON.parse(bodyText); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const apiKey = req.headers.get('x-mooadon-api-key') || req.headers.get('x-api-key') || '';

  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole;

  try {
    // ── 1. Load connection + verify API key ──────────────────────────────
    const connections = await db.entities.IntegrationConnection.filter({
      company_id: companyId,
      source,
      status: 'connected'
    });

    if (connections.length === 0) {
      return Response.json({ error: `No active ${source} connection for this company` }, { status: 401 });
    }

    const conn = connections[0];

    if (!apiKey || apiKey !== conn.api_key) {
      await logEvent(db, companyId, source, body.event_type || 'unknown', 'auth_failed', body, null);
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // ── 2. Handle test_ping ──────────────────────────────────────────────
    if (body.event_type === 'test_ping') {
      await db.entities.IntegrationConnection.update(conn.id, {
        test_passed_at: new Date().toISOString(),
        last_event_at: new Date().toISOString()
      });
      return Response.json({ ok: true, pong: true, company_id: companyId, source });
    }

    // ── 3. Validate payload ──────────────────────────────────────────────
    const { event_type, external_order_id, total_amount, customer_phone, customer_email } = body;

    if (!event_type || !total_amount) {
      return Response.json({ error: 'Missing required fields: event_type, total_amount' }, { status: 400 });
    }
    if (!customer_phone && !customer_email) {
      return Response.json({ error: 'Must include customer_phone or customer_email' }, { status: 400 });
    }

    // ── 4. Idempotency ───────────────────────────────────────────────────
    const idempKey = `${source}:${companyId}:${event_type}:${external_order_id || bodyText.slice(0, 40)}`;
    const existing = await db.entities.IntegrationEventLog.filter({
      idempotency_key: idempKey,
      company_id: companyId
    });
    if (existing.length > 0) {
      return Response.json({ ok: true, duplicate: true });
    }

    // ── 5. Normalize phone ───────────────────────────────────────────────
    const phone = normalizePhone(customer_phone || '');
    const email = (customer_email || '').toLowerCase().trim();

    // ── 6. Find or create client ─────────────────────────────────────────
    let client = null;
    if (phone) {
      const found = await db.entities.Client.filter({ company_id: companyId, phone });
      client = found[0] || null;
    }
    if (!client && email) {
      const found = await db.entities.Client.filter({ company_id: companyId, email });
      client = found[0] || null;
    }
    if (!client) {
      client = await db.entities.Client.create({
        company_id: companyId,
        phone: phone || null,
        email: email || null,
        full_name: body.customer_name || null,
        current_balance: 0,
        total_earned: 0,
        total_redeemed: 0
      });
    }

    // ── 7. Trigger reward ────────────────────────────────────────────────
    let rewardResult = null;
    if (['order_paid', 'order_created', 'order_completed'].includes(event_type)) {
      rewardResult = await db.asServiceRole.functions.invoke('createPOSTransaction', {
        company_id: companyId,
        phone: client.phone || phone,
        amount: parseFloat(String(total_amount)),
        order_id: external_order_id || null,
        currency: body.currency || 'ILS',
        reward_type: 'token',
        source,
        items: body.items || []
      });
    }

    // ── 8. Update connection + log ────────────────────────────────────────
    await db.entities.IntegrationConnection.update(conn.id, {
      last_event_at: new Date().toISOString(),
      last_event_type: event_type,
      total_events: (conn.total_events || 0) + 1
    });

    await logEvent(db, companyId, source, event_type, 'processed', body, idempKey);

    const duration = Date.now() - startTime;
    console.log(`[makeWebhook] ✅ ${source}/${event_type} for ${companyId} in ${duration}ms`);

    return Response.json({
      ok: true,
      event_type,
      client_id: client.id,
      reward: rewardResult
    });

  } catch (error) {
    console.error('[makeWebhook] Error:', error.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return '+972' + digits.slice(1);
  if (digits.length > 10) return '+' + digits;
  return digits;
}

async function logEvent(db: any, companyId: string, source: string, eventType: string, status: string, payload: any, idempKey: string | null) {
  try {
    await db.entities.IntegrationEventLog.create({
      company_id: companyId,
      source,
      event_type: eventType,
      status,
      payload,
      idempotency_key: idempKey,
      created_at: new Date().toISOString()
    });
  } catch (_) {}
}