import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Eye, Copy, Gift, Trophy, Zap } from 'lucide-react';
import ABAnalytics from '@/components/campaigns/ABAnalytics';

function FunnelBar({ views, copies, redeems }) {
  const max = Math.max(views, 1);
  const bars = [
    { label: 'Views', value: views, pct: 100, color: 'bg-blue-500' },
    { label: 'Copies', value: copies, pct: Math.round((copies / max) * 100), color: 'bg-teal-500' },
    { label: 'Redeems', value: redeems, pct: Math.round((redeems / max) * 100), color: 'bg-purple-500' }
  ];
  return (
    <div className="space-y-1.5 mt-3">
      {bars.map(b => (
        <div key={b.label} className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-14">{b.label}</span>
          <div className="flex-1 h-2 bg-[#17171f] rounded-full overflow-hidden">
            <div className={`h-full ${b.color} rounded-full transition-all`} style={{ width: `${b.pct}%` }} />
          </div>
          <span className="text-xs text-slate-400 w-8 text-right">{b.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color = 'text-teal-400' }) {
  return (
    <Card className="bg-[#1f2128] border-[#2d2d3a]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-400 text-xs">{label}</p>
            <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
          </div>
          <Icon className={`w-5 h-5 ${color} opacity-60`} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function CampaignROI() {
  const { primaryCompanyId } = useUserPermissions();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns-roi', primaryCompanyId],
    queryFn: () => base44.entities.CouponCampaign.filter({ company_id: primaryCompanyId }, '-created_date', 200),
    enabled: !!primaryCompanyId
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-24 text-slate-500">Loading...</div>
  );

  // Enrich each campaign with computed stats
  const enriched = campaigns.map(c => {
    const views = (c.views_a || 0) + (c.views_b || 0) + (c.views || 0);
    const copies = (c.copies_a || 0) + (c.copies_b || 0) + (c.copies || 0);
    const redeems = (c.redemptions_a || 0) + (c.redemptions_b || 0) + (c.redemptions || 0);
    const price = c.product_price || 0;
    const convRate = views > 0 ? ((redeems / views) * 100).toFixed(1) : '0.0';
    const revenueUplift = redeems * price;
    const roiRaw = redeems * price / (1 + views);
    const winner = c.ig_winner;
    return { ...c, views, copies, redeems, price, convRate, revenueUplift, roiRaw, winner };
  });

  // Normalize ROI 0-100
  const maxRoi = Math.max(...enriched.map(c => c.roiRaw), 1);
  const withRoi = enriched.map(c => ({
    ...c,
    roiScore: Math.round((c.roiRaw / maxRoi) * 100)
  })).sort((a, b) => b.roiScore - a.roiScore);

  // Aggregate stats
  const totalActive = campaigns.filter(c => c.status === 'published').length;
  const totalRevenue = enriched.reduce((s, c) => s + c.revenueUplift, 0);
  const totalViews = enriched.reduce((s, c) => s + c.views, 0);
  const totalRedeems = enriched.reduce((s, c) => s + c.redeems, 0);
  const overallConv = totalViews > 0 ? ((totalRedeems / totalViews) * 100).toFixed(1) : '0.0';
  const best = withRoi[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-teal-400" />
          Campaign ROI Dashboard
        </h1>
        <p className="text-sm text-slate-400 mt-1">Performance metrics across all AI campaigns</p>
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Campaigns" value={totalActive} icon={Zap} />
        <StatCard label="Est. Revenue Uplift" value={`₪${totalRevenue.toLocaleString()}`} sub="estimated" icon={TrendingUp} color="text-green-400" />
        <StatCard label="Overall Conv. Rate" value={`${overallConv}%`} sub={`${totalRedeems} redeems`} icon={Gift} color="text-purple-400" />
        <StatCard label="Best Campaign" value={best?.product_name ? best.product_name.substring(0, 12) + '…' : '—'} sub={best ? `ROI score: ${best.roiScore}` : ''} icon={Trophy} color="text-yellow-400" />
      </div>

      {/* Per-campaign table */}
      {withRoi.length === 0 ? (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="py-16 text-center text-slate-500">No campaign data yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {withRoi.map((c, idx) => (
            <Card key={c.id} className="bg-[#1f2128] border-[#2d2d3a]">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Left: info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {idx === 0 && <Trophy className="w-4 h-4 text-yellow-400" />}
                      <span className="font-semibold text-white">{c.product_name}</span>
                      <Badge className={c.status === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}>
                        {c.status}
                      </Badge>
                      {c.winner ? (
                        <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                          <Trophy className="w-3 h-3 mr-1 inline" />Winner: {c.winner?.toUpperCase()}
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-500/10 text-slate-500 text-xs">In Progress</Badge>
                      )}
                    </div>
                    <code className="text-teal-400/70 text-xs mt-1 block">{c.coupon_code}</code>
                    <FunnelBar views={c.views} copies={c.copies} redeems={c.redeems} />
                    <div className="mt-3">
                      <ABAnalytics campaign={c} />
                    </div>
                  </div>

                  {/* Right: metrics */}
                  <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-3 gap-3 min-w-[280px]">
                    <div className="bg-[#17171f] rounded-lg p-3 text-center">
                      <p className="text-slate-400 text-xs">Views</p>
                      <p className="text-white font-bold">{c.views}</p>
                      <div className="flex justify-center gap-1 mt-1 text-xs">
                        <span className="text-blue-400">A:{c.views_a||0}</span>
                        <span className="text-slate-600">/</span>
                        <span className="text-purple-400">B:{c.views_b||0}</span>
                      </div>
                    </div>
                    <div className="bg-[#17171f] rounded-lg p-3 text-center">
                      <p className="text-slate-400 text-xs">Redeems</p>
                      <p className="text-white font-bold">{c.redeems}</p>
                      <div className="flex justify-center gap-1 mt-1 text-xs">
                        <span className="text-blue-400">A:{c.redemptions_a||0}</span>
                        <span className="text-slate-600">/</span>
                        <span className="text-purple-400">B:{c.redemptions_b||0}</span>
                      </div>
                    </div>
                    <div className="bg-[#17171f] rounded-lg p-3 text-center">
                      <p className="text-slate-400 text-xs">Conv. Rate</p>
                      <p className="text-teal-400 font-bold">{c.convRate}%</p>
                    </div>
                    <div className="bg-[#17171f] rounded-lg p-3 text-center">
                      <p className="text-slate-400 text-xs">Est. Revenue</p>
                      <p className="text-green-400 font-bold text-sm">₪{c.revenueUplift.toLocaleString()}</p>
                      <p className="text-slate-600 text-xs">estimated</p>
                    </div>
                    <div className="bg-[#17171f] rounded-lg p-3 text-center col-span-2 md:col-span-1">
                      <p className="text-slate-400 text-xs">ROI Score</p>
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <div className="flex-1 h-2 bg-[#2d2d3a] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-teal-500 to-green-400 rounded-full" style={{ width: `${c.roiScore}%` }} />
                        </div>
                        <span className="text-white font-bold text-sm">{c.roiScore}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}