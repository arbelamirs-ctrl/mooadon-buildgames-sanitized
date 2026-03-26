import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, AlertCircle } from 'lucide-react';

const MIN_EVENTS_FOR_SIGNIFICANCE = 30;
const MIN_EVENTS_FOR_HIGH_CONFIDENCE = 100;

/**
 * Simple frequentist-ish uplift + confidence thresholds.
 * We use event counts (redeems or copies) as proxy for conversions.
 * Confidence: Low (<30 events), Medium (30–100), High (>100 + clear lift).
 */
function calcAB(aViews, aRedeems, bViews, bRedeems) {
  const totalEvents = aRedeems + bRedeems;
  const aConv = aViews > 0 ? aRedeems / aViews : 0;
  const bConv = bViews > 0 ? bRedeems / bViews : 0;

  if (totalEvents < 5) return { status: 'no_data', confidence: null, lift: null, leader: null };

  if (totalEvents < MIN_EVENTS_FOR_SIGNIFICANCE) {
    return { status: 'insufficient', confidence: 'Low', lift: null, leader: null, totalEvents };
  }

  const lift = aConv > 0 ? ((bConv - aConv) / aConv) * 100 : null;
  let leader = null;
  let confidence = 'Low';

  if (lift !== null) {
    leader = lift > 0 ? 'b' : lift < 0 ? 'a' : null;
    const absLift = Math.abs(lift);

    if (totalEvents >= MIN_EVENTS_FOR_HIGH_CONFIDENCE && absLift >= 10) {
      confidence = 'High';
    } else if (totalEvents >= MIN_EVENTS_FOR_SIGNIFICANCE && absLift >= 5) {
      confidence = 'Medium';
    } else {
      confidence = 'Low';
    }
  }

  return { status: 'ok', confidence, lift, leader, aConv, bConv, totalEvents };
}

const CONFIDENCE_COLORS = {
  High:   'bg-green-500/20 text-green-400 border-green-500/30',
  Medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Low:    'bg-slate-500/20 text-slate-400 border-slate-500/30'
};

export default function ABAnalytics({ campaign }) {
  const aViews = campaign.views_a || 0;
  const bViews = campaign.views_b || 0;
  const aRedeems = campaign.redemptions_a || 0;
  const bRedeems = campaign.redemptions_b || 0;

  const ab = calcAB(aViews, aRedeems, bViews, bRedeems);

  if (ab.status === 'no_data') return null;

  const liftDisplay = ab.lift !== null ? `${ab.lift > 0 ? '+' : ''}${ab.lift.toFixed(1)}%` : null;
  const liftColor = ab.lift > 0 ? 'text-green-400' : ab.lift < 0 ? 'text-red-400' : 'text-slate-400';

  return (
    <div className="bg-[#17171f] rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3" /> A/B Analytics
        </p>
        <Badge className="text-xs bg-slate-500/10 text-slate-500">{ab.totalEvents} events</Badge>
      </div>

      {ab.status === 'insufficient' && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <AlertCircle className="w-3 h-3 text-yellow-500" />
          Not enough data — need {MIN_EVENTS_FOR_SIGNIFICANCE} events for significance (currently {ab.totalEvents})
        </div>
      )}

      {ab.status === 'ok' && (
        <div className="space-y-2">
          {/* Conversion bars */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'A — Benefit', conv: ab.aConv, views: aViews, redeems: aRedeems, color: 'bg-blue-500', isLeader: ab.leader === 'a' },
              { label: 'B — Urgency', conv: ab.bConv, views: bViews, redeems: bRedeems, color: 'bg-purple-500', isLeader: ab.leader === 'b' }
            ].map((v) => (
              <div key={v.label} className={`rounded-lg p-2.5 bg-[#1f2128] ${v.isLeader ? 'ring-1 ring-teal-500/40' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">{v.label}</span>
                  {v.isLeader && <Trophy className="w-3 h-3 text-yellow-400" />}
                </div>
                <p className="text-white text-sm font-bold">{(v.conv * 100).toFixed(2)}%</p>
                <p className="text-slate-600 text-xs">{v.redeems} / {v.views} views</p>
                <div className="mt-1.5 h-1.5 bg-[#2d2d3a] rounded-full overflow-hidden">
                  <div className={`h-full ${v.color} rounded-full`} style={{ width: `${Math.min(v.conv * 2000, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Lift + confidence */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {liftDisplay && ab.leader && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-xs">B vs A lift:</span>
                <span className={`text-xs font-bold ${liftColor}`}>{liftDisplay}</span>
              </div>
            )}
            {ab.confidence && (
              <Badge className={`text-xs border ${CONFIDENCE_COLORS[ab.confidence]}`}>
                {ab.confidence} confidence
              </Badge>
            )}
            {ab.leader && ab.confidence === 'High' && (
              <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                <Trophy className="w-3 h-3 mr-1" />
                Variant {ab.leader.toUpperCase()} winning — consider locking
              </Badge>
            )}
            {ab.leader && ab.confidence === 'Medium' && (
              <span className="text-xs text-slate-500">Variant {ab.leader.toUpperCase()} ahead, more data needed</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}