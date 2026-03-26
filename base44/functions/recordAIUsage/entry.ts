import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Record AI usage after successful generation
 * Updates company spend and logs to UsageLedger
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { company_id, feature, cost_usd, usage_id, context = {} } = await req.json();
    if (!company_id || !feature || cost_usd === undefined || !usage_id) {
      return Response.json({ error: 'company_id, feature, cost_usd, usage_id required' }, { status: 400 });
    }

    // Update company spend
    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    if (!companies.length) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    const company = companies[0];
    const currentSpend = company.ai_spend_usd_month_to_date || 0;
    const newSpend = currentSpend + cost_usd;
    const budget = company.ai_budget_usd_monthly || 100;

    await base44.asServiceRole.entities.Company.update(company_id, {
      ai_spend_usd_month_to_date: newSpend,
      ai_budget_status: newSpend > budget ? 'exceeded' : 'active'
    });

    // Log to UsageLedger
    await base44.asServiceRole.entities.UsageLedger.create({
      company_id,
      feature,
      units: 1,
      status: 'quota',
      usd_cost_estimate: cost_usd,
      usage_id,
      feature_context: JSON.stringify(context),
      timestamp: new Date().toISOString()
    }).catch(err => console.warn('[recordAIUsage] UsageLedger log failed:', err.message));

    console.log(`[recordAIUsage] company:${company_id} feature:${feature} cost:$${cost_usd.toFixed(4)} new_spend:$${newSpend.toFixed(2)}/$${budget}`);

    return Response.json({
      success: true,
      company_id,
      feature,
      cost_usd,
      new_spend: newSpend,
      budget,
      status: newSpend > budget ? 'exceeded' : 'active'
    });

  } catch (error) {
    console.error('[recordAIUsage] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});