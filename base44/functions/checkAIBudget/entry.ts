import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Check if company has budget for AI feature
 * Returns { allowed: boolean, reason, spend, budget, remaining, reset_date }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { company_id, estimated_cost_usd } = await req.json();
    if (!company_id || estimated_cost_usd === undefined) {
      return Response.json({ error: 'company_id and estimated_cost_usd required' }, { status: 400 });
    }

    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    if (!companies.length) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    const company = companies[0];
    
    // Check if company has paid AI plan (Advanced or Pro)
    const planTier = company.plan_tier || 'basic';
    const planStatus = company.plan_status || 'active';
    const hasAIPlan = (planTier === 'advanced' || planTier === 'pro') && 
                      (planStatus === 'active' || planStatus === 'trial');
    
    // Only allow AI if on Advanced/Pro plan
    if (!hasAIPlan) {
      return Response.json({
        allowed: false,
        reason: 'no_ai_plan',
        message: `AI features require Advanced or Pro plan (current: ${planTier})`,
        current_spend: 0,
        estimated_cost: estimated_cost_usd,
        new_spend: estimated_cost_usd,
        budget: 0,
        remaining: 0,
        reset_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        company_id
      });
    }
    
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const resetAt = company.ai_budget_reset_at ? new Date(company.ai_budget_reset_at) : monthStart;

    // Reset if month has changed
    let spend = company.ai_spend_usd_month_to_date || 0;
    let needsReset = false;

    if (resetAt < monthStart) {
      spend = 0;
      needsReset = true;
    }

    // Set budget to $10/month for paid plans
    const budget = 10;
    const newSpend = spend + estimated_cost_usd;
    const remaining = Math.max(0, budget - newSpend);
    const allowed = newSpend <= budget;

    if (needsReset) {
      await base44.asServiceRole.entities.Company.update(company_id, {
        ai_spend_usd_month_to_date: estimated_cost_usd,
        ai_budget_reset_at: monthStart.toISOString(),
        ai_budget_status: allowed ? 'active' : 'exceeded'
      });
    }

    console.log(`[checkAIBudget] company:${company_id} spend:$${spend.toFixed(2)} + $${estimated_cost_usd.toFixed(2)} = $${newSpend.toFixed(2)}/$${budget} allowed:${allowed}`);

    return Response.json({
      allowed,
      reason: allowed ? 'within_budget' : 'would_exceed',
      current_spend: spend,
      estimated_cost: estimated_cost_usd,
      new_spend: newSpend,
      budget,
      remaining,
      reset_date: monthStart.toISOString(),
      company_id
    });

  } catch (error) {
    console.error('[checkAIBudget] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});