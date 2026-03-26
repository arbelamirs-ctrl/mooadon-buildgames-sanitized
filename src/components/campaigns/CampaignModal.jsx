import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Globe, CheckCircle, Loader2, RefreshCw, AlertCircle, Info, Image } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import VisualIdeasTab from './VisualIdeasTab';
import ABAnalytics from './ABAnalytics';

const PLATFORMS = [
  { key: 'ig', label: '📸 IG', limit: null },
  { key: 'fb', label: '📘 FB', limit: null },
  { key: 'x', label: '🐦 X', limit: 280 },
  { key: 'linkedin', label: '💼 LinkedIn', limit: null }
];

function QualityBadge({ score, issues }) {
  const [showIssues, setShowIssues] = useState(false);
  const color = score >= 85 ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : score >= 70 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30';
  const topIssues = (issues || '').split(';').filter(Boolean).slice(0, 3);
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowIssues(!showIssues)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${color}`}
      >
        <span className="font-bold">{score}/100</span>
        {topIssues.length > 0 && <Info className="w-3 h-3" />}
      </button>
      {showIssues && topIssues.length > 0 && (
        <div className="absolute z-10 top-full left-0 mt-1 w-64 bg-[#1f2128] border border-[#2d2d3a] rounded-lg p-3 shadow-xl">
          <p className="text-slate-400 text-xs mb-2 font-medium">Issues resolved by AI:</p>
          {topIssues.map((issue, i) => (
            <div key={i} className="flex items-start gap-1.5 mb-1">
              <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-white text-xs">{issue.trim()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CampaignModal({ campaign, onClose, onUpdate }) {
  const queryClient = useQueryClient();

  const [copies, setCopies] = useState({
    ig_a: campaign.ig_copy_a || '',
    ig_b: campaign.ig_copy_b || '',
    fb_a: campaign.fb_copy_a || '',
    fb_b: campaign.fb_copy_b || '',
    x_a: campaign.x_copy_a || '',
    x_b: campaign.x_copy_b || '',
    linkedin_a: campaign.linkedin_copy_a || '',
    linkedin_b: campaign.linkedin_copy_b || ''
  });

  const [activeVariants, setActiveVariants] = useState({
    ig: campaign.ig_active_variant || 'a',
    fb: campaign.fb_active_variant || 'a',
    x: campaign.x_active_variant || 'a',
    linkedin: campaign.linkedin_active_variant || 'a'
  });

  const [regenCooldown, setRegenCooldown] = useState(0);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    if (regenCooldown <= 0) return;
    const timer = setTimeout(() => setRegenCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(timer);
  }, [regenCooldown]);

  const getPublicUrl = (variant = 'a') => {
    const code = variant === 'b' ? campaign.coupon_code_b : campaign.coupon_code;
    return `${window.location.origin}/CouponPage?code=${code}`;
  };

  const copyText = (text) => { navigator.clipboard.writeText(text); toast.success('Copied!'); };

  const publishMutation = useMutation({
    mutationFn: () => base44.entities.CouponCampaign.update(campaign.id, {
      status: 'published',
      ig_copy_a: copies.ig_a, ig_copy_b: copies.ig_b,
      fb_copy_a: copies.fb_a, fb_copy_b: copies.fb_b,
      x_copy_a: copies.x_a, x_copy_b: copies.x_b,
      linkedin_copy_a: copies.linkedin_a, linkedin_copy_b: copies.linkedin_b,
      ig_active_variant: activeVariants.ig,
      fb_active_variant: activeVariants.fb,
      x_active_variant: activeVariants.x,
      linkedin_active_variant: activeVariants.linkedin
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign published! 🎉');
      onUpdate && onUpdate();
      onClose();
    }
  });

  const handleRegenerate = async () => {
    if (regenCooldown > 0 || isRegenerating) return;
    setIsRegenerating(true);
    toast.info('Regenerating with AI quality engine… this takes ~30s');
    try {
      const res = await base44.functions.invoke('generateCampaignWithAI', {
        company_id: campaign.company_id,
        product_id: campaign.product_id
      });
      if (res.data?.campaign) {
        const c = res.data.campaign;
        setCopies({
          ig_a: c.ig_copy_a || '', ig_b: c.ig_copy_b || '',
          fb_a: c.fb_copy_a || '', fb_b: c.fb_copy_b || '',
          x_a:  c.x_copy_a  || '', x_b:  c.x_copy_b  || '',
          linkedin_a: c.linkedin_copy_a || '', linkedin_b: c.linkedin_copy_b || ''
        });
        toast.success(`Regenerated! Quality: ${c.ai_quality_score || '?'}/100`);
        setRegenCooldown(60);
        queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      }
    } catch (e) {
      toast.error('Regeneration failed: ' + e.message);
    } finally {
      setIsRegenerating(false);
    }
  };

  const qualityScoreA = campaign.ai_quality_score_a || campaign.ai_quality_score || 0;
  const qualityScoreB = campaign.ai_quality_score_b || 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#1f2128] border-[#2d2d3a] text-white max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-3">
            ✨ AI Campaign — {campaign.product_name}
            {qualityScoreA > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs font-normal">Quality:</span>
                <QualityBadge score={qualityScoreA} issues={campaign.ai_issues_a} />
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Meta info */}
        {campaign.prompt_version && (
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
            <Badge className="bg-slate-500/10 text-slate-500">{campaign.prompt_version}</Badge>
            {campaign.creator_model && <Badge className="bg-blue-500/10 text-blue-400">{campaign.creator_model}</Badge>}
            {campaign.ai_language && campaign.ai_language !== 'en' && (
              <Badge className="bg-orange-500/10 text-orange-400">🌐 {campaign.ai_language.toUpperCase()}</Badge>
            )}
            {campaign.ai_cost_estimate_usd > 0 && <span>~${campaign.ai_cost_estimate_usd} cost</span>}
            {campaign.ai_passes > 0 && <span>{campaign.ai_passes} AI passes</span>}
          </div>
        )}

        {/* Coupon Codes */}
        <div className="grid grid-cols-2 gap-3">
          {['a', 'b'].map(v => {
            const score = v === 'a' ? qualityScoreA : qualityScoreB;
            const issues = v === 'a' ? campaign.ai_issues_a : campaign.ai_issues_b;
            return (
              <div key={v} className="border border-dashed border-teal-500/40 rounded-xl p-3 text-center bg-teal-500/5">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <p className="text-slate-400 text-xs">Variant {v.toUpperCase()} Code</p>
                  {score > 0 && <QualityBadge score={score} issues={issues} />}
                </div>
                <div className="text-lg font-black tracking-widest text-white font-mono">
                  {v === 'a' ? campaign.coupon_code : (campaign.coupon_code_b || '—')}
                </div>
                <div className="flex gap-1 justify-center mt-2 flex-wrap">
                  <Button size="sm" variant="ghost" className="text-xs text-slate-400 h-6 px-2"
                    onClick={() => copyText(v === 'a' ? campaign.coupon_code : campaign.coupon_code_b)}>
                    <Copy className="w-3 h-3 mr-1" />Code
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs text-slate-400 h-6 px-2"
                    onClick={() => copyText(getPublicUrl(v))}>
                    <ExternalLink className="w-3 h-3 mr-1" />Link
                  </Button>
                  <a href={getPublicUrl(v)} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost" className="text-xs text-slate-400 h-6 px-2">
                      <Globe className="w-3 h-3 mr-1" />View
                    </Button>
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* A/B Analytics */}
        <ABAnalytics campaign={campaign} />

        {/* Platform + Visual Tabs */}
        <Tabs defaultValue="ig">
          <TabsList className="bg-[#17171f] w-full flex-wrap">
            {PLATFORMS.map(p => (
              <TabsTrigger key={p.key} value={p.key} className="flex-1 text-xs">{p.label}</TabsTrigger>
            ))}
            <TabsTrigger value="visual" className="flex-1 text-xs flex items-center gap-1">
              <Image className="w-3 h-3" />Visual
            </TabsTrigger>
          </TabsList>

          {PLATFORMS.map(p => (
            <TabsContent key={p.key} value={p.key} className="mt-3 space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Active variant:</span>
                {['a', 'b'].map(v => (
                  <button key={v}
                    onClick={() => setActiveVariants(prev => ({ ...prev, [p.key]: v }))}
                    className={`px-3 py-1 rounded-full font-medium transition-colors ${
                      activeVariants[p.key] === v ? 'bg-teal-500 text-white' : 'bg-[#17171f] text-slate-400 hover:text-white border border-[#2d2d3a]'
                    }`}>
                    Variant {v.toUpperCase()} {activeVariants[p.key] === v && '✓'}
                  </button>
                ))}
                {p.limit && <span className="ml-auto text-slate-500">Limit: {p.limit} chars</span>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {['a', 'b'].map(v => {
                  const val = copies[`${p.key}_${v}`];
                  const overLimit = p.limit && val.length > p.limit;
                  return (
                    <div key={v} className={`space-y-1 ${activeVariants[p.key] === v ? 'ring-1 ring-teal-500/40 rounded-lg p-2' : 'p-2'}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${v === 'a' ? 'text-blue-400' : 'text-purple-400'}`}>
                          {v.toUpperCase()} — {v === 'a' ? 'Benefit' : 'Urgency'}
                        </span>
                        <div className="flex items-center gap-1">
                          {p.limit && (
                            <span className={`text-xs ${overLimit ? 'text-red-400' : 'text-slate-500'}`}>
                              {val.length}/{p.limit}
                            </span>
                          )}
                          {activeVariants[p.key] === v && <Badge className="text-xs bg-teal-500/20 text-teal-400">Active</Badge>}
                        </div>
                      </div>
                      {overLimit && (
                        <div className="flex items-center gap-1 text-red-400 text-xs">
                          <AlertCircle className="w-3 h-3" /> Over {p.limit} char limit
                        </div>
                      )}
                      <Textarea
                        value={val}
                        onChange={(e) => setCopies(prev => ({ ...prev, [`${p.key}_${v}`]: e.target.value }))}
                        className={`bg-[#17171f] border-[#2d2d3a] text-white min-h-[100px] text-xs ${overLimit ? 'border-red-500/50' : ''}`}
                      />
                      <Button size="sm" variant="ghost" className="text-xs text-slate-400 h-6"
                        onClick={() => copyText(val)}>
                        <Copy className="w-3 h-3 mr-1" />Copy
                      </Button>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          ))}

          <TabsContent value="visual" className="mt-3">
            <Tabs defaultValue="va">
              <TabsList className="bg-[#17171f] mb-3">
                <TabsTrigger value="va" className="text-xs">Variant A — Benefit</TabsTrigger>
                <TabsTrigger value="vb" className="text-xs">Variant B — Urgency</TabsTrigger>
              </TabsList>
              <TabsContent value="va">
                <VisualIdeasTab campaign={campaign} variant="a" />
              </TabsContent>
              <TabsContent value="vb">
                <VisualIdeasTab campaign={campaign} variant="b" />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Hashtags & CTA */}
        <div className="grid grid-cols-2 gap-3">
          {campaign.hashtags && (
            <div className="bg-[#17171f] rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-1">Hashtags</p>
              <p className="text-teal-400 text-xs">{campaign.hashtags.split(',').map(h => h.trim()).join(' ')}</p>
            </div>
          )}
          {campaign.cta && (
            <div className="bg-[#17171f] rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-1">CTA</p>
              <p className="text-white text-xs font-medium">{campaign.cta}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="border-[#2d2d3a] text-white">Cancel</Button>
          <Button
            variant="outline"
            className="gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            onClick={handleRegenerate}
            disabled={isRegenerating || regenCooldown > 0}
          >
            {isRegenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {regenCooldown > 0 ? `Wait ${regenCooldown}s` : isRegenerating ? 'Generating…' : 'Regenerate'}
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 gap-2"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
          >
            {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Publish Campaign
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}