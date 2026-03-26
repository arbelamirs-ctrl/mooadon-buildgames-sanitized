import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Sparkles, Loader2, CheckCircle, ImageIcon, Play, Clock,
  Star, Send, ChevronDown, ChevronUp, Eye, Pencil, Check
} from 'lucide-react';
import { toast } from 'sonner';

const FORMATS = [
  { id: '9:16', label: 'Story', dims: '1080×1920', desc: 'Instagram / TikTok' },
  { id: '1:1', label: 'Square', dims: '1080×1080', desc: 'Instagram / Facebook' },
  { id: '16:9', label: 'Landscape', dims: '1920×1080', desc: 'YouTube / LinkedIn' },
];

const STYLES = [
  { id: 'minimal', label: 'Minimal', desc: 'Clean, product-first' },
  { id: 'bold', label: 'Bold', desc: 'High-contrast, energetic' },
  { id: 'elegant', label: 'Elegant', desc: 'Premium, refined' },
];

const STATUS_CONFIG = {
  draft:      { label: 'Draft',      color: 'bg-slate-500/20 text-slate-400' },
  generating: { label: 'Generating', color: 'bg-yellow-500/20 text-yellow-400' },
  review:     { label: 'In Review',  color: 'bg-blue-500/20 text-blue-400' },
  approved:   { label: 'Approved',   color: 'bg-teal-500/20 text-teal-400' },
  published:  { label: 'Published',  color: 'bg-green-500/20 text-green-400' },
  failed:     { label: 'Failed',     color: 'bg-red-500/20 text-red-400' },
};

// ── Creative preview card ────────────────────────────────────────────────────
function VideoCreativeCard({ creative, isSelected, onSelect, onApprove, onPublish, onReject, isAdmin }) {
  const [showReview, setShowReview] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const overlay = creative.overlay || {};
  const statusCfg = STATUS_CONFIG[creative.status] || STATUS_CONFIG.draft;
  const isPortrait = creative.format === '9:16';
  const isLandscape = creative.format === '16:9';

  const aspectStyle = isPortrait
    ? { aspectRatio: '9/16', maxHeight: 220 }
    : isLandscape
    ? { aspectRatio: '16/9' }
    : { aspectRatio: '1/1', maxHeight: 180 };

  return (
    <div
      className={`rounded-xl border-2 cursor-pointer transition-all overflow-hidden flex flex-col ${
        isSelected ? 'border-purple-500' : 'border-[#2d2d3a] hover:border-purple-500/40'
      }`}
      onClick={onSelect}
    >
      {/* Visual preview */}
      <div
        className="relative w-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-end overflow-hidden"
        style={aspectStyle}
      >
        {creative.thumbnail_url || creative.product_image_url ? (
          <img
            src={creative.thumbnail_url || creative.product_image_url}
            alt="creative"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.8 }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-slate-600" />
          </div>
        )}

        {/* Video play indicator */}
        {creative.video_url ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/50 rounded-full p-2.5">
              <Play className="w-5 h-5 text-white fill-white" />
            </div>
          </div>
        ) : creative.status === 'generating' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="text-center space-y-1">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin mx-auto" />
              <p className="text-[10px] text-slate-300">Rendering...</p>
            </div>
          </div>
        ) : null}

        {/* Overlay text preview */}
        {overlay.headline && (
          <div
            className="relative w-full px-2.5 py-2"
            style={{ background: (overlay.bg_color || '#000') + 'dd' }}
          >
            <p className="font-bold text-xs leading-tight truncate" style={{ color: overlay.text_color || '#fff' }}>
              {overlay.headline}
            </p>
            {overlay.offer_line && (
              <p className="text-[10px] opacity-80 truncate" style={{ color: overlay.text_color || '#fff' }}>
                {overlay.offer_line}
              </p>
            )}
            <span
              className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1"
              style={{ background: overlay.text_color || '#fff', color: overlay.bg_color || '#000' }}
            >
              {overlay.cta}
            </span>
          </div>
        )}

        {/* Selected check */}
        {isSelected && (
          <div className="absolute top-2 right-2 bg-purple-500 rounded-full p-0.5">
            <CheckCircle className="w-3.5 h-3.5 text-white" />
          </div>
        )}

        {/* Mock badge */}
        {creative.is_mock && (
          <div className="absolute top-2 left-2">
            <span className="text-[9px] bg-amber-500/80 text-white px-1.5 py-0.5 rounded font-medium">PREVIEW</span>
          </div>
        )}
      </div>

      {/* Meta bar */}
      <div className="px-2.5 py-2 bg-[#1f2128] flex-1 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white capitalize">{creative.template_style}</span>
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        </div>
        <p className="text-[10px] text-slate-500">{creative.format} · {creative.provider || 'mock'}</p>

        {/* Approval actions */}
        {isSelected && (
          <div className="mt-1 space-y-1.5">
            {creative.status === 'review' && isAdmin && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowReview(v => !v); }}
                  className="w-full text-[10px] text-slate-400 flex items-center gap-1 hover:text-white"
                >
                  <Pencil className="w-3 h-3" />
                  Add review note
                  {showReview ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                </button>
                {showReview && (
                  <Textarea
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    placeholder="Review notes..."
                    className="text-[10px] h-14 bg-[#17171f] border-[#2d2d3a] text-slate-300 resize-none"
                  />
                )}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    className="flex-1 h-6 text-[10px] bg-teal-500 hover:bg-teal-600"
                    onClick={(e) => { e.stopPropagation(); onApprove?.({ note: reviewNote }); }}
                  >
                    <Check className="w-3 h-3 mr-0.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-6 text-[10px] border-red-500/40 text-red-400 hover:bg-red-500/10"
                    onClick={(e) => { e.stopPropagation(); onReject?.({ note: reviewNote }); }}
                  >
                    Reject
                  </Button>
                </div>
              </>
            )}

            {creative.status === 'approved' && (
              <Button
                size="sm"
                className="w-full h-6 text-[10px] bg-green-500 hover:bg-green-600"
                onClick={(e) => { e.stopPropagation(); onPublish?.(); }}
              >
                <Send className="w-3 h-3 mr-1" /> Publish
              </Button>
            )}

            {creative.status === 'review' && !isAdmin && (
              <p className="text-[10px] text-blue-400 flex items-center gap-1">
                <Eye className="w-3 h-3" /> Awaiting approval
              </p>
            )}

            {(creative.status === 'draft' || creative.status === 'failed') && isAdmin && (
              <Button
                size="sm"
                className="w-full h-6 text-[10px] bg-blue-500 hover:bg-blue-600"
                onClick={(e) => { e.stopPropagation(); onApprove?.({ note: 'Auto-approved' }); }}
              >
                <Send className="w-3 h-3 mr-1" /> Send for Review
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Tab ─────────────────────────────────────────────────────────────────
export default function VideoCreativesTab({ companyId, products = [], campaign = null, isAdmin = false }) {
  const queryClient = useQueryClient();
  const [format, setFormat] = useState('9:16');
  const [selectedProductId, setSelectedProductId] = useState(campaign?.product_id || products[0]?.id || '');
  const [offerCta, setOfferCta] = useState('Shop Now');
  const [offerLine, setOfferLine] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [activeView, setActiveView] = useState('generate'); // 'generate' | 'library'

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Load existing video creatives for this company
  const { data: videoCreatives = [], refetch } = useQuery({
    queryKey: ['video-creatives', companyId],
    queryFn: () => base44.entities.VideoCreative.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  // Current session creatives (just generated)
  const [sessionCreatives, setSessionCreatives] = useState([]);

  const displayCreatives = activeView === 'generate' ? sessionCreatives : videoCreatives;

  const handleGenerate = async () => {
    if (!selectedProductId) return toast.error('Select a product');
    setGenerating(true);
    setSessionCreatives([]);
    setSelectedIdx(null);

    try {
      const res = await base44.functions.invoke('generateBrandedVideoCreatives', {
        company_id: companyId,
        product_id: selectedProductId,
        format,
        offer_cta: offerCta,
        offer_line: offerLine || null,
        campaign_id: campaign?.id || null,
      });

      if (res.data?.success && res.data?.creatives?.length) {
        const creatives = res.data.creatives.map(c => ({
          ...c,
          overlay: c.overlay || (c.overlay_spec ? JSON.parse(c.overlay_spec) : {}),
        }));
        setSessionCreatives(creatives);
        if (res.data.mock_mode) {
          toast.success(`3 video creatives ready! (Preview mode — connect Runway API for real video)`);
        } else {
          toast.success(`3 video creatives generated!`);
        }
      } else {
        toast.error(res.data?.error || 'Generation failed');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusUpdate = async (creativeId, status, reviewNote = '') => {
    try {
      await base44.entities.VideoCreative.update(creativeId, {
        status,
        review_notes: reviewNote || undefined,
        reviewed_by: undefined, // will be set by backend ideally
        published_at: status === 'published' ? new Date().toISOString() : undefined,
      });
      // Update session creatives locally
      setSessionCreatives(prev => prev.map(c => c.id === creativeId ? { ...c, status } : c));
      queryClient.invalidateQueries({ queryKey: ['video-creatives', companyId] });
      const label = { review: 'Sent for review', approved: 'Approved!', published: 'Published!', draft: 'Reverted to draft' }[status] || status;
      toast.success(label);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleSetPrimary = async (creativeId) => {
    try {
      // Unset all primaries first
      await Promise.all(
        videoCreatives.filter(c => c.is_primary).map(c =>
          base44.entities.VideoCreative.update(c.id, { is_primary: false })
        )
      );
      await base44.entities.VideoCreative.update(creativeId, { is_primary: true });
      queryClient.invalidateQueries({ queryKey: ['video-creatives', companyId] });
      setSessionCreatives(prev => prev.map(c => ({ ...c, is_primary: c.id === creativeId })));
      toast.success('Set as primary creative!');
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header tabs */}
      <div className="flex gap-2 border-b border-[#2d2d3a] pb-2">
        <button
          onClick={() => setActiveView('generate')}
          className={`text-xs font-medium px-3 py-1.5 rounded-t-lg transition-colors ${activeView === 'generate' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Generate New
        </button>
        <button
          onClick={() => setActiveView('library')}
          className={`text-xs font-medium px-3 py-1.5 rounded-t-lg transition-colors ${activeView === 'library' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Library
          {videoCreatives.length > 0 && (
            <span className="ml-1.5 bg-[#2d2d3a] text-slate-400 text-[9px] px-1.5 py-0.5 rounded-full">
              {videoCreatives.length}
            </span>
          )}
        </button>
      </div>

      {activeView === 'generate' && (
        <>
          <p className="text-xs text-slate-400">Generate branded video ads using your product image + brand kit. Uses Runway ML with automatic fallback.</p>

          {/* Product selector */}
          {products.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Product</label>
              <div className="flex gap-2 flex-wrap">
                {products.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                      selectedProductId === p.id ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-[#2d2d3a] text-slate-400 hover:border-purple-500/30'
                    }`}
                  >
                    {(p.product_image_url || p.image_url) && (
                      <img src={p.product_image_url || p.image_url} className="w-5 h-5 rounded object-cover" />
                    )}
                    {!(p.product_image_url || p.image_url) && <ImageIcon className="w-3 h-3" />}
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product image warning */}
          {selectedProductId && !selectedProduct?.product_image_url && !selectedProduct?.image_url && (
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              ⚠ No product image. Upload one in Products Admin for best results.
            </div>
          )}

          {/* Format selector */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Format</label>
            <div className="flex gap-2 flex-wrap">
              {FORMATS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    format === f.id ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-[#2d2d3a] text-slate-400 hover:border-purple-500/30'
                  }`}
                >
                  <span className="font-medium">{f.label}</span>
                  <span className="ml-1 opacity-60">{f.id}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Offer fields */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">CTA Text</label>
              <input
                value={offerCta}
                onChange={e => setOfferCta(e.target.value)}
                placeholder="Shop Now"
                className="w-full bg-[#17171f] border border-[#2d2d3a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Offer Line (optional)</label>
              <input
                value={offerLine}
                onChange={e => setOfferLine(e.target.value)}
                placeholder="Get 20% off today"
                className="w-full bg-[#17171f] border border-[#2d2d3a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Styles preview */}
          <div className="flex gap-2">
            {STYLES.map(s => (
              <div key={s.id} className="flex-1 p-2 rounded-lg bg-[#17171f] border border-[#2d2d3a] text-center">
                <p className="text-[10px] font-semibold text-white">{s.label}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Generate button */}
          <Button
            className="w-full bg-purple-500 hover:bg-purple-600 gap-2"
            onClick={handleGenerate}
            disabled={generating || !selectedProductId}
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating 3 video variants...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate 3 Branded Videos</>
            )}
          </Button>

          {/* Generated creatives grid */}
          {sessionCreatives.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">Select a variant → approve or publish</p>
                {sessionCreatives.some(c => c.is_mock) && (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    Preview mode — add RUNWAY_API_KEY for real videos
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {sessionCreatives.map((creative, i) => (
                  <VideoCreativeCard
                    key={creative.id || i}
                    creative={creative}
                    isSelected={selectedIdx === i}
                    isAdmin={isAdmin}
                    onSelect={() => setSelectedIdx(i)}
                    onApprove={({ note }) => handleStatusUpdate(creative.id, 'approved', note)}
                    onReject={({ note }) => handleStatusUpdate(creative.id, 'draft', note)}
                    onPublish={() => handleStatusUpdate(creative.id, 'published')}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Library view */}
      {activeView === 'library' && (
        <div className="space-y-3">
          {videoCreatives.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              No video creatives yet. Generate your first one!
            </div>
          ) : (
            <>
              {/* Status filter pills */}
              <div className="flex gap-1.5 flex-wrap">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                  const count = videoCreatives.filter(c => c.status === key).length;
                  if (count === 0) return null;
                  return (
                    <span key={key} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                      {cfg.label} ({count})
                    </span>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {videoCreatives.map((creative, i) => (
                  <VideoCreativeCard
                    key={creative.id}
                    creative={{
                      ...creative,
                      overlay: creative.overlay_spec ? JSON.parse(creative.overlay_spec) : {},
                    }}
                    isSelected={selectedIdx === i + 1000}
                    isAdmin={isAdmin}
                    onSelect={() => setSelectedIdx(i + 1000)}
                    onApprove={({ note }) => handleStatusUpdate(creative.id, 'approved', note)}
                    onReject={({ note }) => handleStatusUpdate(creative.id, 'draft', note)}
                    onPublish={() => handleStatusUpdate(creative.id, 'published')}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}