import { useState, useCallback } from 'react';
import { hasFeature, getTierForFeature, getEffectiveTier } from './featureFlags';
import { isSystemAdmin } from '@/components/constants/adminConfig';

/**
 * Hook for feature gating.
 * Returns { check, UpgradeModal, upgradeModalProps }
 *
 * Usage:
 *   const { check, gateModal } = useFeatureGate(company, user);
 *   if (!check('ai_campaigns')) return gateModal; // show locked UI
 *   // or: onClick={() => { if (!check('ai_campaigns')) return; doAction(); }}
 */
export function useFeatureGate(company, user) {
  const [blocked, setBlocked] = useState(null); // { feature, requiredTier }
  const admin = isSystemAdmin(user);

  const check = useCallback((feature) => {
    if (hasFeature(company, feature, admin)) return true;
    setBlocked({ feature, requiredTier: getTierForFeature(feature) });
    return false;
  }, [company, admin]);

  const clearBlocked = useCallback(() => setBlocked(null), []);

  return {
    check,
    blocked,
    clearBlocked,
    currentTier: getEffectiveTier(company),
    companyId: company?.id
  };
}