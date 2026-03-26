import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Zap, CheckCircle, Loader2, Star, Sparkles, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { PLAN_PRICES, PLAN_LABELS, TIER_ORDER } from './featureFlags';

const PLAN_DETAILS = {
  basic: {
    color: 'from-slate-500 to-slate-600',
    icon: CheckCircle,
    features: ['Loyalty tokens', 'Coupons & rewards', 'POS Terminal', 'Basic analytics'],
    price: 'Free forever',
  },
  advanced: {
    color: 'from-blue-500 to-cyan-500',
    icon: Zap,
    features: ['Everything in Basic', 'Wallet Store', 'Purchase history', 'Store dashboard'],
    price: '$49/mo',
  },
  pro: {
    color: 'from-purple-500 to-pink-500',
    icon: Star,
    features: ['Everything in Advanced', 'AI Campaigns (A/B)', 'ROI dashboard', 'Brand voice & scheduler'],
    price: '$99/mo',
  },
};

export default function UpgradeModal({ feature, currentTier, requiredTier, onClose, companyId, isTrialExpired }) {
  const [loading, setLoading] = useState(null);

  const handleUpgrade = async (targetTier) => {
    if (targetTier === 'basic') {
      setLoading('basic');
      try {
        await base44.entities.Company.update(companyId, {
          plan_tier: 'basic',
          plan_status: 'active',
        });
        toast.success('Switched to Basic plan');
        onClose?.();
        window.location.reload();
      } catch (e) {
        toast.error('Failed: ' + e.message);
      } finally {
        setLoading(null);
      }
      return;
    }
    setLoading(targetTier);
    try {
      const res = await base44.functions.invoke('createStripeCheckout', {
        company_id: companyId,
        plan_tier: targetTier,
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error('Could not start checkout. Please try again.');
      }
    } catch (e) {
      toast.error('Checkout failed: ' + e.message);
    } finally {
      setLoading(null);
    }
  };

  // Trial expired → force plan selection (no close button)
  if (isTrialExpired) {
    return (
      <Dialog open onOpenChange={() => {}}>
        <DialogContent className="bg-[#1f2128] border-[#2d2d3a] text-white max-w-lg [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
              Your 7-day trial has ended
            </DialogTitle>
          </DialogHeader>

          <p className="text-slate-400 text-sm text-center pb-2">
            Choose a plan to continue. You can always upgrade later.
          </p>

          <div className="space-y-3">
            {['basic', 'advanced', 'pro'].map((tier) => {
              const d = PLAN_DETAILS[tier];
              const Icon = d.icon;
              return (
                <div key={tier} className={`rounded-xl border p-4 ${tier === 'advanced' ? 'border-blue-500/50 bg-blue-500/5' : 'border-[#2d2d3a] bg-[#17171f]'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${d.color} flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-semibold capitalize">{PLAN_LABELS[tier]}</p>
                        <p className="text-slate-400 text-xs">{d.price}</p>
                      </div>
                    </div>
                    {tier === 'advanced' && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Popular</Badge>}
                  </div>
                  <ul className="space-y-1 mb-3">
                    {d.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full bg-gradient-to-r ${d.color} hover:opacity-90 text-white font-semibold`}
                    onClick={() => handleUpgrade(tier)}
                    disabled={!!loading}
                  >
                    {loading === tier ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {tier === 'basic' ? 'Continue with Basic (Free)' : `Choose ${PLAN_LABELS[tier]}`}
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Regular upgrade modal
  const tiers = Object.entries(PLAN_PRICES)
    .filter(([tier]) => TIER_ORDER[tier] > TIER_ORDER[currentTier || 'basic'])
    .map(([tier, price]) => ({ tier, ...price }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#1f2128] border-[#2d2d3a] text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Lock className="w-5 h-5 text-amber-400" />
            Upgrade Required
          </DialogTitle>
        </DialogHeader>

        <div className="text-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-7 h-7 text-amber-400" />
          </div>
          <p className="text-slate-300 text-sm">
            This feature requires a higher plan.
            {requiredTier && (
              <span className="text-white font-semibold"> Upgrade to <span className="capitalize">{requiredTier}</span> to unlock it.</span>
            )}
          </p>
          {currentTier && (
            <Badge className="mt-2 bg-slate-500/20 text-slate-400">
              Current plan: {PLAN_LABELS[currentTier] || currentTier}
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          {tiers.map(({ tier, monthly, label }) => {
            const isRequired = tier === requiredTier;
            const d = PLAN_DETAILS[tier] || { color: 'from-slate-500 to-slate-600', features: [] };
            return (
              <div key={tier} className={`rounded-xl border p-4 ${isRequired ? 'border-purple-500/50 bg-purple-500/5' : 'border-[#2d2d3a] bg-[#17171f]'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${d.color} flex items-center justify-center`}>
                      {tier === 'pro' ? <Star className="w-4 h-4 text-white" /> : <Zap className="w-4 h-4 text-white" />}
                    </div>
                    <div>
                      <p className="text-white font-semibold capitalize">{tier}</p>
                      <p className="text-slate-400 text-xs">{label}</p>
                    </div>
                  </div>
                  {isRequired && <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Recommended</Badge>}
                </div>
                <ul className="space-y-1 mb-3">
                  {(d.features || []).slice(0, 4).map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full bg-gradient-to-r ${d.color} hover:opacity-90 text-white font-semibold`}
                  onClick={() => handleUpgrade(tier)}
                  disabled={!!loading}
                >
                  {loading === tier ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Upgrade to {PLAN_LABELS[tier]} — {label}
                </Button>
              </div>
            );
          })}
        </div>

        <Button variant="ghost" onClick={onClose} className="w-full text-slate-400 hover:text-white text-sm mt-1">
          Maybe later
        </Button>
      </DialogContent>
    </Dialog>
  );
}