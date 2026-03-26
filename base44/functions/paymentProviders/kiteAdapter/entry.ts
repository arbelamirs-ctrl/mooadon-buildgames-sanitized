/**
 * Kite Payment Adapter
 * Handles metered payment requests for AI features exceeding quota
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const KITE_API_BASE = 'https://api.kite.com/v1'; // Replace with actual Kite endpoint
const KITE_API_KEY = Deno.env.get('KITE_API_KEY');

export async function createKitePaymentRequest(req, {
  companyId,
  feature,
  units = 1,
  usdCostEstimate,
  usageId, // Idempotency key
  featureContext = {},
  merchantEmail,
  successCallbackUrl,
  cancelCallbackUrl
}) {
  try {
    const base44 = createClientFromRequest(req);

    if (!KITE_API_KEY) {
      throw new Error('KITE_API_KEY not configured');
    }

    // Validate input
    if (!companyId || !feature || !usageId) {
      throw new Error('Missing required fields: companyId, feature, usageId');
    }

    // Create Kite payment request
    const kitePaymentReq = {
      idempotencyKey: usageId,
      amount: {
        currency: 'USD',
        value: Math.round(usdCostEstimate * 100), // Convert to cents
      },
      metadata: {
        companyId,
        feature,
        units,
        featureContext: JSON.stringify(featureContext),
      },
      description: `AI ${feature} metered usage - ${units} unit(s)`,
      customerEmail: merchantEmail,
      redirectConfig: {
        successUrl: successCallbackUrl,
        cancelUrl: cancelCallbackUrl,
      },
    };

    const kiteResponse = await fetch(`${KITE_API_BASE}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KITE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(kitePaymentReq),
    });

    if (!kiteResponse.ok) {
      const errorData = await kiteResponse.json();
      throw new Error(`Kite API error: ${errorData.message || kiteResponse.statusText}`);
    }

    const kiteData = await kiteResponse.json();

    // Create UsageLedger record
    const usageLedger = await base44.entities.UsageLedger.create({
      company_id: companyId,
      feature,
      units,
      status: 'payment_required',
      usd_cost_estimate: usdCostEstimate,
      payment_provider: 'kite',
      payment_tx_id: kiteData.id,
      usage_id: usageId,
      feature_context: JSON.stringify(featureContext),
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      paymentId: kiteData.id,
      paymentUrl: kiteData.paymentUrl,
      usageLedgerId: usageLedger.id,
      expiresAt: kiteData.expiresAt,
    };
  } catch (error) {
    console.error('Kite payment request error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function checkKitePaymentStatus(req, { paymentId, companyId, usageId }) {
  try {
    const base44 = createClientFromRequest(req);

    if (!KITE_API_KEY) {
      throw new Error('KITE_API_KEY not configured');
    }

    const kiteResponse = await fetch(`${KITE_API_BASE}/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${KITE_API_KEY}`,
      },
    });

    if (!kiteResponse.ok) {
      throw new Error('Failed to fetch payment status from Kite');
    }

    const kiteData = await kiteResponse.json();
    const isPaid = kiteData.status === 'completed' || kiteData.status === 'succeeded';

    // Update UsageLedger if payment was successful
    if (isPaid) {
      const usageLedgers = await base44.entities.UsageLedger.filter({
        usage_id: usageId,
        company_id: companyId,
      });

      if (usageLedgers.length > 0) {
        const ledger = usageLedgers[0];
        await base44.entities.UsageLedger.update(ledger.id, {
          status: 'paid',
          payment_tx_id: paymentId,
          paid_at: new Date().toISOString(),
        });

        // Create AuditLog for paid usage
        const context = JSON.parse(ledger.feature_context || '{}');
        await base44.entities.AuditLog.create({
          company_id: companyId,
          event_type: 'ai_usage_paid',
          resource_type: 'ai_feature',
          action: 'metered_payment_processed',
          metadata: {
            feature: ledger.feature,
            units: ledger.units,
            cost_usd: ledger.usd_cost_estimate,
            payment_provider: 'kite',
            kite_payment_tx_id: paymentId,
            ...context,
          },
        });
      }
    }

    return {
      success: true,
      isPaid,
      status: kiteData.status,
    };
  } catch (error) {
    console.error('Kite payment status check error:', error);
    return {
      success: false,
      error: error.message,
      isPaid: false,
    };
  }
}

export async function confirmAndExecutePayment(req, { paymentId, companyId, usageId }) {
  const { isPaid, success } = await checkKitePaymentStatus(req, { paymentId, companyId, usageId });

  if (!success || !isPaid) {
    return {
      success: false,
      error: 'Payment not confirmed',
    };
  }

  return {
    success: true,
    message: 'Payment confirmed, ready to proceed with AI feature',
  };
}