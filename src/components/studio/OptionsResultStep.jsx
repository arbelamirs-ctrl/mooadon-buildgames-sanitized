import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ANGLE_OPTIONS } from './CAMPAIGN_TEMPLATES';
import { Copy, CheckCircle, Eye, Sparkles, Image } from 'lucide-react';
import { toast } from 'sonner';

const ANGLE_COLORS = {
  benefit: 'border-blue-500 bg-blue-500/10',
  scarcity: 'border-amber-500 bg-amber-500/10',
  story: 'border-purple-500 bg-purple-500/10',
};

const ANGLE_BADGE = {
  benefit: 'bg-blue-500/20 text-blue-400',
  scarcity: 'bg-amber-500/20 text-amber-400',
  story: 'bg-purple-500/20 text-purple-400',
};

function PlatformCopy({ label, text }) {
  if (!text) return null;
  return (
    <div className="bg-[#17171f] rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(text); toast.success(`${label} copy copied!`); }}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Copy className="w-3 h-3" />
        </button>
      </div>
      <p className="text-slate-200 text-xs leading-relaxed">{text}</p>
    </div>
  );
}

function VisualIdeas({ suggestions }) {
  if (!suggestions) return null;
  let data = null;
  try { data = typeof suggestions === 'string' ? JSON.parse(suggestions) : suggestions; } catch { return null; }
  const shots = data?.shots || [];
  const overlays = data?.overlay_texts || [];
  const donts = data?.do_not_list || [];

  return (
    <div className="space-y-3 mt-3 border-t border-[#2d2d3a] pt-3">
      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
        <Image className="w-3.5 h-3.5" /> Visual Ideas
      </div>
      {shots.length > 0 && (
        <div className="space-y-1.5">
          {shots.slice(0, 3).map((shot, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-slate-600 font-mono w-4 flex-shrink-0">{i + 1}.</span>
              <div>
                <span className="text-slate-300">{shot.scene || shot.description || JSON.stringify(shot)}</span>
                {shot.platform && <Badge className="ml-2 bg-slate-500/10 text-slate-500 text-[10px]">{shot.platform}</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
      {overlays.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {overlays.map((ov, i) => (
            <span key={i} className="text-xs bg-[#2d2d3a] text-slate-300 px-2 py-1 rounded">"{ov}"</span>
          ))}
        </div>
      )}
      {donts.length > 0 && (
        <div className="text-xs text-red-400/70">
          <span className="font-medium">Avoid: </span>{donts.join(' · ')}
        </div>
      )}
    </div>
  );
}

export default function OptionsResultStep({ campaign, visualSuggestions, onSelect, onPublish, isPublishing }) {
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [showVisual, setShowVisual] = useState(false);

  // Build 3 angle options from the campaign
  const options = ANGLE_OPTIONS.map(angle => {
    const igCopy = angle.id === 'benefit' ? campaign.ig_copy_a
      : angle.id === 'scarcity' ? campaign.ig_copy_b
      : campaign.fb_copy_a;
    const xCopy = angle.id === 'benefit' ? campaign.x_copy_a
      : angle.id === 'scarcity' ? campaign.x_copy_b
      : campaign.fb_copy_b;
    const fbCopy = angle.id === 'benefit' ? campaign.fb_copy_a
      : angle.id === 'scarcity' ? campaign.fb_copy_b
      : campaign.linkedin_copy_a;
    return { ...angle, igCopy, xCopy, fbCopy };
  }).filter(o => o.igCopy);

  const handleSelect = (opt) => {
    setSelected(opt.id);
    onSelect?.(opt);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-medium">Choose your angle</p>
          <p className="text-slate-500 text-xs mt-0.5">Pick the angle that fits your goal. You can then publish or A/B test.</p>
        </div>
        {campaign.ai_quality_score > 0 && (
          <Badge className={`text-xs ${campaign.ai_quality_score >= 85 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
            Quality: {campaign.ai_quality_score}/100
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        {options.map(opt => {
          const isSelected = selected === opt.id;
          const isExpanded = expanded === opt.id;
          return (
            <div
              key={opt.id}
              className={`rounded-xl border transition-all ${isSelected ? ANGLE_COLORS[opt.id] : 'border-[#2d2d3a] bg-[#17171f]'}`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-semibold">{opt.label}</span>
                        <Badge className={`text-xs ${ANGLE_BADGE[opt.id]}`}>{opt.description}</Badge>
                      </div>
                      <p className="text-slate-400 text-xs mt-1.5 line-clamp-2">{opt.igCopy}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : opt.id)}
                      className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                      title="Preview all platforms"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleSelect(opt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                        isSelected
                          ? 'bg-green-500 text-white'
                          : 'bg-[#2d2d3a] text-slate-300 hover:bg-purple-500 hover:text-white'
                      }`}
                    >
                      {isSelected ? <><CheckCircle className="w-3 h-3" /> Selected</> : 'Select'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-2 border-t border-[#2d2d3a] pt-3">
                    <PlatformCopy label="Instagram" text={opt.igCopy} />
                    <PlatformCopy label="X / Twitter" text={opt.xCopy} />
                    <PlatformCopy label="Facebook" text={opt.fbCopy} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual Ideas */}
      {visualSuggestions && (
        <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-4">
          <button
            onClick={() => setShowVisual(v => !v)}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            <Image className="w-4 h-4 text-teal-400" />
            <span className="font-medium">Visual Suggestions</span>
            <span className="text-slate-600 text-xs">({showVisual ? 'hide' : 'show'})</span>
          </button>
          {showVisual && <VisualIdeas suggestions={visualSuggestions} />}
        </div>
      )}

      {/* Actions */}
      {selected && (
        <div className="flex gap-3 pt-2">
          <Button
            className="flex-1 bg-green-500 hover:bg-green-600 gap-2"
            onClick={() => onPublish('published')}
            disabled={isPublishing}
          >
            <Sparkles className="w-4 h-4" />
            {isPublishing ? 'Publishing...' : 'Publish Now'}
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-[#2d2d3a] text-slate-300 gap-2"
            onClick={() => onPublish('draft')}
            disabled={isPublishing}
          >
            Save as Draft
          </Button>
        </div>
      )}
    </div>
  );
}