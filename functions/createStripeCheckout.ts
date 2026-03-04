import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.21.0';

const PRICE_IDS = {
  advanced: Deno.env.get('STRIPE_PRICE_ADVANCED') || '',
  pro: Deno.env.get('STRIPE_PRICE_PRO') || ''
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { company_id, plan_tier } = await req.json();
    if (!company_id || !plan_tier) return Response.json({ error: 'company_id and plan_tier required' }, { status: 400 });

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return Response.json({ error: 'Stripe not configured' }, { status: 500 });

    const priceId = PRICE_IDS[plan_tier];
    if (!priceId) return Response.json({ error: `No price configured for tier: ${plan_tier}` }, { status: 400 });

    // Security: verify the user belongs to this company
    const permissions = await base44.asServiceRole.entities.UserPermission.filter({
      user_id: user.id,
      company_id,
      is_active: true
    });
    const isAdmin = user.role === 'admin';
    if (!isAdmin && permissions.length === 0) {
      return Response.json({ error: 'Forbidden: you do not have access to this company' }, { status: 403 });
    }

    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    if (!companies.length) return Response.json({ error: 'Company not found' }, { status: 404 });
    const company = companies[0];

    const stripe = new Stripe(stripeKey);

    // Create or retrieve stripe customer
    let customerId = company.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: company.name,
        metadata: { company_id, user_id: user.id }
      });
      customerId = customer.id;
      await base44.asServiceRole.entities.Company.update(company_id, { stripe_customer_id: customerId });
    }

    const origin = req.headers.get('origin') || 'https://app.base44.com';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/CompanySettings?upgrade=success&tier=${plan_tier}`,
      cancel_url: `${origin}/CompanySettings?upgrade=canceled`,
      metadata: { company_id, plan_tier, user_id: user.id },
      subscription_data: {
        metadata: { company_id, plan_tier }
      }
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('[createStripeCheckout]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});