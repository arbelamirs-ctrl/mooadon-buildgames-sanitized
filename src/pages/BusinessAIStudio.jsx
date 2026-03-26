import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Wand2, Layout, ArrowLeft, ArrowRight, Zap, Brain, CheckCircle, Image, Video } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

import TemplatePickerStep from '@/components/studio/TemplatePickerStep';
import FreePromptStep from '@/components/studio/FreePromptStep';
import OfferBuilderStep from '@/components/studio/OfferBuilderStep';
import OptionsResultStep from '@/components/studio/OptionsResultStep';
import CreativesTab from '@/components/studio/CreativesTab';
import VideoCreativesTab from '@/components/studio/VideoCreativesTab';

const MODES = [
  { id: 'template', label: 'Choose a Template', icon: Layout, description: 'Pick from proven campaign types, AI generates the copy' },
  { id: 'free', label: 'Free Prompt', icon: Brain, description: 'Describe what you want, AI suggests angles and creates the campaign' },
];

const STEPS_TEMPLATE = ['mode', 'template', 'offer', 'result'];
const STEPS_FREE = ['mode', 'free', 'offer', 'result'];

export default function BusinessAIStudio() {
  const { primaryCompanyId } = useUserPermissions();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState(null);
  const [step, setStep] = useState('mode');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [freePrompt, setFreePrompt] = useState({ description: '', audience: '', notes: '' });
  const [offer, setOffer] = useState({ discount_type: 'percent' });
  const [generating, setGenerating] = useState(false);
  const [campaign, setCampaign] = useState(null);
  const [selectedAngle, setSelectedAngle] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const { data: company } = useQuery({
    queryKey: ['company-studio', primaryCompanyId],
    queryFn: async () => {
      const cs = await base44.entities.Company.filter({ id: primaryCompanyId });
      return cs[0] || null;
    },
    enabled: !!primaryCompanyId
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-studio', primaryCompanyId],
    queryFn: () => base44.entities.Product.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId
  });

  const { data: brandVoices = [] } = useQuery({
    queryKey: ['brand-voice-studio', primaryCompanyId],
    queryFn: () => base44.entities.BrandVoice.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId
  });

  const brandVoice = brandVoices[0];

  const steps = mode === 'template' ? STEPS_TEMPLATE : STEPS_FREE;
  const stepIdx = steps.indexOf(step);

  const canProceed = () => {
    if (step === 'mode') return !!mode;
    if (step === 'template') return !!selectedTemplate;
    if (step === 'free') return freePrompt.description?.trim().length > 10;
    if (step === 'offer') return !!offer.product_id;
    return false;
  };

  const goNext = () => {
    const next = steps[stepIdx + 1];
    if (next === 'result') {
      handleGenerate();
    } else {
      setStep(next);
    }
  };

  const goBack = () => {
    if (stepIdx === 0) return;
    setStep(steps[stepIdx - 1]);
  };

  const handleGenerate = async () => {
    if (!offer.product_id) { toast.error('Please select a product'); return; }
    setGenerating(true);
    setStep('result');
    setCampaign(null);

    const context = mode === 'template'
      ? `Template: ${selectedTemplate?.name}. Objective: ${selectedTemplate?.objective}. Angle: ${selectedTemplate?.angle}. ${selectedTemplate?.prompt_hint || ''}`
      : `Free prompt: ${freePrompt.description}${freePrompt.audience ? `. Audience: ${freePrompt.audience}` : ''}${freePrompt.notes ? `. Notes: ${freePrompt.notes}` : ''}`;

    try {
      const res = await base44.functions.invoke('generateCampaignWithAI', {
        company_id: primaryCompanyId,
        product_id: offer.product_id,
        discount_type: offer.discount_type || 'percent',
        discount_value: offer.discount_value ? Number(offer.discount_value) : undefined,
        expires_at: offer.expires_at || undefined,
        fine_print: offer.fine_print || undefined,
        // Pass template/prompt context as schedule_note for audit
        schedule_note: context,
        template_id: selectedTemplate?.id || null,
        free_prompt: mode === 'free' ? freePrompt.description : null,
      });

      if (res.data?.campaign) {
        setCampaign(res.data.campaign);
        toast.success('Campaign generated!');
      } else {
        toast.error(res.data?.error || 'Generation failed');
        setStep('offer');
      }
    } catch (e) {
      toast.error(e.message || 'Generation failed');
      setStep('offer');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async (status) => {
    if (!campaign) return;
    setIsPublishing(true);
    try {
      await base44.entities.CouponCampaign.update(campaign.id, {
        status,
        // audit fields
        schedule_note: mode === 'template'
          ? `Template: ${selectedTemplate?.id} | Angle: ${selectedAngle?.id}`
          : `Free prompt | Angle: ${selectedAngle?.id}`
      });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(status === 'published' ? 'Campaign published! 🎉' : 'Saved as draft');
      // Redirect to campaigns list
      window.location.href = createPageUrl('AICampaigns');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const stepLabels = {
    mode: 'Mode',
    template: 'Template',
    free: 'Prompt',
    offer: 'Offer',
    result: 'Options',
  };

  const [studioTab, setStudioTab] = useState('campaign');

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-400" />
            AI Studio
          </h1>
          <p className="text-sm text-slate-400 mt-1">Create campaigns and ad creatives powered by AI.</p>
        </div>
        <Link to={createPageUrl('AICampaigns')}>
          <Button variant="outline" size="sm" className="border-[#2d2d3a] text-slate-400 gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> All Campaigns
          </Button>
        </Link>
      </div>

      {/* Studio tabs */}
      <Tabs value={studioTab} onValueChange={setStudioTab}>
        <TabsList className="bg-[#1f2128] border border-[#2d2d3a]">
          <TabsTrigger value="campaign" className="text-xs data-[state=active]:bg-purple-500">
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Campaign Copy
          </TabsTrigger>
          <TabsTrigger value="creatives" className="text-xs data-[state=active]:bg-purple-500">
            <Image className="w-3.5 h-3.5 mr-1" /> Creatives
          </TabsTrigger>
          <TabsTrigger value="video" className="text-xs data-[state=active]:bg-purple-500">
            <Video className="w-3.5 h-3.5 mr-1" /> Video Ads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="creatives" className="mt-4">
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardContent className="p-5">
              <CreativesTab
                companyId={primaryCompanyId}
                products={products}
                campaign={campaign}
                onCreativeSelected={(data) => {
                  if (data.type === 'primary') toast.success('Primary creative saved!');
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="video" className="mt-4">
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardContent className="p-5">
              <VideoCreativesTab
                companyId={primaryCompanyId}
                products={products}
                campaign={campaign}
                isAdmin={true}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaign" className="mt-4">
        <div className="space-y-4">
      {/* Brand voice notice */}
      {brandVoice ? (
        <div className="flex items-center gap-2 text-xs text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-2">
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Brand voice active ({brandVoice.tone}, {brandVoice.language}) — AI will match your style
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <Zap className="w-3.5 h-3.5 flex-shrink-0" />
          No brand voice set.{' '}
          <Link to={createPageUrl('BrandVoiceSettings')} className="underline underline-offset-2 hover:text-amber-300">Set it up</Link>
          {' '}for better results.
        </div>
      )}

      {/* Step indicator */}
      {step !== 'mode' && (
        <div className="flex items-center gap-2">
          {steps.filter(s => s !== 'mode').map((s, i) => {
            const idx = steps.indexOf(s);
            const current = steps.indexOf(step);
            const done = idx < current;
            const active = s === step;
            return (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-1.5 text-xs font-medium ${active ? 'text-purple-400' : done ? 'text-teal-400' : 'text-slate-600'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-purple-500 text-white' : done ? 'bg-teal-500 text-white' : 'bg-[#2d2d3a] text-slate-500'}`}>
                    {done ? '✓' : i + 1}
                  </div>
                  {stepLabels[s]}
                </div>
                {i < steps.filter(s => s !== 'mode').length - 1 && (
                  <div className="flex-1 h-px bg-[#2d2d3a] max-w-8" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Step content */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-5">

          {/* MODE SELECTION */}
          {step === 'mode' && (
            <div className="space-y-4">
              <h2 className="text-white font-semibold text-base">How do you want to start?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {MODES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`text-left p-5 rounded-xl border-2 transition-all ${
                      mode === m.id ? 'border-purple-500 bg-purple-500/10' : 'border-[#2d2d3a] bg-[#17171f] hover:border-purple-500/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${mode === m.id ? 'bg-purple-500' : 'bg-[#2d2d3a]'}`}>
                        <m.icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-white font-semibold text-sm">{m.label}</span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed">{m.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TEMPLATE PICKER */}
          {step === 'template' && (
            <TemplatePickerStep
              companyVertical={company?.vertical || 'other'}
              selected={selectedTemplate}
              onSelect={setSelectedTemplate}
            />
          )}

          {/* FREE PROMPT */}
          {step === 'free' && (
            <FreePromptStep value={freePrompt} onChange={setFreePrompt} />
          )}

          {/* OFFER BUILDER */}
          {step === 'offer' && (
            <OfferBuilderStep
              products={products}
              offer={offer}
              onChange={setOffer}
            />
          )}

          {/* RESULTS / OPTIONS */}
          {step === 'result' && (
            generating ? (
              <div className="py-16 text-center space-y-4">
                <div className="relative mx-auto w-16 h-16">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 absolute inset-0" />
                  <Sparkles className="w-7 h-7 text-purple-400 absolute inset-0 m-auto" />
                </div>
                <div>
                  <p className="text-white font-medium">Generating your campaign...</p>
                  <p className="text-slate-500 text-sm mt-1">AI is crafting 3 angles with quality checks. ~30 seconds.</p>
                </div>
              </div>
            ) : campaign ? (
              <OptionsResultStep
                campaign={campaign}
                visualSuggestions={null}
                onSelect={setSelectedAngle}
                onPublish={handlePublish}
                isPublishing={isPublishing}
              />
            ) : (
              <div className="text-center py-12 text-slate-400">Something went wrong. <button onClick={goBack} className="underline">Go back</button></div>
            )
          )}
        </CardContent>
      </Card>

      {/* Navigation - only in campaign tab */}
      {step !== 'result' && (
        <div className="flex gap-3">
          {step !== 'mode' && (
            <Button variant="outline" className="border-[#2d2d3a] text-slate-400" onClick={goBack}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}
          <Button
            className={`flex-1 gap-2 ${step === 'offer' ? 'bg-purple-500 hover:bg-purple-600' : 'bg-[#2d2d3a] hover:bg-[#3d3d4a] text-slate-200'}`}
            onClick={goNext}
            disabled={!canProceed()}
          >
            {step === 'offer' ? (
              <><Sparkles className="w-4 h-4" /> Generate Campaign</>
            ) : (
              <>Next <ArrowRight className="w-4 h-4" /></>
            )}
          </Button>
        </div>
      )}
        </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}