/**
 * Quota Checker & Kite Payment Gateway
 * Validates plan quota and initiates Kite payment for overages
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { v4 as uuidv4 } from 'npm:uuid@9.0.0';

// Plan quotas (generations per day)
const PLAN_QUOTAS = {
  basic: { campaign_generate: 0, image_creative: 0, video_creative: 0 },
  advanced: { campaign_generate: 5, image_creative: 10, video_creative: 0 },
  pro: { campaign_generate: 20, image_creative: 50, video_creative: 5 },
};

// Cost per unit (USD)
const UNIT_COSTS = {
  campaign_generate: 0.50,
  image_creative: 0.20,
  video_creative: 2.00,
};

export async function checkQuotaAndGetPaymentRequest(req, {
  companyId,
  feature,
  planTier = 'basic',
  merchantEmail,
  redirectBaseUrl,
}) {
  try {
    const base44 = createClientFromRequest(req);

    if (!companyId || !feature) {
      return {
        withinQuota: false,
        error: 'Missing companyId or feature',
        requiresPayment: false,
      };
    }

    const quota = PLAN_QUOTAS[planTier]?.[feature] || 0;
    const costPerUnit = UNIT_COSTS[feature] || 0;

    // Check today's usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayUsage = await base44.entities.UsageLedger.filter({
      company_id: companyId,
      feature,
      status: 'paid',
    });

    const usedToday = todayUsage
      .filter(u => {
        const ts = new Date(u.timestamp);
        return ts >= today && ts < tomorrow;
      })
      .reduce((sum, u) => sum + (u.units || 1), 0);

    const withinQuota = usedToday < quota;

    if (withinQuota) {
      return {
        withinQuota: true,
        requiresPayment: false,
        usedToday,
        quotaRemaining: quota - usedToday,
      };
    }

    // Over quota - initiate Kite payment
    const usageId = uuidv4();
    const cost = costPerUnit * 1;

    const successUrl = `${redirectBaseUrl}/payment-success?usageId=${usageId}&feature=${feature}`;
    const cancelUrl = `${redirectBaseUrl}/payment-cancel?usageId=${usageId}`;

    // Create Kite payment request via backend function
    const paymentRes = await base44.asServiceRole.functions.invoke('createKitePaymentRequest', {
      companyId,
      feature,
      units: 1,
      usdCostEstimate: cost,
      usageId,
      featureContext: {
        planTier,
        quotaExceeded: true,
        usedToday,
        quotaLimit: quota,
      },
      merchantEmail,
      successCallbackUrl: successUrl,
      cancelCallbackUrl: cancelUrl,
    });

    if (!paymentRes.success) {
      return {
        withinQuota: false,
        requiresPayment: true,
        error: 'Failed to create payment request',
        paymentInitiated: false,
      };
    }

    return {
      withinQuota: false,
      requiresPayment: true,
      usedToday,
      quotaLimit: quota,
      costPerUnit,
      estimatedCost: cost,
      paymentUrl: paymentRes.paymentUrl,
      paymentId: paymentRes.paymentId,
      usageId,
      expiresAt: paymentRes.expiresAt,
    };
  } catch (error) {
    console.error('Quota check error:', error);
    return {
      withinQuota: false,
      error: error.message,
      requiresPayment: false,
    };
  }
}

export async function confirmPaymentAndProceed(req, { paymentId, companyId, usageId, onApproved }) {
  try {
    const base44 = createClientFromRequest(req);

    // Check payment status via Kite adapter
    const statusRes = await base44.asServiceRole.functions.invoke('confirmAndExecutePayment', {
      paymentId,
      companyId,
      usageId,
    });

    if (!statusRes.success) {
      return {
        success: false,
        error: statusRes.error || 'Payment confirmation failed',
      };
    }

    // Payment confirmed - now safe to proceed with AI job
    if (onApproved && typeof onApproved === 'function') {
      return await onApproved();
    }

    return {
      success: true,
      message: 'Payment confirmed, ready to execute AI feature',
    };
  } catch (error) {
    console.error('Payment confirmation error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}