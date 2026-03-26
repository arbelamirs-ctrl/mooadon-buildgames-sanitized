import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Eye, Copy, Gift, ExternalLink, Globe, Clock, Trophy, CalendarClock, Send, TrendingUp, Wand2, Share2, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import CampaignScheduler from '@/components/campaigns/CampaignScheduler';
import CampaignCRMSend from '@/components/campaigns/CampaignCRMSend';
import CampaignSuggestion from '@/components/campaigns/CampaignSuggestion';
import CampaignROI from './CampaignROI';
import SocialShareButtons from '@/components/campaigns/SocialShareButtons';
import ShareCampaignModal from '@/components/campaigns/ShareCampaignModal';

const STATUS_COLORS = {
  draft: 'bg-slate-500/20 text-slate-400',
  published: 'bg-green-500/20 text-green-400',
  expired: 'bg-red-500/20 text-red-400'
};

function StatPill({ icon: Icon, label, value, color = 'text-slate-400' }) {
  return (
    <span className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon className="w-3 h-3" />{value} {label}
    </span>
  );
}

function ABStats({ campaign }) {
  const aViews = campaign.views_a || 0, bViews = campaign.views_b || 0;
  const aCopies = campaign.copies_a || 0, bCopies = campaign.copies_b || 0;
  const aRed = campaign.redemptions_a || 0, bRed = campaign.redemptions_b || 0;

  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {['a', 'b'].map(v => {
        const views = v === 'a' ? aViews : bViews;
        const copies = v === 'a' ? aCopies : bCopies;
        const redeems = v === 'a' ? aRed : bRed;
        const winner = campaign[`ig_winner`] === v;
        return (
          <div key={v} className={`bg-[#17171f] rounded-lg p-2 border ${winner ? 'border-yellow-500/40' : 'border-[#2d2d3a]'}`}>
            <div className="flex items-center gap-1 mb-1">
              <span className={`text-xs font-bold ${v === 'a' ? 'text-blue-400' : 'text-purple-400'}`}>
                Variant {v.toUpperCase()}
              </span>
              {winner && <Trophy className="w-3 h-3 text-yellow-400" />}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <span><Eye className="w-3 h-3 inline mr-0.5" />{views}</span>
              <span><Copy className="w-3 h-3 inline mr-0.5" />{copies}</span>
              <span><Gift className="w-3 h-3 inline mr-0.5" />{redeems}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AICampaigns() {
  const { primaryCompanyId } = useUserPermissions();
  const queryClient = useQueryClient();
  const [schedulingCampaign, setSchedulingCampaign] = useState(null);
  const [crmCampaign, setCrmCampaign] = useState(null);
  const [activeTab, setActiveTab] = useState('campaigns');

  const [shareOpen, setShareOpen] = useState(null); // campaign object

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns', primaryCompanyId],
    queryFn: () => base44.entities.CouponCampaign.filter({ company_id: primaryCompanyId }, '-created_date', 100),
    enabled: !!primaryCompanyId
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CouponCampaign.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Updated'); }
  });

  const getPublicUrl = (code) => `${window.location.origin}/CouponPage?code=${code}`;

  const declareWinner = (campaign, winner) => {
    updateMutation.mutate({
      id: campaign.id,
      data: {
        ig_winner: winner, fb_winner: winner, x_winner: winner, linkedin_winner: winner,
        ig_active_variant: winner, fb_active_variant: winner, x_active_variant: winner, linkedin_active_variant: winner
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            AI Campaigns
          </h1>
          <p className="text-sm text-slate-400 mt-1">A/B tested social media campaigns with coupon codes</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-purple-500/20 text-purple-400">{campaigns.length} campaigns</Badge>
          <Link to={createPageUrl('BusinessAIStudio')}>
            <Button size="sm" className="bg-purple-500 hover:bg-purple-600 gap-1.5">
              <Wand2 className="w-3.5 h-3.5" /> New Campaign
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#17171f] border border-[#2d2d3a] rounded-lg p-1 w-fit">
        {[
          { id: 'campaigns', label: 'Campaigns', icon: Sparkles },
          { id: 'roi', label: 'ROI Dashboard', icon: TrendingUp },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === t.id ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'roi' && <CampaignROI />}

      {activeTab === 'campaigns' && (
      <div className="space-y-4">

      {/* Debug banner */}
      {primaryCompanyId && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-400">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Company ID: <code className="font-mono bg-amber-500/10 px-1 rounded">{primaryCompanyId}</code> · {campaigns.length} campaign(s) loaded</span>
        </div>
      )}

      <CampaignSuggestion campaigns={campaigns} vertical="other" onGenerateClick={() => window.location.href = createPageUrl('BusinessAIStudio')} />

      {isLoading ? (
        <div className="text-slate-500 text-center py-12">Loading...</div>
      ) : campaigns.length === 0 ? (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="py-16 text-center">
            <Sparkles className="w-12 h-12 text-purple-400/30 mx-auto mb-4" />
            <p className="text-white font-medium mb-1">No campaigns yet</p>
            <p className="text-slate-400 text-sm">Go to Products Admin and click "Generate Campaign" on any product.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const hasWinner = c.ig_winner;
            const totalViews = (c.views_a || 0) + (c.views_b || 0) + (c.views || 0);
            const totalRedeems = (c.redemptions_a || 0) + (c.redemptions_b || 0) + (c.redemptions || 0);
            return (
              <Card key={c.id} className="bg-[#1f2128] border-[#2d2d3a]">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-semibold text-white">{c.product_name || 'Product'}</span>
                        <Badge className={STATUS_COLORS[c.status] || STATUS_COLORS.draft}>{c.status}</Badge>
                        {hasWinner && <Badge className="bg-yellow-500/20 text-yellow-400 text-xs"><Trophy className="w-3 h-3 inline mr-1" />Winner: {c.ig_winner?.toUpperCase()}</Badge>}
                      </div>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <code className="text-teal-400 font-mono text-xs bg-teal-500/10 px-2 py-0.5 rounded">A: {c.coupon_code}</code>
                        {c.coupon_code_b && <code className="text-purple-400 font-mono text-xs bg-purple-500/10 px-2 py-0.5 rounded">B: {c.coupon_code_b}</code>}
                      </div>
                      {c.cta && <p className="text-slate-400 text-xs mt-1 truncate">{c.cta}</p>}
                      {c.ai_quality_score > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-slate-500 text-xs">AI Quality:</span>
                          <div className="flex items-center gap-1">
                            <div className="w-20 h-1.5 bg-[#17171f] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${c.ai_quality_score >= 85 ? 'bg-green-500' : c.ai_quality_score >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${c.ai_quality_score}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${c.ai_quality_score >= 85 ? 'text-green-400' : c.ai_quality_score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{c.ai_quality_score}</span>
                          </div>
                          {c.ai_prompt_version && <Badge className="bg-slate-500/10 text-slate-500 text-xs">{c.ai_prompt_version}</Badge>}
                        </div>
                      )}

                      <ABStats campaign={c} />

                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                        <span>Total: {totalViews} views · {totalRedeems} redeems</span>
                        {c.expires_at && (
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Exp {format(new Date(c.expires_at), 'MMM d, yyyy')}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {/* Links */}
                      <div className="flex gap-1 flex-wrap">
                        <Button size="sm" variant="outline" className="gap-1 bg-transparent border-[#2d2d3a] text-slate-300 text-xs h-7"
                          onClick={() => { navigator.clipboard.writeText(getPublicUrl(c.coupon_code)); toast.success('Link A copied!'); }}>
                          <ExternalLink className="w-3 h-3" />A
                        </Button>
                        {c.coupon_code_b && (
                          <Button size="sm" variant="outline" className="gap-1 bg-transparent border-[#2d2d3a] text-slate-300 text-xs h-7"
                            onClick={() => { navigator.clipboard.writeText(getPublicUrl(c.coupon_code_b)); toast.success('Link B copied!'); }}>
                            <ExternalLink className="w-3 h-3" />B
                          </Button>
                        )}
                        <a href={getPublicUrl(c.coupon_code)} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1 bg-transparent border-[#2d2d3a] text-slate-300 text-xs h-7">
                            <Globe className="w-3 h-3" />
                          </Button>
                        </a>
                        <Button size="sm" variant="outline"
                         className="gap-1 text-xs h-7 bg-transparent border-[#2d2d3a] text-slate-300"
                         onClick={() => setShareOpen(c)}>
                          <Share2 className="w-3 h-3" /> Share
                        </Button>
                      </div>
                      {/* Status actions */}
                      <div className="flex gap-1 flex-wrap">
                        <Button size="sm" variant="outline" className="gap-1 bg-transparent border-[#2d2d3a] text-slate-300 text-xs h-7"
                          onClick={() => setSchedulingCampaign(c)}>
                          <CalendarClock className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 bg-transparent border-teal-500/30 text-teal-400 text-xs h-7"
                          onClick={() => setCrmCampaign(c)}>
                          <Send className="w-3 h-3" />
                        </Button>
                        {c.status === 'draft' && (
                          <Button size="sm" className="bg-green-500 hover:bg-green-600 text-xs h-7"
                            onClick={() => updateMutation.mutate({ id: c.id, data: { status: 'published' } })}>
                            Publish
                          </Button>
                        )}
                        {c.status === 'published' && (
                          <Button size="sm" variant="outline" className="text-xs h-7 border-red-500/30 text-red-400 hover:bg-red-500/10"
                            onClick={() => updateMutation.mutate({ id: c.id, data: { status: 'expired' } })}>
                            Expire
                          </Button>
                        )}
                        {/* Declare winner */}
                        {!hasWinner && c.status === 'published' && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="text-xs h-7 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              onClick={() => declareWinner(c, 'a')}>
                              A Wins
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs h-7 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                              onClick={() => declareWinner(c, 'b')}>
                              B Wins
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>


                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {schedulingCampaign && (
        <CampaignScheduler campaign={schedulingCampaign} onClose={() => setSchedulingCampaign(null)} />
      )}
      {crmCampaign && (
        <CampaignCRMSend campaign={crmCampaign} companyId={primaryCompanyId} onClose={() => setCrmCampaign(null)} />
      )}
      {shareOpen && (
        <ShareCampaignModal campaign={shareOpen} onClose={() => setShareOpen(null)} />
      )}
      </div>
      )}
    </div>
  );
}