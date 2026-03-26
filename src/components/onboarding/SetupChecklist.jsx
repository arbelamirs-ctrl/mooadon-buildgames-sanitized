import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Circle, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { TIER_ORDER } from '@/components/plans/featureFlags';

export default function SetupChecklist({ companyId, effectiveTier, onUpgradeClick }) {
  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['checklist-branches', companyId],
    queryFn: () => base44.entities.Branch.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['checklist-products', companyId],
    queryFn: () => base44.entities.Product.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: coupons = [], isLoading: loadingCoupons } = useQuery({
    queryKey: ['checklist-coupons', companyId],
    queryFn: () => base44.entities.CouponCampaign.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: salesConfig = [], isLoading: loadingPOS } = useQuery({
    queryKey: ['checklist-pos', companyId],
    queryFn: () => base44.entities.SalesChannelConfig.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery({
    queryKey: ['checklist-campaigns', companyId],
    queryFn: () => base44.entities.CouponCampaign.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const isLoading = loadingBranches || loadingProducts || loadingCoupons || loadingPOS;
  const userTierOrder = TIER_ORDER[effectiveTier] ?? 0;

  const posConnected = salesConfig.some(c => c.is_connected);
  const hasProduct = products.length > 0;
  const hasCoupon = coupons.length > 0;
  const hasStore = userTierOrder >= 1; // advanced
  const hasCampaign = campaigns.some(c => c.structured_copy_a || c.ig_copy_a);

  const steps = [
    {
      id: 'pos',
      label: 'Connect POS',
      done: posConnected,
      page: 'POSConnect',
      minTier: null,
    },
    {
      id: 'product',
      label: 'Create first product',
      done: hasProduct,
      page: 'ProductsAdmin',
      minTier: null,
    },
    {
      id: 'coupon',
      label: 'Create first coupon',
      done: hasCoupon,
      page: 'Coupons',
      minTier: null,
    },
    {
      id: 'store',
      label: 'Enable Rewards Store',
      done: hasStore,
      page: 'RewardsStore',
      minTier: 'advanced',
    },
    {
      id: 'campaign',
      label: 'Generate first AI Campaign',
      done: hasCampaign,
      page: 'AICampaigns',
      minTier: 'pro',
    },
  ];

  const completedCount = steps.filter(s => {
    if (s.minTier && TIER_ORDER[s.minTier] > userTierOrder) return false;
    return s.done;
  }).length;

  if (isLoading) {
    return (
      <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-4 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Setup Checklist</h3>
        <span className="text-xs text-slate-400">{completedCount}/{steps.length} done</span>
      </div>
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-[#2d2d3a] rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-teal-500 rounded-full transition-all"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>
      <div className="space-y-2">
        {steps.map((step) => {
          const locked = step.minTier && TIER_ORDER[step.minTier] > userTierOrder;
          return (
            <div key={step.id} className="flex items-center gap-3">
              {step.done && !locked ? (
                <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
              ) : locked ? (
                <Lock className="w-4 h-4 text-slate-600 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-slate-500 flex-shrink-0" />
              )}
              <span className={`text-xs flex-1 ${step.done && !locked ? 'text-slate-400 line-through' : locked ? 'text-slate-600' : 'text-slate-300'}`}>
                {step.label}
              </span>
              {locked ? (
                <button
                  onClick={() => onUpgradeClick?.(step.minTier)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
                >
                  Upgrade <ArrowRight className="w-3 h-3" />
                </button>
              ) : !step.done ? (
                <Link to={createPageUrl(step.page)}>
                  <button className="text-xs text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1">
                    Go <ArrowRight className="w-3 h-3" />
                  </button>
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}