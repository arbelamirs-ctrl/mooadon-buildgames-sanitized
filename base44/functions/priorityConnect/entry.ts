import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

/**
 * priorityConnect
 * POST body:
 * {
 *   action: "connect" | "test" | "disconnect",
 *   company_id: string,
 *   base_url?: string,
 *   auth_type?: "basic" | "pat",
 *   username?: string,
 *   password?: string,
 *   pat_token?: string,
 *   priority_company?: string,
 *   customer_entity?: string,   // e.g. "CUSTOMERS"
 *   branch_entity?: string      // e.g. "BRANCHES"
 * }
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole;

  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    action, company_id, base_url, auth_type,
    username, password, pat_token,
    priority_company, customer_entity, branch_entity
  } = body;

  if (!company_id) return Response.json({ error: "Missing company_id" }, { status: 400 });
  if (!action)     return Response.json({ error: "Missing action" }, { status: 400 });

  // Load existing connection
  const existing = await db.entities.IntegrationConnection.filter({ company_id, source: "priority" });
  const conn = existing[0] || null;

  // ── DISCONNECT ────────────────────────────────────────────────────────────
  if (action === "disconnect") {
    if (!conn) return Response.json({ ok: true, disconnected: true });
    await db.entities.IntegrationConnection.update(conn.id, {
      status: "disconnected",
      priority_base_url: null,
      priority_auth_type: null,
      priority_username: null,
      priority_password: null,
      priority_pat_token: null,
      priority_company: null,
      priority_customer_entity: null,
      priority_branch_entity: null,
      last_error: null,
    });
    await safeLog(db, company_id, "disconnect", "processed", { by: user.email });
    return Response.json({ ok: true, disconnected: true });
  }

  // ── CONNECT ───────────────────────────────────────────────────────────────
  if (action === "connect") {
    if (!base_url) return Response.json({ error: "Missing base_url" }, { status: 400 });
    if (!auth_type || !["basic", "pat"].includes(auth_type)) {
      return Response.json({ error: "auth_type must be 'basic' or 'pat'" }, { status: 400 });
    }
    if (auth_type === "basic" && (!username || !password)) {
      return Response.json({ error: "Missing username/password for basic auth" }, { status: 400 });
    }
    if (auth_type === "pat" && !pat_token) {
      return Response.json({ error: "Missing pat_token for PAT auth" }, { status: 400 });
    }

    const cleanUrl = String(base_url).replace(/\/$/, "");

    const payload: any = {
      status: "connected",
      priority_base_url: cleanUrl,
      priority_auth_type: auth_type,
      priority_username: username || null,
      priority_password: password || null,
      priority_pat_token: pat_token || null,
      priority_company: priority_company || null,
      priority_customer_entity: customer_entity || "CUSTOMERS",
      priority_branch_entity: branch_entity || "BRANCHES",
      connected_at: new Date().toISOString(),
      last_error: null,
      test_passed_at: new Date().toISOString(),
    };

    let saved;
    if (conn) {
      saved = await db.entities.IntegrationConnection.update(conn.id, payload);
    } else {
      saved = await db.entities.IntegrationConnection.create({ company_id, source: "priority", ...payload });
    }

    await safeLog(db, company_id, "connect", "processed", {
      by: user.email, base_url: cleanUrl, auth_type,
      customer_entity: payload.priority_customer_entity,
      branch_entity: payload.priority_branch_entity,
    });

    return Response.json({
      ok: true, connected: true,
      connection_id: saved.id || conn?.id,
      base_url: cleanUrl, auth_type,
      customer_entity: payload.priority_customer_entity,
      branch_entity: payload.priority_branch_entity,
    });
  }

  // ── TEST ──────────────────────────────────────────────────────────────────
  if (action === "test") {
    if (!conn || conn.status !== "connected") {
      return Response.json({ error: "No active Priority connection for this company" }, { status: 404 });
    }

    try {
      // Try $metadata first
      const testUrl = `${conn.priority_base_url}/$metadata`;
      const res = await fetch(testUrl, { headers: buildAuthHeaders(conn) });

      if (!res.ok) {
        // Fallback: query top=1 from customer entity
        const ce = conn.priority_customer_entity || "CUSTOMERS";
        const res2 = await fetch(`${conn.priority_base_url}/${encodeURIComponent(ce)}?$top=1`, {
          headers: buildAuthHeaders(conn)
        });
        if (!res2.ok) throw new Error(`Priority test failed: ${res.status} / ${res2.status}`);
      }

      await db.entities.IntegrationConnection.update(conn.id, {
        test_passed_at: new Date().toISOString(),
        last_error: null,
      });
      await safeLog(db, company_id, "test", "processed", { ok: true });
      return Response.json({ ok: true, connected: true, base_url: conn.priority_base_url });

    } catch (e: any) {
      await db.entities.IntegrationConnection.update(conn.id, { last_error: String(e.message || e) });
      await safeLog(db, company_id, "test", "failed", { error: String(e.message || e) });
      return Response.json({ ok: false, error: String(e.message || e) }, { status: 502 });
    }
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
});

function buildAuthHeaders(conn: any): HeadersInit {
  const h: any = { "Accept": "application/json" };
  if (conn.priority_auth_type === "basic") {
    h["Authorization"] = "Basic " + btoa(`${conn.priority_username}:${conn.priority_password}`);
  } else if (conn.priority_auth_type === "pat") {
    const token = conn.priority_pat_token || "";
    h["Authorization"] = "Basic " + btoa(`${token}:PAT`);
  }
  return h;
}

async function safeLog(db: any, companyId: string, eventType: string, status: string, payload: any) {
  try {
    await db.entities.IntegrationEventLog.create({
      company_id: companyId,
      source: "priority",
      event_type: eventType,
      status,
      payload,
      idempotency_key: `priority:${companyId}:${eventType}:${Date.now()}`,
      created_at: new Date().toISOString(),
    });
  } catch (_) {}
}