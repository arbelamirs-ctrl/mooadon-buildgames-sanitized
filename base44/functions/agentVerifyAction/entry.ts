import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * agentVerifyAction — Trust Rail API for AI Agents
 *
 * POST /functions/agentVerifyAction
 * Headers: X-Agent-ID, X-API-Key, X-API-Secret
 * Body: { action_type, company_id, customer_phone, coupon_code?, receipt_id?, amount?, proof_request, metadata? }
 */

const VALID_ACTIONS = ['redeem_coupon', 'earn_points', 'check_balance'];

function agentError(code, message, status = 400) {
  return Response.json({
    success: false,
    verified: false,
    error_code: code,
    error: message,
    trust_rail: 'mooadon-v1',
  }, { status });
}

function computeTrustScore(verificationResult) {
  if (!verificationResult.verified) return 0;
  return 95;
}

function buildProofHash(payload) {
  const data = JSON.stringify(
    Object.keys(payload).sort().reduce((acc, k) => { acc[k] = payload[k]; return acc; }, {})
  );
  return btoa(data).replace(/=/g, '').substring(0, 64);
}

async function handleRedeemCoupon(base44, { company_id, coupon_code, receipt_id, customer_phone, agent_id, proof_request }) {
  if (!coupon_code || !receipt_id) {
    return { success: false, error: 'coupon_code and receipt_id required for redeem_coupon', verified: false };
  }

  const requestRes = await base44.asServiceRole.functions.invoke('requestRedeemVerification', {
    company_id,
    coupon_code,
    receipt_id: receipt_id || `AGENT-${agent_id}-${Date.now()}`,
    source: 'agent',
  });

  const requestData = requestRes.data;

  if (!requestData.success) {
    return {
      success: false,
      verified: false,
      error: requestData.error,
      reason_code: requestData.reason_code || 'request_failed',
    };
  }

  const execRes = await base44.asServiceRole.functions.invoke('executeRedeemVerification', {
    verification_id: requestData.verification_id,
  });

  const execData = execRes.data;

  return {
    success: execData.verified,
    verified: execData.verified,
    verification_id: execData.verification_id,
    reason_code: execData.reason_code,
    proof_hash: proof_request ? execData.proof_hash : undefined,
    on_chain_payload: proof_request ? execData.on_chain_payload : undefined,
    timestamp: execData.timestamp,
    trust_score: computeTrustScore(execData),
  };
}

async function handleEarnPoints(base44, { company_id, customer_phone, amount, receipt_id, agent_id, proof_request }) {
  if (!customer_phone || !amount) {
    return { success: false, error: 'customer_phone and amount required for earn_points', verified: false };
  }

  const txRes = await base44.asServiceRole.functions.invoke('createPOSTransaction', {
    phone: customer_phone,
    amount: parseFloat(amount),
    order_id: receipt_id || `AGENT-${agent_id}-${Date.now()}`,
    company_id,
    source: 'agent',
  });

  const txData = txRes.data;

  if (!txData.success && txData.status !== 'exists') {
    return {
      success: false,
      verified: false,
      error: txData.error || 'Transaction failed',
      reason_code: 'transaction_failed',
    };
  }

  const proof_hash = proof_request
    ? buildProofHash({ action: 'earn_points', company_id, customer_phone, amount, receipt_id, agent_id, timestamp: Date.now() })
    : undefined;

  return {
    success: true,
    verified: true,
    tokens_awarded: txData.tokens,
    receipt_id: txData.receipt_id,
    proof_hash,
    reason_code: 'verified',
    timestamp: Date.now(),
    trust_score: 90,
  };
}

async function handleCheckBalance(base44, { company_id, customer_phone }) {
  if (!customer_phone) {
    return { success: false, error: 'customer_phone required for check_balance', verified: false };
  }

  const clients = await base44.asServiceRole.entities.Client.filter({ company_id, phone: customer_phone });

  if (!clients || clients.length === 0) {
    return {
      success: true, verified: true, customer_found: false,
      balance: 0, level: 'Bronze', reason_code: 'new_customer',
      timestamp: Date.now(), trust_score: 100,
    };
  }

  const client = clients[0];
  return {
    success: true, verified: true, customer_found: true,
    balance: client.current_balance || 0,
    total_earned: client.total_earned || 0,
    level: client.level || 'Bronze',
    segment: client.segment || 'active',
    reason_code: 'balance_retrieved',
    timestamp: Date.now(), trust_score: 100,
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const startTime = Date.now();

  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'POST only' }, { status: 405 });
    }

    const apiKey    = req.headers.get('X-API-Key')    || req.headers.get('x-api-key');
    const apiSecret = req.headers.get('X-API-Secret') || req.headers.get('x-api-secret');
    const agentId   = req.headers.get('X-Agent-ID')   || req.headers.get('x-agent-id') || 'unknown-agent';

    if (!apiKey || !apiSecret) {
      return agentError('MISSING_CREDENTIALS', 'X-API-Key and X-API-Secret headers required', 401);
    }

    const integrations = await base44.asServiceRole.entities.POSIntegration.filter({
      api_key: apiKey,
      api_secret: apiSecret,
      status: 'active',
    });

    if (!integrations || integrations.length === 0) {
      return agentError('INVALID_CREDENTIALS', 'Invalid or inactive API credentials', 401);
    }

    const integration = integrations[0];

    const body = await req.json();
    const {
      action_type,
      company_id,
      customer_phone,
      customer_wallet_address,
      coupon_code,
      receipt_id,
      amount,
      proof_request = true,
      metadata = {},
    } = body;

    if (!action_type || !VALID_ACTIONS.includes(action_type)) {
      return agentError('INVALID_ACTION', `action_type must be one of: ${VALID_ACTIONS.join(', ')}`, 400);
    }

    if (!company_id) {
      return agentError('MISSING_COMPANY', 'company_id is required', 400);
    }

    if (integration.company_id && integration.company_id !== company_id) {
      return agentError('UNAUTHORIZED_COMPANY', 'This API key is not authorized for this company', 403);
    }

    const customer_identifier = customer_phone || customer_wallet_address;
    if (!customer_identifier) {
      return agentError('MISSING_CUSTOMER', 'customer_phone or customer_wallet_address required', 400);
    }

    console.log(`[agentVerifyAction] agent:${agentId} action:${action_type} company:${company_id} customer:${customer_identifier}`);

    base44.asServiceRole.entities.AuditLog.create({
      company_id,
      action: 'agent_action_received',
      entity_type: 'AgentAction',
      entity_id: agentId,
      details: { agent_id: agentId, action_type, customer_identifier, receipt_id, metadata, timestamp: Date.now() },
    }).catch(() => {});

    let result;

    switch (action_type) {
      case 'redeem_coupon':
        result = await handleRedeemCoupon(base44, { company_id, coupon_code, receipt_id, customer_phone: customer_phone || null, agent_id: agentId, proof_request });
        break;
      case 'earn_points':
        result = await handleEarnPoints(base44, { company_id, customer_phone, amount, receipt_id, agent_id: agentId, proof_request });
        break;
      case 'check_balance':
        result = await handleCheckBalance(base44, { company_id, customer_phone, customer_wallet_address, agent_id: agentId });
        break;
      default:
        return agentError('INVALID_ACTION', `Unknown action: ${action_type}`, 400);
    }

    return Response.json({
      ...result,
      agent_id: agentId,
      action_type,
      company_id,
      duration_ms: Date.now() - startTime,
      trust_rail: 'mooadon-v1',
    });

  } catch (error) {
    console.error('[agentVerifyAction] error:', error);
    return Response.json({ error: error.message, trust_rail: 'mooadon-v1' }, { status: 500 });
  }
});