import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

/**
 * prioritySyncCustomers
 * POST body:
 * {
 *   company_id: string,
 *   mode?: "full" | "delta",
 *   top?: number
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

  const { company_id, mode = "delta", top = 500 } = body;
  if (!company_id) return Response.json({ error: "Missing company_id" }, { status: 400 });

  const conn = await getConn(db, company_id);
  if (!conn) return Response.json({ error: "Priority not connected" }, { status: 404 });

  const entityName = conn.priority_customer_entity || "CUSTOMERS";
  const since = conn.priority_last_sync_customers_at;

  const result = { imported: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: any[] = [];

  try {
    const url = buildCustomersUrl(conn, entityName, mode, since, top);
    const res = await fetch(url, { headers: buildAuthHeaders(conn) });
    if (!res.ok) throw new Error(`Priority customers fetch failed: ${res.status}`);

    const data = await res.json();
    const rows = Array.isArray(data?.value) ? data.value : (Array.isArray(data) ? data : []);

    for (const r of rows) {
      try {
        const normalized = normalizePriorityCustomer(r);

        if (!normalized.priority_customer_id && !normalized.phone && !normalized.email) {
          result.skipped++;
          continue;
        }

        const existing = await findClient(db, company_id, normalized);

        if (existing) {
          await db.entities.Client.update(existing.id, {
            full_name: normalized.full_name || existing.full_name || null,
            phone: normalized.phone || existing.phone || null,
            email: normalized.email || existing.email || null,
            priority_customer_id: normalized.priority_customer_id || existing.priority_customer_id || null,
            external_source: "priority",
            last_seen_at: new Date().toISOString(),
          });
          result.updated++;
        } else {
          await db.entities.Client.create({
            company_id,
            full_name: normalized.full_name || null,
            phone: normalized.phone || null,
            email: normalized.email || null,
            priority_customer_id: normalized.priority_customer_id || null,
            external_source: "priority",
            current_balance: 0,
            created_date: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          });
          result.imported++;
        }
      } catch (e: any) {
        result.failed++;
        errors.push({ error: String(e.message || e), row: safeSmall(r) });
      }
    }

    const now = new Date().toISOString();
    await db.entities.IntegrationConnection.update(conn.id, {
      priority_last_sync_customers_at: now,
      last_sync_at: now,
      last_sync_status: "ok",
      last_error: null,
    });

    await logEvent(db, company_id, "sync_customers", "processed", {
      mode, entity: entityName, counts: result, sample_count: rows.length,
    });

    return Response.json({ ok: true, ...result, errors: errors.slice(0, 10) });

  } catch (e: any) {
    const err = String(e.message || e);
    await db.entities.IntegrationConnection.update(conn.id, {
      last_sync_status: "failed",
      last_error: err,
    });
    await logEvent(db, company_id, "sync_customers", "failed", { error: err, mode, entity: entityName });
    return Response.json({ ok: false, error: err }, { status: 502 });
  }
});

async function getConn(db: any, companyId: string) {
  const conns = await db.entities.IntegrationConnection.filter({
    company_id: companyId, source: "priority", status: "connected"
  });
  return conns[0] || null;
}

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

function buildCustomersUrl(conn: any, entity: string, mode: string, since: string | null, top: number) {
  const base = conn.priority_base_url.replace(/\/$/, "");
  if (mode === "delta" && since) {
    const filter = encodeURIComponent(`LAST_UPDATE gt ${since}`);
    return `${base}/${encodeURIComponent(entity)}?$top=${top}&$filter=${filter}`;
  }
  return `${base}/${encodeURIComponent(entity)}?$top=${top}`;
}

function normalizePriorityCustomer(r: any) {
  const priorityId = String(r.CUSTCODE || r.CUSTOMER_ID || r.ID || r.CUSTID || "").trim() || null;
  const fullName   = String(r.CUSTNAME || r.NAME || r.FULLNAME || r.CUSTOMER_NAME || "").trim() || null;
  const email      = String(r.EMAIL || r.EMAILADDRESS || r.MAIL || "").trim().toLowerCase() || null;
  const phoneRaw   = String(r.PHONE || r.CELLPHONE || r.MOBILE || r.TEL || "").trim() || "";
  const phone      = normalizePhone(phoneRaw);
  return { priority_customer_id: priorityId, full_name: fullName, email, phone };
}

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 && digits.startsWith("0")) return "+972" + digits.slice(1);
  if (digits.length > 10) return "+" + digits;
  return digits;
}

async function findClient(db: any, companyId: string, n: any) {
  if (n.priority_customer_id) {
    const byId = await db.entities.Client.filter({ company_id: companyId, priority_customer_id: n.priority_customer_id });
    if (byId.length) return byId[0];
  }
  if (n.phone) {
    const byPhone = await db.entities.Client.filter({ company_id: companyId, phone: n.phone });
    if (byPhone.length) return byPhone[0];
  }
  if (n.email) {
    const byEmail = await db.entities.Client.filter({ company_id: companyId, email: n.email });
    if (byEmail.length) return byEmail[0];
  }
  return null;
}

async function logEvent(db: any, companyId: string, eventType: string, status: string, payload: any) {
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

function safeSmall(obj: any) {
  try {
    const s = JSON.stringify(obj);
    return s.length > 500 ? s.slice(0, 500) + "..." : obj;
  } catch { return null; }
}