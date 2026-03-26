import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── DB-based Rate Limiting (replaces in-memory Map) ──────────────────────
const _memRL = new Map();
async function checkRateLimitWithDB(base44, key, maxReqs, windowMs) {
  const now = Date.now();
  const mem = _memRL.get(key);
  if (mem && now < mem.resetAt && mem.count >= maxReqs) return false;
  if (!mem || now > mem.resetAt) _memRL.set(key, { count: 1, resetAt: now + windowMs });
  else mem.count++;

  try {
    const windowStart = new Date(now - windowMs).toISOString();
    const logs = await base44.asServiceRole.entities.IdempotencyLog.filter({
      idempotency_key: `rl:${key}`
    });
    const recentCount = logs.filter(l => new Date(l.created_date) > new Date(windowStart)).length;
    if (recentCount >= maxReqs) return false;

    await base44.asServiceRole.entities.IdempotencyLog.create({
      idempotency_key: `rl:${key}`,
      endpoint: 'rate_limit',
      company_id: 'system',
      response_status: 200,
      response_body: {},
      expires_at: new Date(now + windowMs).toISOString()
    });
  } catch (_) {
    // אם ה-DB נופל, נסתמך רק על הזיכרון
  }

  return true;
}

// Mask sensitive fields before logging
function maskSensitiveFields(body) {
  if (!body || typeof body !== 'object') return body;
  const masked = { ...body };
  if (masked.client_phone) masked.client_phone = '****';
  if (masked.customer_phone) masked.customer_phone = '****';
  if (masked.api_key) masked.api_key = '****';
  if (masked.api_secret) masked.api_secret = '****';
  if (masked.payment_token) masked.payment_token = '****';
  if (masked.card_number) masked.card_number = '****';
  return masked;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const startTime = Date.now();
  let body = {};

  try {
    const bodyText = await req.text();
    body = JSON.parse(bodyText);

    const {
      company_id,
      branch_id,
      client_phone,
      customer_phone,
      customer_qr_session,
      amount,
      order_id,
      external_transaction_id,
      receipt_id,
      reward_type,
      currency,
      timestamp,
      items
    } = body;

    // Normalize: accept both `client_phone` (legacy) and `customer_phone` (new spec)
    const resolvedPhone = customer_phone || client_phone || null;
    const resolvedOrderId = external_transaction_id || order_id || null;
    const resolvedReceiptId = receipt_id || null;

    // ── Validate required fields ────────────────────────────────────────────
    if (!company_id || !amount) {
      return Response.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    // Rate limit per company (DB + memory)
    if (!(await checkRateLimitWithDB(base44, `wh:${company_id}`, 200, 60_000))) {
      return Response.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    // Must have at least one customer identifier
    if (!resolvedPhone && !customer_qr_session) {
      return Response.json({ error: 'Missing customer identifier', code: 'MISSING_CUSTOMER' }, { status: 400 });
    }

    // ── 1. Signature verification (FIRST — before any data processing) ──────
    const signature = req.headers.get('x-mooadon-signature') || req.headers.get('x-webhook-signature');
    if (!signature) {
      await logFailedAttempt(base44, company_id, 'Missing signature');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const secrets = await base44.asServiceRole.entities.WebhookSecrets.filter({
      company_id,
      is_active: true
    });

    if (secrets.length === 0) {
      await logFailedAttempt(base44, company_id, 'No active webhook secret');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const webhookSecret = secrets[0];
    const isValid = await verifySignature(bodyText, signature, webhookSecret.secret_key);

    if (!isValid) {
      await logFailedAttempt(base44, company_id, 'Invalid signature');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await base44.asServiceRole.entities.WebhookSecrets.update(webhookSecret.id, {
      last_used_at:    new Date().toISOString(),
      failed_attempts: 0
    });

    // ── 2. Idempotency ─────────────────────────────────────────────────────
    const idempotencyKey = (resolvedReceiptId ? `rcpt:${company_id}:${resolvedReceiptId}` : null)
                        || req.headers.get('idempotency-key')
                        || req.headers.get('x-idempotency-key')
                        || resolvedOrderId;
    const requestHash = idempotencyKey ? await hashRequest(bodyText) : null;
    if (idempotencyKey) {
      let existing = await base44.asServiceRole.entities.IdempotencyLog.filter({
        idempotency_key: idempotencyKey,
        company_id
      });
      if (existing.length === 0 && resolvedOrderId) {
        existing = await base44.asServiceRole.entities.IdempotencyLog.filter({
          company_id,
          idempotency_key: `ext:${resolvedOrderId}`
        });
      }

      if (existing.length > 0) {
        const log = existing[0];
        if (new Date(log.expires_at) > new Date()) {
          if (log.request_hash === requestHash) {
            console.log(`[posWebhook] ↩️  Idempotent cached response`);
            return Response.json(log.response_body, { status: log.response_status });
          }
          return Response.json(
            { error: 'Conflict' },
            { status: 409 }
          );
        }
      }
    }

    // ── 3. Resolve customer from QR session if no phone ──────────────────────
    let finalPhone = resolvedPhone;
    if (!finalPhone && customer_qr_session) {
      try {
        const qrResult = await base44.asServiceRole.functions.invoke('resolveCustomerQR', {
          qr_payload: customer_qr_session
        });
        if (qrResult.data?.customer_phone) {
          finalPhone = qrResult.data.customer_phone;
        } else if (!qrResult.data?.session_valid) {
          return Response.json({ error: 'Invalid customer identifier' }, { status: 401 });
        }
      } catch (qrErr) {
        console.error('[posWebhook] QR resolution failed');
        return Response.json({ error: 'Customer resolution failed' }, { status: 400 });
      }
    }

    // ── 4. Process transaction ─────────────────────────────────────────────
    const response = await base44.asServiceRole.functions.invoke('createPOSTransaction', {
      company_id,
      branch_id,
      phone:        finalPhone,
      amount,
      order_id:     resolvedOrderId,
      receipt_id:   resolvedReceiptId,
      reward_type:  reward_type || 'token',
      currency:     currency || 'ILS',
      timestamp:    timestamp || new Date().toISOString(),
      items:        items || []
    });

    const responseStatus = response.status || 200;
    const responseBody   = response.data || response;

    // ── 5. Log idempotency ─────────────────────────────────────────────────
    if (idempotencyKey) {
      const expiresAt   = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await base44.asServiceRole.entities.IdempotencyLog.create({
        idempotency_key: idempotencyKey,
        request_hash:    requestHash,
        endpoint:        '/posWebhook',
        company_id,
        response_status: responseStatus,
        response_body:   responseBody,
        expires_at:      expiresAt.toISOString()
      });
    }

    // ── 6. Audit log ───────────────────────────────────────────────────────
    const durationMs = Date.now() - startTime;
    await base44.asServiceRole.entities.WebhookLog.create({
      company_id,
      branch_id,
      endpoint:     '/posWebhook',
      method:       'POST',
      status_code:  responseStatus,
      request_body: maskSensitiveFields(body),
      response_body: responseBody,
      ip_address:   req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      duration_ms:  durationMs
    });

    return Response.json(responseBody, { status: responseStatus });

  } catch (error) {
    console.error('[posWebhook] Error:', error.message);

    // ── Enqueue for retry ──────────────────────────────────────────────────
    try {
      await base44.asServiceRole.entities.WebhookRetryQueue.create({
        company_id:   body?.company_id || 'unknown',
        branch_id:    body?.branch_id  || null,
        endpoint:     'createPOSTransaction',
        payload:      maskSensitiveFields(body),
        error:        'Processing failed',
        status:       'pending',
        retry_count:  0,
        max_retries:  3,
        next_retry_at: new Date(Date.now() + 60_000).toISOString(),
        created_at:   new Date().toISOString()
      });
    } catch (queueErr) {
      console.error('[posWebhook] Queue error');
    }

    // Log error (with masked data)
    try {
      await base44.asServiceRole.entities.WebhookLog.create({
        company_id:   body?.company_id || 'unknown',
        branch_id:    body?.branch_id  || null,
        endpoint:     '/posWebhook',
        method:       'POST',
        status_code:  500,
        request_body: maskSensitiveFields(body || {}),
        error_message: 'Internal server error',
        ip_address:   req.headers.get('x-forwarded-for') || 'unknown',
        duration_ms:  Date.now() - startTime
      });
    } catch (logErr) {
      console.error('[posWebhook] Log error');
    }

    return Response.json({ error: 'Processing failed' }, { status: 500 });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function verifySignature(body, signature, secret) {
  try {
    const encoder    = new TextEncoder();
    const key        = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    );
    const sigBuffer  = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expected   = Array.from(new Uint8Array(sigBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    return signature.toLowerCase() === expected.toLowerCase();
  } catch {
    return false;
  }
}

async function hashRequest(body) {
  const encoder   = new TextEncoder();
  const hashBuf   = await crypto.subtle.digest('SHA-256', encoder.encode(body));
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function logFailedAttempt(base44, company_id, reason) {
  try {
    const secrets = await base44.asServiceRole.entities.WebhookSecrets.filter({ company_id });
    if (secrets.length > 0) {
      await base44.asServiceRole.entities.WebhookSecrets.update(secrets[0].id, {
        failed_attempts: (secrets[0].failed_attempts || 0) + 1
      });
    }
  } catch (err) {
    console.error('[posWebhook] Attempt log error');
  }
}