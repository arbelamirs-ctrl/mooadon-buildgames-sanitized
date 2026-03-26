import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, ArrowRight, TrendingUp } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Suggest next campaign based on winning variant + vertical patterns
function getSuggestion(campaigns, vertical) {
  if (!campaigns.length) return null;

  const withStats = campaigns.map(c => ({
    ...c,
    totalRedeems: (c.redemptions_a || 0) + (c.redemptions_b || 0) + (c.redemptions || 0),
    totalViews: (c.views_a || 0) + (c.views_b || 0) + (c.views || 0),
    winner: c.ig_winner
  }));

  const sorted = withStats.sort((a, b) => b.totalRedeems - a.totalRedeems);
  const best = sorted[0];
  if (!best) return null;

  const urgencyWins = withStats.filter(c => c.winner === 'b').length;
  const benefitWins = withStats.filter(c => c.winner === 'a').length;
  const preferredAngle = urgencyWins > benefitWins ? 'urgency' : 'benefit';

  const verticalTips = {
    cafe: 'Try a morning bundle deal or loyalty double-points day',
    fashion: 'New arrivals + limited stock always converts — try a "last 5 items" campaign',
    restaurant: 'Weekend reservation incentives perform well — try a "chef special" bundle',
    jewelry: 'Gift-occasion campaigns (Valentine, anniversary) spike conversions',
    other: 'Bundle offer or flash sale typically doubles redeem rates'
  };

  return {
    preferredAngle,
    tip: verticalTips[vertical] || verticalTips.other,
    bestProduct: best.product_name,
    bestRedeems: best.totalRedeems
  };
}

export default function CampaignSuggestion({ campaigns, vertical, onGenerateClick }) {
  const suggestion = getSuggestion(campaigns, vertical);
  if (!suggestion || campaigns.length < 1) return null;

  return (
    <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-white text-sm font-medium flex items-center gap-2">
            Suggested next campaign
            <Badge className="bg-purple-500/20 text-purple-400 text-xs">{suggestion.preferredAngle}-led wins for you</Badge>
          </p>
          <p className="text-slate-400 text-xs mt-1">{suggestion.tip}</p>
          {suggestion.bestRedeems > 0 && (
            <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Best performer: "{suggestion.bestProduct}" with {suggestion.bestRedeems} redeems
            </p>
          )}
        </div>
        <Button
          size="sm"
          className="bg-purple-500 hover:bg-purple-600 gap-1 text-xs flex-shrink-0"
          onClick={onGenerateClick}
        >
          <Sparkles className="w-3 h-3" />
          Generate
          <ArrowRight className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}