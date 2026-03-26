/**
 * earnPoints.ts - PHASE 2 FINAL
 * 
 * Changes from Phase 1:
 * - ✅ Removed silent fallback to 'fuji' (strict network validation)
 * - ✅ Removed WhatsApp notification (RewardQueueProcessor sends after confirmation)
 * - Network resolution is mandatory, throws error if invalid
 * 
 * This endpoint creates Transaction + RewardQueue for auto-send flow.
 * WhatsApp notification sent by RewardQueueProcessor after blockchain confirmation.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// DB-based rate limiter: 120 requests/min per branch
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
  } catch (_) {}

  return true;
}

// ── Chain config helper (inlined — cannot import sibling files in Deno deploy) ─
// INLINED: Cannot import from getCompanyChainConfig.ts (Deno Deploy limitation)
// Canonical source: /backend/functions/getCompanyChainConfig.ts
// Keep in sync when updating network resolution logic
function normalizeNetwork(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s === 'fuji' || s === 'avalanche_fuji' || s === 'avax_fuji' || s === 'testnet') return 'fuji';
  if (s === 'mainnet' || s === 'avalanche' || s === 'avax' || s === 'avax_mainnet') return 'mainnet';
  return s;
}

function resolveChainConfig(company, companyToken) {
  const raw = company?.onchain_network || companyToken?.chain || null;
  if (!raw) {
    throw new Error(
      `Network not configured for company "${company?.name || company?.id}". ` +
      `Set company.onchain_network to "fuji" or "mainnet".`
    );
  }
  const normalized = normalizeNetwork(raw);
  if (normalized !== 'fuji' && normalized !== 'mainnet') {
    throw new Error(`Invalid network "${raw}" for company "${company?.name || company?.id}". Must be "fuji" or "mainnet".`);
  }
  const isMainnet = normalized === 'mainnet';
  return {
    walletChain: isMainnet ? 'avalanche' : 'avalanche_fuji',
    isMainnet,
    networkName: normalized,
  };
}
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const base44 = createClientFromRequest(req);

    // Auth check — require either authenticated user or valid internal service token
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (e) {
      // allow only if valid service token
    }

    if (!user) {
      const svcToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
      const reqToken = req.headers.get('X-Service-Token');
      if (!svcToken || reqToken !== svcToken) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Parse request
    const body = await req.json();
    const { company_id, branch_id, phone, amount_spent, pos_transaction_id } = body;

    // Validate required fields
    if (!company_id || !branch_id || !phone || !amount_spent || !pos_transaction_id) {
      return Response.json({
        success: false,
        error: 'Missing required fields: company_id, branch_id, phone, amount_spent, pos_transaction_id'
      }, { status: 400 });
    }

    // Validate amount_spent is a reasonable positive number (max ₪100,000 per transaction)
    const parsedAmount = parseFloat(amount_spent);
    if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100000) {
      return Response.json({ success: false, error: 'Invalid amount_spent value' }, { status: 400 });
    }

    // Rate limiting
    const rateLimitKey = `earn:${branch_id}`;
    const allowed = await checkRateLimitWithDB(base44, rateLimitKey, 120, 60_000);
    if (!allowed) {
      return Response.json({ success: false, error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
    }

    // Idempotency check
    const idempotencyLogs = await base44.asServiceRole.entities.IdempotencyLog.filter({
      idempotency_key: pos_transaction_id
    });
    if (idempotencyLogs.length > 0) {
      const existing = idempotencyLogs[0];
      return Response.json(existing.response_body || { success: true, message: 'Already processed' });
    }

    // Get company
    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    if (!companies || companies.length === 0) {
      return Response.json({ success: false, error: 'Company not found' }, { status: 404 });
    }
    const company = companies[0];

    // Get active token
    const allTokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id });
    const activeTokens = allTokens.filter(t => t.is_active !== false && t.contract_address);
    const companyToken = activeTokens.length > 0
      ? activeTokens[activeTokens.length - 1]
      : allTokens[0] || null;

    // ✅ PHASE 2: Strict network resolution - NO silent fallback
    // If company network is invalid, this will throw an error immediately
    const chainConfig = resolveChainConfig(company, companyToken);
    const networkName = chainConfig.networkName;
    console.log(`🌐 Network resolved: ${networkName} for company ${company.name}`);

    // Calculate tokens
    const tokens = Math.floor(parsedAmount * (company.reward_rate || company.points_to_currency_ratio || 10));

    // CRITICAL FIX: Normalize phone to prevent duplicates 
    // Inlined from phoneUtils.ts (cannot import in Deno Deploy)
    const normalizePhone = (p) => {
      if (!p) return '';
      let n = p.trim().replace(/[\s\-\(\)]/g, '');
      if (!n.startsWith('+')) {
        n = n.startsWith('0') ? '+972' + n.substring(1) : '+' + n;
      }
      return n;
    };
    
    const normalizedPhone = normalizePhone(phone);
    console.log(`📞 Phone normalization: "${phone}" → "${normalizedPhone}"`);

    // Find or create client record
    let clients = await base44.asServiceRole.entities.Client.filter({ 
      company_id, 
      phone: normalizedPhone 
    });
    
    // CRITICAL FIX: Deterministic selection - always pick oldest client
    // If there are duplicates (shouldn't happen, but defensive coding)
    if (clients.length > 1) {
      console.warn(`⚠️ Found ${clients.length} clients with phone ${normalizedPhone} - using oldest`);
      clients.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    }
    
    let client = clients[0] || null;
    if (!client) {
      client = await base44.asServiceRole.entities.Client.create({
        company_id,
        phone: normalizedPhone,  // Store normalized phone
        current_balance: 0,
        total_earned: 0,
        total_redeemed: 0,
      });
      console.log(`✅ Created new client: ${client.id} with phone ${normalizedPhone}`);
    } else {
      console.log(`✅ Found existing client: ${client.id} with phone ${normalizedPhone}`);
    }

    // Create Transaction record
    const transaction = await base44.asServiceRole.entities.Transaction.create({
      company_id,
      branch_id,
      client_id: client.id,
      client_phone: phone,
      order_id: pos_transaction_id,
      hash_key: pos_transaction_id,
      amount: parsedAmount,
      tokens_expected: tokens,
      token_symbol: companyToken?.token_symbol || 'PTS',
      status: 'pending',
      sms_status: 'pending',
      network: networkName,
      metadata: {
        reward_type: 'token',
        queued_at: new Date().toISOString(),
        source: 'earnPoints'
      }
    });

    console.log(`✅ Transaction created: ${transaction.id} | ${tokens} ${companyToken?.token_symbol || 'PTS'} for ${phone}`);

    // Queue reward in RewardQueue
    const rewardJob = await base44.asServiceRole.entities.RewardQueue.create({
      company_id,
      customer_id: client.id,
      transaction_id: transaction.id,
      amount: tokens,
      reward_type: 'token',
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
    });

    console.log(`✅ RewardQueue job created: ${rewardJob.id}`);

    // ✅ PHASE 2: WhatsApp notification REMOVED
    // RewardQueueProcessor will send WhatsApp after blockchain confirmation
    // This ensures customer only receives notification with blockchain proof

    // Audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        company_id,
        action: 'points_earned',
        entity_type: 'Transaction',
        entity_id: transaction.id,
        user_id: user?.id,
        details: {
          branch_id,
          phone,
          amount_spent: parsedAmount,
          points_earned: tokens,
          pos_transaction_id,
          network: networkName,
          flow: 'RewardQueue_auto_send',
          phase: 2,
          whatsapp_timing: 'after_confirmation'
        }
      });
    } catch (auditError) {
      console.warn('Audit log failed (non-blocking):', auditError.message);
    }

    // Trigger RewardQueueProcessor (fire-and-forget)
    base44.asServiceRole.functions.invoke('RewardQueueProcessor', {}).catch(err => {
      console.warn('⚠️ RewardQueueProcessor trigger failed (will run on schedule):', err.message);
    });

    // Save idempotency record
    const responseBody = {
      success: true,
      transaction_id: transaction.id,
      reward_job_id: rewardJob.id,
      tokens,
      token_symbol: companyToken?.token_symbol || 'PTS',
      network: networkName,
      message: `${tokens} ${companyToken?.token_symbol || 'points'} queued for ${phone}. Customer will be notified after blockchain confirmation.`
    };

    await base44.asServiceRole.entities.IdempotencyLog.create({
      idempotency_key: pos_transaction_id,
      endpoint: 'earnPoints',
      company_id,
      response_status: 200,
      response_body: responseBody,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    return Response.json(responseBody);

  } catch (error) {
    console.error('earnPoints error:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});