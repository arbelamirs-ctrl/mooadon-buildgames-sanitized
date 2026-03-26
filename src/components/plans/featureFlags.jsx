/**
 * Feature flags — single source of truth for plan-based gating.
 * Usage: hasFeature(company, 'ai_campaigns')
 */

export const PLAN_FEATURES = {
  basic:    ['tokens', 'coupons'],
  advanced: ['tokens', 'coupons', 'store'],
  pro:      ['tokens', 'coupons', 'store', 'ai_campaigns', 'scheduler', 'crm_send', 'roi_dashboard', 'brand_voice', 'ab_testing'],
  trial:    ['tokens', 'coupons', 'store', 'scheduler', 'crm_send', 'roi_dashboard', 'brand_voice', 'ab_testing'],
};

export const PLAN_LABELS = {
  basic:    'Basic',
  advanced: 'Advanced',
  pro:      'Pro',
  trial:    '7-Day Trial',
};

export const PLAN_PRICES = {
  basic:    { monthly: 0,  label: 'Free' },
  advanced: { monthly: 49, label: '$49/mo' },
  pro:      { monthly: 99, label: '$99/mo' },
};

export const FEATURE_REQUIRED_TIER = {
  tokens: 'basic',
  coupons: 'basic',
  store: 'advanced',
  ai_campaigns: 'pro',
  scheduler: 'pro',
  crm_send: 'pro',
  roi_dashboard: 'pro',
  brand_voice: 'pro',
  ab_testing: 'pro'
};

export const TIER_ORDER = { basic: 0, advanced: 1, pro: 2 };

/**
 * Returns true if the company's plan includes the given feature.
 * System admins always have access to all features.
 */
export function hasFeature(company, feature, isSystemAdmin = false) {
  if (isSystemAdmin) return true;
  if (!company) return false;
  const tier = company.plan_tier || 'basic';
  const status = company.plan_status || 'active';

  // Trial: check expiry
  if (tier === 'trial' || status === 'trial') {
    if (company.trial_ends_at && new Date(company.trial_ends_at) < new Date()) {
      return (PLAN_FEATURES.basic || []).includes(feature);
    }
    return (PLAN_FEATURES.trial || []).includes(feature);
  }

  const effectiveTier = (status === 'past_due' || status === 'canceled') ? 'basic' : tier;
  const allowed = PLAN_FEATURES[effectiveTier] || PLAN_FEATURES.basic;
  return allowed.includes(feature);
}

export function getEffectiveTier(company) {
  if (!company) return 'basic';
  const tier = company.plan_tier || 'basic';
  const status = company.plan_status || 'active';
  if (tier === 'trial' || status === 'trial') {
    if (company.trial_ends_at && new Date(company.trial_ends_at) < new Date()) return 'basic';
    return 'trial';
  }
  if (status === 'past_due' || status === 'canceled') return 'basic';
  return tier;
}

export function getTierForFeature(feature) {
  return FEATURE_REQUIRED_TIER[feature] || 'pro';
}

export function isTrialExpired(company) {
  if (!company) return false;
  if (company.plan_tier !== 'trial' && company.plan_status !== 'trial') return false;
  return company.trial_ends_at && new Date(company.trial_ends_at) < new Date();
}

export function trialDaysLeft(company) {
  if (!company?.trial_ends_at) return 0;
  const diff = new Date(company.trial_ends_at) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}