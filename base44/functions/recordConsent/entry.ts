import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * recordConsent — Consent Layer for Mooadon
 *
 * Manages customer consent for GDPR / Israeli Privacy Law compliance.
 *
 * POST /functions/recordConsent  — record/update consents
 * GET  /functions/recordConsent?phone=...&company_id=...  — fetch current status
 * DELETE /functions/recordConsent  — revoke a specific consent
 */

const VALID_CONSENT_TYPES = [
  'marketing_sms',
  'marketing_email',
  'data_collection',
  'ai_analysis',
  'external_wallet',
  'third_party_sharing',
];

const VALID_SOURCES = [
  'pos_registration',
  'profile_update',
  'sms_opt_in',
  'web',
  'api',
  'onboarding',
];

function normalizePhone(phone) {
  let p = phone.replace(/[^\d+]/g, '');
  if (!p.startsWith('+')) {
    if (p.length === 9) p = '+972' + p;
    else if (p.length === 10 && p.startsWith('0')) p = '+972' + p.slice(1);
    else p = '+' + p;
  }
  return p;
}

async function checkAuth(base44, req) {
  const serviceToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
  const authHeader = req.headers.get('authorization') || '';
  const isServiceCall = serviceToken && authHeader === `Bearer ${serviceToken}`;

  if (!isServiceCall) {
    try {
      const user = await base44.auth.me();
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

async function syncConsentToClient(base44, phone, company_id, consents) {
  try {
    const clients = await base44.asServiceRole.entities.Client.filter({ phone, company_id });
    if (clients.length === 0) return;

    const updateData = {};
    if ('marketing_sms' in consents) updateData.consent_marketing_sms = consents.marketing_sms;
    if ('marketing_email' in consents) updateData.consent_marketing_email = consents.marketing_email;
    if ('data_collection' in consents) updateData.consent_data_collection = consents.data_collection;
    if ('ai_analysis' in consents) updateData.consent_ai_analysis = consents.ai_analysis;

    if (Object.keys(updateData).length > 0) {
      updateData.consent_last_updated = new Date().toISOString();
      await base44.asServiceRole.entities.Client.update(clients[0].id, updateData);
    }
  } catch (e) {
    console.warn('[recordConsent] syncConsentToClient failed');
  }
}

async function writeAuditLog(base44, phone, company_id, action, details) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      company_id,
      action,
      entity_type: 'CustomerConsent',
      entity_id: phone,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[recordConsent] AuditLog write failed');
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    // Auth check for all methods
    const isAuthorized = await checkAuth(base44, req);
    if (!isAuthorized) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ─── GET: fetch current consent status ───────────────────────────────────
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const phone = url.searchParams.get('phone');
      const company_id = url.searchParams.get('company_id');

      if (!phone || !company_id) {
        return Response.json({ error: 'Missing required parameters' }, { status: 400 });
      }

      const normalizedPhone = normalizePhone(phone);

      const records = await base44.asServiceRole.entities.CustomerConsent.filter({
        phone: normalizedPhone,
        company_id,
        is_active: true,
      });

      const consentMap = {};
      for (const type of VALID_CONSENT_TYPES) {
        consentMap[type] = false;
      }
      for (const r of records) {
        consentMap[r.consent_type] = r.granted;
      }

      return Response.json({
        success: true,
        consents: consentMap,
      });
    }

    // ─── DELETE: revoke a specific consent ───────────────────────────────────
    if (req.method === 'DELETE') {
      const body = await req.json();
      const { phone, company_id, consent_type } = body;

      if (!phone || !company_id || !consent_type) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }

      if (!VALID_CONSENT_TYPES.includes(consent_type)) {
        return Response.json({ error: 'Invalid consent type' }, { status: 400 });
      }

      const normalizedPhone = normalizePhone(phone);

      const existing = await base44.asServiceRole.entities.CustomerConsent.filter({
        phone: normalizedPhone,
        company_id,
        consent_type,
        is_active: true,
      });

      for (const record of existing) {
        await base44.asServiceRole.entities.CustomerConsent.update(record.id, {
          granted: false,
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoke_source: 'customer_request',
        });
      }

      await writeAuditLog(base44, normalizedPhone, company_id, 'consent_revoked', {
        consent_type,
      });

      console.log(`[recordConsent] Consent revoked`);

      return Response.json({
        success: true,
        message: 'Consent revoked',
      });
    }

    // ─── POST: record new consents ────────────────────────────────────────────
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const body = await req.json();
    const { phone, company_id, consents, source = 'api' } = body;

    if (!phone || !company_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!consents || typeof consents !== 'object' || Object.keys(consents).length === 0) {
      return Response.json({ error: 'consents object is required' }, { status: 400 });
    }

    if (!VALID_SOURCES.includes(source)) {
      return Response.json({ error: 'Invalid source' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    const now = new Date().toISOString();
    const results = {};

    for (const [consent_type, granted] of Object.entries(consents)) {
      if (!VALID_CONSENT_TYPES.includes(consent_type)) {
        console.warn(`[recordConsent] Unknown consent type: ${consent_type}`);
        continue;
      }

      if (typeof granted !== 'boolean') {
        console.warn(`[recordConsent] Invalid consent value for ${consent_type}`);
        continue;
      }

      const existing = await base44.asServiceRole.entities.CustomerConsent.filter({
        phone: normalizedPhone,
        company_id,
        consent_type,
        is_active: true,
      });

      if (existing.length > 0) {
        const current = existing[0];
        if (current.granted !== granted) {
          await base44.asServiceRole.entities.CustomerConsent.update(current.id, {
            granted,
            is_active: true,
            updated_at: now,
            source,
            revoked_at: !granted ? now : null,
            revoke_source: !granted ? source : null,
          });
          results[consent_type] = granted ? 'updated_granted' : 'updated_revoked';
        } else {
          results[consent_type] = 'unchanged';
        }
      } else {
        await base44.asServiceRole.entities.CustomerConsent.create({
          phone: normalizedPhone,
          company_id,
          consent_type,
          granted,
          source,
          is_active: true,
          granted_at: granted ? now : null,
          revoked_at: !granted ? now : null,
          updated_at: now,
        });
        results[consent_type] = granted ? 'created_granted' : 'created_declined';
      }
    }

    await syncConsentToClient(base44, normalizedPhone, company_id, consents);
    await writeAuditLog(base44, normalizedPhone, company_id, 'consent_updated', {
      source,
    });

    console.log(`[recordConsent] Consent recorded`);

    return Response.json({
      success: true,
      results,
      timestamp: now,
    });

  } catch (error) {
    console.error('[recordConsent] Error:', error.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});