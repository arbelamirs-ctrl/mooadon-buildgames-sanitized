import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Rate limiting map - in-memory (resets on deploy)
const claimRateMap = new Map();

// ── Phone normalization (mirrors createPOSTransaction.ts) ───────────────────
function normalizePhone(phone) {
  if (!phone) return '';
  let n = phone.trim().replace(/[\s\-\(\)]/g, '');
  if (!n.startsWith('+')) {
    n = n.startsWith('0') ? '+972' + n.substring(1) : '+' + n;
  }
  return n;
}
// ─────────────────────────────────────────────────────────────────────────────

function getExplorerUrl(txHash, chain) {
  const explorerMap = {
    'avalanche_fuji': 'https://testnet.snowtrace.io/tx/',
    'avalanche': 'https://snowtrace.io/tx/',
    'ethereum': 'https://etherscan.io/tx/',
    'polygon': 'https://polygonscan.com/tx/',
    'bsc': 'https://bscscan.com/tx/'
  };
  const baseUrl = explorerMap[chain] || 'https://testnet.snowtrace.io/tx/';
  return `${baseUrl}${txHash}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const base44 = createClientFromRequest(req);

    // Parse request
    const body = await req.json();
    const { claim_token, user_wallet } = body;

    // ── Rate limit check ────────────────────────────────────────────────────
    const rl = claimRateMap.get(claim_token) || { count: 0, resetAt: Date.now() + 300_000 };
    if (Date.now() > rl.resetAt) { rl.count = 0; rl.resetAt = Date.now() + 300_000; }
    if (rl.count >= 5) {
      return Response.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
    }
    rl.count++;
    claimRateMap.set(claim_token, rl);

    if (!claim_token || !user_wallet) {
      return Response.json({
        success: false,
        error: 'Missing required fields: claim_token, user_wallet'
      }, { status: 400 });
    }

    // Validate wallet format (basic check)
    if (!user_wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      return Response.json({
        success: false,
        error: 'Invalid wallet address format'
      }, { status: 400 });
    }

    // Find PendingReward by claim_token
    const rewards = await base44.asServiceRole.entities.PendingReward.filter({
      claim_token
    });

    if (rewards.length === 0) {
      return Response.json({
        success: false,
        error: 'Claim token not found'
      }, { status: 404 });
    }

    const reward = rewards[0];

    // If already claimed, return existing tx_hash
    if (reward.status === 'claimed') {
      const company = await base44.asServiceRole.entities.Company.filter({ id: reward.company_id });
      const chain = company[0]?.wallet_chain || 'avalanche_fuji';
      return Response.json({
        success: true,
        message: 'Already claimed',
        tx_hash: reward.tx_hash,
        tokens: reward.points,
        explorer_url: reward.tx_hash ? getExplorerUrl(reward.tx_hash, chain) : null
      });
    }

    // Check if expired
    if (reward.status === 'expired' || (reward.expires_at && new Date() > new Date(reward.expires_at))) {
      await base44.asServiceRole.entities.PendingReward.update(reward.id, {
        status: 'expired'
      });
      return Response.json({
        success: false,
        error: 'Claim token expired'
      }, { status: 410 });
    }

    // Check if in invalid state
    if (reward.status === 'failed_permanent') {
      return Response.json({
        success: false,
        error: 'This reward failed permanently. Please contact support.'
      }, { status: 400 });
    }

    // Atomically set status to 'processing'
    try {
      await base44.asServiceRole.entities.PendingReward.update(reward.id, {
        status: 'processing',
        user_wallet: user_wallet
      });
    } catch (updateError) {
      console.warn('Failed to update status to processing:', updateError.message);
      return Response.json({
        success: false,
        error: 'Processing state update failed'
      }, { status: 500 });
    }

    // Fetch company and token
    const companies = await base44.asServiceRole.entities.Company.filter({ id: reward.company_id });
    if (companies.length === 0) {
      await base44.asServiceRole.entities.PendingReward.update(reward.id, { status: 'failed' });
      return Response.json({ success: false, error: 'Company not found' }, { status: 404 });
    }
    const company = companies[0];
    const chain = company.wallet_chain || 'avalanche_fuji';

    // FIX: Normalize phone before searching
    const normalizedPhone = normalizePhone(reward.client_phone);
    console.log(`📞 Phone normalization: "${reward.client_phone}" → "${normalizedPhone}"`);

    // Fetch or create client
    let clients = await base44.asServiceRole.entities.Client.filter({
      company_id: reward.company_id,
      phone: normalizedPhone
    });

    // FIX: Deterministic selection - always pick oldest client
    if (clients && clients.length > 1) {
      console.warn(`⚠️ Found ${clients.length} clients with phone ${normalizedPhone} - using oldest`);
      clients.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    }

    let client;
    if (clients.length === 0) {
      client = await base44.asServiceRole.entities.Client.create({
        company_id: reward.company_id,
        phone: normalizedPhone,
        wallet_address: user_wallet,
        wallet_chain: chain,
        current_balance: reward.points,
        total_earned: reward.points
      });
      console.log(`✅ Created new client: ${client.id}`);
    } else {
      client = clients[0];
      console.log(`✅ Found existing client: ${client.id}`);
      // Update wallet if not already set
      if (!client.wallet_address) {
        await base44.asServiceRole.entities.Client.update(client.id, {
          wallet_address: user_wallet,
          wallet_chain: chain
        });
      }
    }

    // Call claimRewardIntent to handle blockchain transfer
    try {
      const claimResult = await base44.asServiceRole.functions.invoke('claimRewardIntent', {
        intent_id: reward.id,
        user_wallet: user_wallet,
        company_id: reward.company_id,
        points: reward.points,
        client_id: client.id
      });

      if (!claimResult.data?.success) {
        throw new Error(claimResult.data?.error || 'Claim failed');
      }

      const txHash = claimResult.data.tx_hash;

      // Update PendingReward to claimed
      await base44.asServiceRole.entities.PendingReward.update(reward.id, {
        status: 'claimed',
        tx_hash: txHash,
        client_id: client.id
      });

      // Update Client balance
      await base44.asServiceRole.entities.Client.update(client.id, {
        current_balance: (client.current_balance || 0) + reward.points,
        total_earned: (client.total_earned || 0) + reward.points
      });

      // Create Transaction record (for Transactions page visibility)
      try {
        const claimHash = `CLAIM-${reward.id}-${Date.now()}`;
        await base44.asServiceRole.entities.Transaction.create({
          company_id: reward.company_id,
          branch_id: null,
          client_id: client.id,
          client_phone: normalizedPhone,
          order_id: claimHash,
          hash_key: claimHash,
          amount: reward.amount_spent || 0,
          tokens_expected: reward.points,
          tokens_actual: reward.points,
          token_symbol: company.points_name || 'pts',
          status: 'completed',
          claim_token: reward.claim_token,
          blockchain_tx_hash: txHash,
          claimed_at: new Date().toISOString(),
          metadata: {
            source: 'reward_claim',
            pending_reward_id: reward.id,
            user_wallet: user_wallet
          }
        });
      } catch (txError) {
        console.warn('Transaction record creation failed (non-critical):', txError.message);
      }

      // Audit log
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          company_id: reward.company_id,
          action: 'points_claimed',
          entity_type: 'PendingReward',
          entity_id: reward.id,
          performed_by: client.id,
          details: {
            user_wallet,
            points: reward.points,
            tx_hash: txHash,
            timestamp: new Date().toISOString()
          }
        });
      } catch (auditError) {
        console.warn('Audit log failed:', auditError.message);
      }

      return Response.json({
        success: true,
        tx_hash: txHash,
        tokens: reward.points,
        explorer_url: getExplorerUrl(txHash, chain)
      });

    } catch (claimError) {
      console.error('claimRewardIntent failed:', claimError.message);

      // Mark as failed
      await base44.asServiceRole.entities.PendingReward.update(reward.id, {
        status: 'failed',
        error_message: claimError.message,
        retry_count: (reward.retry_count || 0) + 1,
        last_retry_at: new Date().toISOString()
      });

      return Response.json({
        success: false,
        error: 'Failed to claim tokens. Will retry automatically.'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('claimPoints error:', error.message);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
});