import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function dateOnly(date) {
  return date.toISOString().split('T')[0];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (user && user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    let body = {};
    try { if (req.method === 'POST') { const t = await req.text(); if (t) body = JSON.parse(t); } } catch (_) {}
    const periodDate = body.period_date || dateOnly(new Date());

    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodDate)) {
      return Response.json({ success: false, error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.SettlementPeriod.filter({ period_date: periodDate });
    let period;
    if (existing.length > 0) {
      period = existing[0];
      if (['calculating', 'ready', 'settling', 'settled'].includes(period.status)) {
        const lines = await base44.asServiceRole.entities.SettlementLine.filter({ period_id: period.id });
        return Response.json({ success: true, message: 'Period already calculated', period_id: period.id, lines_count: lines.length, status: period.status });
      }
    } else {
      period = await base44.asServiceRole.entities.SettlementPeriod.create({
        period_date: periodDate,
        status: 'open',
        opened_at: new Date().toISOString()
      });
    }

    await base44.asServiceRole.entities.SettlementPeriod.update(period.id, {
      status: 'calculating',
      calculation_started_at: new Date().toISOString()
    });

    const periodStart = new Date(`${periodDate}T00:00:00Z`);
    const periodEnd = new Date(`${periodDate}T23:59:59Z`);

    const companies = await base44.asServiceRole.entities.Company.filter({});
    const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]));

    const activityLines = [];

    const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 500);
    for (const tx of transactions) {
      const txDate = tx.claimed_at || tx.created_date;
      if (!txDate || txDate < periodStart.toISOString() || txDate > periodEnd.toISOString()) continue;
      if (!['completed', 'claimed'].includes(tx.status)) continue;
      if (!tx.company_id) continue;
      activityLines.push({
        company_id: tx.company_id,
        type: 'POS Transaction',
        amount: tx.tokens_actual || tx.tokens_expected || 0,
        description: `POS - Client: ${tx.client_phone || 'unknown'}, Amount: $${tx.amount || 0}`,
        ref_id: tx.id
      });
    }

    const purchases = await base44.asServiceRole.entities.Purchase.list('-created_date', 500);
    for (const p of purchases) {
      if (!p.created_date || p.created_date < periodStart.toISOString() || p.created_date > periodEnd.toISOString()) continue;
      if (p.status !== 'completed') continue;
      if (!p.company_id) continue;
      activityLines.push({
        company_id: p.company_id,
        type: 'Store Purchase',
        amount: p.tokens_spent || 0,
        description: `Store - ${p.product_name} x${p.quantity || 1}`,
        ref_id: p.id
      });
    }

    const redemptions = await base44.asServiceRole.entities.Redemption.list('-created_date', 500);
    for (const r of redemptions) {
      if (!r.created_date || r.created_date < periodStart.toISOString() || r.created_date > periodEnd.toISOString()) continue;
      if (r.status !== 'completed') continue;
      if (!r.company_id) continue;
      activityLines.push({
        company_id: r.company_id,
        type: 'Reward Redemption',
        amount: r.points_cost || 0,
        description: `Reward - ${r.item_name}`,
        ref_id: r.id
      });
    }

    const spendSessions = await base44.asServiceRole.entities.SpendSession.list('-created_date', 500);
    for (const s of spendSessions) {
      if (!s.created_date || s.created_date < periodStart.toISOString() || s.created_date > periodEnd.toISOString()) continue;
      if (s.status !== 'captured') continue;
      if (!s.company_id) continue;
      activityLines.push({
        company_id: s.company_id,
        type: 'Spend QR',
        amount: s.capture_amount || 0,
        description: `Spend QR - Client: ${s.client_phone || 'unknown'}`,
        ref_id: s.id
      });
    }

    const companyTotals = new Map();
    for (const line of activityLines) {
      if (!companyTotals.has(line.company_id)) {
        companyTotals.set(line.company_id, { pos: 0, store: 0, rewards: 0, spend: 0, total: 0, breakdown: [] });
      }
      const entry = companyTotals.get(line.company_id);
      if (line.type === 'POS Transaction') entry.pos += line.amount;
      else if (line.type === 'Store Purchase') entry.store += line.amount;
      else if (line.type === 'Reward Redemption') entry.rewards += line.amount;
      else if (line.type === 'Spend QR') entry.spend += line.amount;
      entry.total += line.amount;
      entry.breakdown.push(line);
    }

    const lines = [];
    let totalNetTransfers = 0;

    for (const [companyId, totals] of companyTotals.entries()) {
      if (totals.total <= 0) continue;
      const line = await base44.asServiceRole.entities.SettlementLine.create({
        period_id: period.id,
        from_company_id: companyId,
        from_company_name: companyMap[companyId] || companyId,
        to_company_id: 'platform',
        to_company_name: 'Platform',
        gross_debits: totals.total,
        gross_credits: 0,
        net_amount: totals.total,
        direction: 'from_owes_to',
        status: 'pending',
        metadata: {
          pos_tokens: totals.pos,
          store_tokens: totals.store,
          reward_tokens: totals.rewards,
          spend_tokens: totals.spend,
          activity_count: totals.breakdown.length
        }
      });
      lines.push(line);
      totalNetTransfers += totals.total;
    }

    const calcEnd = new Date();
    await base44.asServiceRole.entities.SettlementPeriod.update(period.id, {
      status: lines.length > 0 ? 'ready' : 'settled',
      calculation_completed_at: calcEnd.toISOString(),
      total_lines: lines.length,
      total_net_transfers: totalNetTransfers
    });

    try {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'settlement_calculated',
        entity_type: 'SettlementPeriod',
        entity_id: period.id,
        performed_by: user?.email || 'scheduler',
        details: {
          period_date: periodDate,
          lines_count: lines.length,
          total_transfers: totalNetTransfers,
          activity_lines: activityLines.length,
          timestamp: calcEnd.toISOString()
        }
      });
    } catch (e) {
      console.warn('Audit log failed:', e.message);
    }

    return Response.json({
      success: true,
      period_id: period.id,
      period_date: periodDate,
      lines_count: lines.length,
      total_net_transfers: totalNetTransfers,
      activity_count: activityLines.length,
      status: lines.length > 0 ? 'ready' : 'settled'
    });

  } catch (error) {
    console.error('settlementCalculate error:', error.message);
    return Response.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
});