import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

/**
 * prioritySyncBranches
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

  const entityName = conn.priority_branch_entity || "BRANCHES";
  const since = conn.priority_last_sync_branches_at;

  const result = { imported: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: any[] = [];

  try {
    const url = buildBranchesUrl(conn, entityName, mode, since, top);
    const res = await fetch(url, { headers: buildAuthHeaders(conn) });
    if (!res.ok) throw new Error(`Priority branches fetch failed: ${res.status}`);

    const data = await res.json();
    const rows = Array.isArray(data?.value) ? data.value : (Array.isArray(data) ? data : []);

    for (const r of rows) {
      try {
        const n = normalizePriorityBranch(r);

        if (!n.priority_branch_id) {
          result.skipped++;
          continue;
        }

        const existing = await findBranch(db, company_id, n.priority_branch_id);

        if (existing) {
          await db.entities.Branch.update(existing.id, {
            name: n.name || existing.name || null,
            address: n.address || existing.address || null,
            city: n.city || existing.city || null,
            country: n.country || existing.country || null,
            priority_branch_id: n.priority_branch_id,
          });
          result.updated++;
        } else {
          await db.entities.Branch.create({
            company_id,
            name: n.name || `Branch ${n.priority_branch_id}`,
            address: n.address || null,
            city: n.city || null,
            country: n.country || null,
            priority_branch_id: n.priority_branch_id,
            created_at: new Date().toISOString(),
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
      priority_last_sync_branches_at: now,
      last_sync_at: now,
      last_sync_status: "ok",
      last_error: null,
    });

    await logEvent(db, company_id, "sync_branches", "processed", {
      mode, entity: entityName, counts: result, sample_count: rows.length,
    });

    return Response.json({ ok: true, ...result, errors: errors.slice(0, 10) });

  } catch (e: any) {
    const err = String(e.message || e);
    await db.entities.IntegrationConnection.update(conn.id, {
      last_sync_status: "failed",
      last_error: err,
    });
    await logEvent(db, company_id, "sync_branches", "failed", { error: err, mode, entity: entityName });
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

function buildBranchesUrl(conn: any, entity: string, mode: string, since: string | null, top: number) {
  const base = conn.priority_base_url.replace(/\/$/, "");
  if (mode === "delta" && since) {
    const filter = encodeURIComponent(`LAST_UPDATE gt ${since}`);
    return `${base}/${encodeURIComponent(entity)}?$top=${top}&$filter=${filter}`;
  }
  return `${base}/${encodeURIComponent(entity)}?$top=${top}`;
}

function normalizePriorityBranch(r: any) {
  const branchId = String(r.BRANCHCODE || r.BRANCH_ID || r.ID || r.CODE || "").trim() || null;
  const name     = String(r.BRANCHNAME || r.NAME || r.DESC || "").trim() || null;
  const address  = String(r.ADDRESS || r.ADDR || "").trim() || null;
  const city     = String(r.CITY || "").trim() || null;
  const country  = String(r.COUNTRY || "").trim() || null;
  return { priority_branch_id: branchId, name, address, city, country };
}

async function findBranch(db: any, companyId: string, priorityBranchId: string) {
  const found = await db.entities.Branch.filter({ company_id: companyId, priority_branch_id: priorityBranchId });
  return found[0] || null;
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