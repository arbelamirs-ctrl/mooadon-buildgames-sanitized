import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.21.0';

Deno.serve(async (req) => {
  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!stripeKey) return Response.json({ error: 'Stripe not configured' }, { status: 500 });

    const stripe = new Stripe(stripeKey);
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    let event;
    if (webhookSecret && signature) {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } else {
      event = JSON.parse(body);
    }

    const base44 = createClientFromRequest(req);

    const getCompanyId = (obj) => obj?.metadata?.company_id || obj?.subscription_data?.metadata?.company_id;
    const getPlanTier = (obj) => obj?.metadata?.plan_tier;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const company_id = getCompanyId(session);
        const plan_tier = getPlanTier(session);
        if (!company_id || !plan_tier) break;

        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await base44.asServiceRole.entities.Company.update(company_id, {
          plan_tier,
          plan_status: 'active',
          plan_expires_at: expiresAt,
          stripe_subscription_id: session.subscription || null
        });
        console.log(`[stripeWebhook] checkout.session.completed → company ${company_id} → ${plan_tier}`);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        const company_id = sub?.metadata?.company_id;
        const plan_tier = sub?.metadata?.plan_tier;
        if (!company_id) break;

        const expiresAt = new Date(sub.current_period_end * 1000).toISOString();
        await base44.asServiceRole.entities.Company.update(company_id, {
          plan_status: 'active',
          plan_tier: plan_tier || undefined,
          plan_expires_at: expiresAt
        });
        console.log(`[stripeWebhook] invoice.paid → company ${company_id} renewed`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        const company_id = sub?.metadata?.company_id;
        if (!company_id) break;

        await base44.asServiceRole.entities.Company.update(company_id, { plan_status: 'past_due' });
        console.log(`[stripeWebhook] invoice.payment_failed → company ${company_id} → past_due`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const company_id = sub?.metadata?.company_id;
        const plan_tier = sub?.metadata?.plan_tier;
        if (!company_id) break;

        const status = sub.status; // active, past_due, canceled, etc.
        const planStatus = status === 'active' ? 'active' : status === 'past_due' ? 'past_due' : 'canceled';
        const expiresAt = new Date(sub.current_period_end * 1000).toISOString();

        await base44.asServiceRole.entities.Company.update(company_id, {
          plan_status: planStatus,
          ...(plan_tier ? { plan_tier } : {}),
          plan_expires_at: expiresAt
        });
        console.log(`[stripeWebhook] subscription.updated → company ${company_id} → status=${planStatus} tier=${plan_tier}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const company_id = sub?.metadata?.company_id;
        if (!company_id) break;

        await base44.asServiceRole.entities.Company.update(company_id, {
          plan_status: 'canceled',
          plan_tier: 'basic'
        });
        console.log(`[stripeWebhook] subscription.deleted → company ${company_id} → basic`);
        break;
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('[stripeWebhook] error:', error.message);
    return Response.json({ error: error.message }, { status: 400 });
  }
});