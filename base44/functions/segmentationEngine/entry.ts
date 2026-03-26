import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * segmentationEngine — Customer Segmentation Engine for Mooadon
 *
 * Calculates segment + churn_score for each client and writes back to DB.
 * Should run as a scheduled job (daily) OR be invoked on-demand per company.
 *
 * POST /functions/segmentationEngine
 * Body: { company_id: "...", mode: "full" | "single", client_id?: "..." }
 */

const THRESHOLDS = {
  NEW_DAYS: 30,
  ACTIVE_DAYS: 30,
  CHURN_RISK_MIN_DAYS: 21,
  CHURN_RISK_MAX_DAYS: 60,
  DORMANT_DAYS: 60,
  VIP_EARNED_THRESHOLD: 5000,
  VIP_TOP_PERCENT: 0.10,
  TOKEN_HEAVY_MULTIPLIER: 5,
  BIRTHDAY_WINDOW_DAYS: 7,
  MIN_TRANSACTIONS_FOR_CHURN: 2,
};

function checkBirthdayWindow(birthDate, windowDays) {
  if (!birthDate) return false;
  try {
    const now = new Date();
    const bday = new Date(birthDate);
    const thisYearBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
    if (thisYearBday < now) thisYearBday.setFullYear(now.getFullYear() + 1);
    const daysUntil = (thisYearBday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntil >= 0 && daysUntil <= windowDays;
  } catch {
    return false;
  }
}

function computeLevel(totalEarned) {
  if (totalEarned >= 10001) return 'Gold';
  if (totalEarned >= 1001) return 'Silver';
  return 'Bronze';
}

function computeCompanyStats(clients, transactions) {
  const totalBalances = clients.map(c => c.current_balance || 0);
  const avgBalance = totalBalances.length > 0
    ? totalBalances.reduce((s, b) => s + b, 0) / totalBalances.length
    : 0;

  const sortedEarned = clients.map(c => c.total_earned || 0).sort((a, b) => b - a);
  const vipIndex = Math.floor(sortedEarned.length * THRESHOLDS.VIP_TOP_PERCENT);
  const vipSpendThreshold = sortedEarned[vipIndex] || THRESHOLDS.VIP_EARNED_THRESHOLD;

  return { avgBalance, vipSpendThreshold };
}

function getRecommendedOffer(segment, churnScore, balance, inBirthdayWindow) {
  if (inBirthdayWindow) return 'birthday_bonus';
  switch (segment) {
    case 'vip': return 'vip_exclusive_offer';
    case 'churn_risk': return churnScore > 70 ? 'winback_high_value_coupon' : 'winback_reminder_sms';
    case 'dormant': return 'reactivation_coupon_50pct';
    case 'new': return 'welcome_second_purchase_bonus';
    case 'token_heavy': return 'redeem_reminder_push';
    case 'coupon_abuser': return 'none';
    case 'birthday_window': return 'birthday_bonus';
    case 'active':
    default: return balance > 200 ? 'spend_your_tokens_reminder' : 'standard_campaign';
  }
}

function computeClientSegment(client, transactions, redeemedCoupons, companyStats) {
  const now = Date.now();
  const joinedAt = client.created_date ? new Date(client.created_date).getTime() : now;
  const daysSinceJoin = (now - joinedAt) / (1000 * 60 * 60 * 24);

  const sortedTxns = [...transactions].sort(
    (a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
  );
  const lastTxn = sortedTxns[0];
  const daysSinceLastPurchase = lastTxn
    ? (now - new Date(lastTxn.created_date).getTime()) / (1000 * 60 * 60 * 24)
    : null;

  const txnCount = transactions.length;
  const totalSpent = transactions.reduce((s, t) => s + (t.amount || 0), 0);
  const balance = client.current_balance || 0;
  const totalEarned = client.total_earned || 0;
  const inBirthdayWindow = checkBirthdayWindow(client.birth_date, THRESHOLDS.BIRTHDAY_WINDOW_DAYS);

  // Churn score
  let churnScore = 0;
  if (daysSinceLastPurchase === null) {
    churnScore = daysSinceJoin > 14 ? 70 : 30;
  } else if (daysSinceLastPurchase > THRESHOLDS.DORMANT_DAYS) {
    churnScore = 95;
  } else if (daysSinceLastPurchase > THRESHOLDS.CHURN_RISK_MIN_DAYS) {
    churnScore = Math.min(90, 40 + ((daysSinceLastPurchase - 21) / (60 - 21)) * 50);
  } else if (daysSinceLastPurchase > 14) {
    churnScore = 25;
  } else {
    churnScore = 5;
  }
  if (balance > companyStats.avgBalance * 2) churnScore = Math.max(0, churnScore - 15);
  if (txnCount <= 1) churnScore = Math.min(100, churnScore + 10);
  churnScore = Math.round(churnScore);

  // Segment flags
  const isVip = totalEarned >= THRESHOLDS.VIP_EARNED_THRESHOLD || totalSpent >= companyStats.vipSpendThreshold;
  const couponAbuse = redeemedCoupons.length >= 5 && txnCount > 0 && redeemedCoupons.length / txnCount > 0.7;
  const tokenHeavy = balance > companyStats.avgBalance * THRESHOLDS.TOKEN_HEAVY_MULTIPLIER && balance > 100;
  const isNew = daysSinceJoin < THRESHOLDS.NEW_DAYS && txnCount <= 1;
  const isActive = daysSinceLastPurchase !== null && daysSinceLastPurchase <= THRESHOLDS.ACTIVE_DAYS;
  const isChurnRisk = txnCount >= THRESHOLDS.MIN_TRANSACTIONS_FOR_CHURN &&
    daysSinceLastPurchase !== null &&
    daysSinceLastPurchase > THRESHOLDS.CHURN_RISK_MIN_DAYS &&
    daysSinceLastPurchase <= THRESHOLDS.CHURN_RISK_MAX_DAYS;
  const isDormant = daysSinceLastPurchase === null
    ? daysSinceJoin > THRESHOLDS.DORMANT_DAYS
    : daysSinceLastPurchase > THRESHOLDS.DORMANT_DAYS;

  let segment;
  if (isVip) segment = 'vip';
  else if (couponAbuse) segment = 'coupon_abuser';
  else if (tokenHeavy) segment = 'token_heavy';
  else if (inBirthdayWindow) segment = 'birthday_window';
  else if (isNew) segment = 'new';
  else if (isActive) segment = 'active';
  else if (isChurnRisk) segment = 'churn_risk';
  else if (isDormant) segment = 'dormant';
  else segment = 'active';

  const recommended_offer = getRecommendedOffer(segment, churnScore, balance, inBirthdayWindow);
  return { segment, churn_score: churnScore, recommended_offer };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'POST only' }, { status: 405 });
    }

    // Auth: service token OR admin user
    const serviceToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
    const authHeader = req.headers.get('authorization') || '';
    const isServiceCall = serviceToken && authHeader === `Bearer ${serviceToken}`;

    if (!isServiceCall) {
      try {
        const user = await base44.auth.me();
        if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
          return Response.json({ error: 'Forbidden: admin or service token required' }, { status: 403 });
        }
      } catch {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json();
    const { company_id, mode = 'full', client_id } = body;

    if (!company_id) {
      return Response.json({ error: 'company_id is required' }, { status: 400 });
    }

    const startTime = Date.now();
    console.log(`[segmentationEngine] START company:${company_id} mode:${mode}`);

    // Fetch clients
    let clients;
    if (mode === 'single' && client_id) {
      clients = await base44.asServiceRole.entities.Client.filter({ id: client_id, company_id });
    } else {
      clients = await base44.asServiceRole.entities.Client.filter({ company_id });
    }

    if (!clients || clients.length === 0) {
      return Response.json({ success: true, processed: 0, message: 'No clients found' });
    }

    // Fetch transactions and coupons
    const [transactions, coupons] = await Promise.all([
      base44.asServiceRole.entities.Transaction.filter({ company_id, status: 'completed' }),
      base44.asServiceRole.entities.Coupon.filter({ company_id }),
    ]);

    const companyStats = computeCompanyStats(clients, transactions);

    let processed = 0;
    let updated = 0;
    const segmentCounts = {};

    for (const client of clients) {
      const clientTxns = transactions.filter(t => t.client_id === client.id);
      const clientCoupons = coupons.filter(c => c.client_phone === client.phone && c.status === 'redeemed');

      const result = computeClientSegment(client, clientTxns, clientCoupons, companyStats);

      const hasChanged =
        client.segment !== result.segment ||
        client.churn_score !== result.churn_score ||
        client.recommended_offer !== result.recommended_offer;

      if (hasChanged) {
        await base44.asServiceRole.entities.Client.update(client.id, {
          segment: result.segment,
          churn_score: result.churn_score,
          recommended_offer: result.recommended_offer,
          last_ai_analysis_at: new Date().toISOString(),
          level: computeLevel(client.total_earned || 0),
        });
        updated++;
      }

      segmentCounts[result.segment] = (segmentCounts[result.segment] || 0) + 1;
      processed++;
    }

    const duration = Date.now() - startTime;
    console.log(`[segmentationEngine] DONE company:${company_id} processed:${processed} updated:${updated} ${duration}ms segments:${JSON.stringify(segmentCounts)}`);

    return Response.json({
      success: true,
      company_id,
      processed,
      updated,
      duration_ms: duration,
      segment_distribution: segmentCounts,
    });
  } catch (error) {
    console.error('[segmentationEngine] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});