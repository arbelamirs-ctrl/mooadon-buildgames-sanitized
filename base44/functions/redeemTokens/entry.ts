import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// In-memory rate limiter (5 req/min per clientId)
const rateLimitStore = new Map();

function checkRateLimit(key) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { clientId, tokensToRedeem, idempotencyKey } = await req.json();

    if (!clientId || !tokensToRedeem || typeof tokensToRedeem !== 'number' || tokensToRedeem <= 0) {
      return Response.json({ success: false, error: 'Invalid client ID or token amount' }, { status: 400 });
    }

    // Rate limiting
    if (!checkRateLimit(`redeem:${clientId}`)) {
      return Response.json({ error: 'Too many requests. Try again in 1 minute.' }, { status: 429 });
    }

    // Idempotency
    if (idempotencyKey) {
      const existing = await base44.asServiceRole.entities.Redemption.filter({ idempotency_key: idempotencyKey });
      if (existing.length > 0) {
        return Response.json({ success: true, duplicate: true, redemptionId: existing[0].id, message: 'Already redeemed (idempotent)' });
      }
    }

    const clients = await base44.asServiceRole.entities.Client.filter({ id: clientId });
    if (!clients || clients.length === 0) {
      return Response.json({ success: false, error: 'Client not found' }, { status: 404 });
    }
    const client = clients[0];

    // FIX: IDOR — verify user belongs to the same company as client
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    if (!isAdmin) {
      const permissions = await base44.asServiceRole.entities.UserPermission.filter({
        user_id: user.id,
        company_id: client.company_id,
        is_active: true
      });
      if (permissions.length === 0) {
        return Response.json({ error: 'Forbidden: no access to this client/company' }, { status: 403 });
      }
    }

    if ((client.tokenBalance || 0) < tokensToRedeem) {
      return Response.json({
        success: false,
        error: `Insufficient balance. Available: ${client.tokenBalance || 0}`,
        required: tokensToRedeem
      }, { status: 400 });
    }

    const companyTokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id: client.company_id });
    const activeTokens = companyTokens.filter(t => t.is_active !== false && t.contract_address);
    const companyToken = activeTokens.length > 0 ? activeTokens[activeTokens.length - 1] : companyTokens[companyTokens.length - 1];
    const tokenSymbol = companyToken?.token_symbol || 'tokens';

    const newTokenBalance = (client.tokenBalance || 0) - tokensToRedeem;
    if (newTokenBalance < 0) {
      return Response.json({ success: false, error: 'Balance invariant violation' }, { status: 400 });
    }

    await base44.asServiceRole.entities.Client.update(clientId, { tokenBalance: newTokenBalance });

    const redemption = await base44.asServiceRole.entities.Redemption.create({
      company_id: client.company_id,
      client_id: clientId,
      item_type: 'exclusive_content',
      item_name: 'Token Redemption',
      item_description: `Redeemed ${tokensToRedeem} ${tokenSymbol}`,
      points_cost: tokensToRedeem,
      status: 'completed',
      idempotency_key: idempotencyKey || null,
      metadata: {
        tokens_redeemed: tokensToRedeem,
        timestamp: new Date().toISOString(),
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {})
      }
    });

    await base44.asServiceRole.entities.LedgerEvent.create({
      company_id: client.company_id,
      client_id: clientId,
      type: 'redeem',
      points: -tokensToRedeem,
      balance_before: client.tokenBalance || 0,
      balance_after: newTokenBalance,
      source: 'client',
      description: `Redeemed ${tokensToRedeem} ${tokenSymbol}`
    });

    return Response.json({
      success: true,
      data: { tokensRedeemed: tokensToRedeem, newBalance: newTokenBalance, redemptionId: redemption.id }
    });

  } catch (error) {
    console.error('Error in redeemTokens:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});