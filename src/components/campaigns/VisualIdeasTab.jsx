import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Sparkles, Loader2, Camera, Palette, AlertTriangle, Monitor } from 'lucide-react';
import { toast } from 'sonner';

function CopyBtn({ text }) {
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); toast.success('Copied!'); }}
      className="ml-1 text-slate-500 hover:text-teal-400 transition-colors"
    >
      <Copy className="w-3 h-3 inline" />
    </button>
  );
}

function ShotCard({ shot, idx }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#17171f] rounded-lg p-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-teal-400 font-bold text-sm">{idx + 1}.</span>
          <span className="text-white text-sm font-medium">{shot.title}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {shot.best_platform && (
            <Badge className="bg-slate-500/10 text-slate-400 text-xs">{shot.best_platform}</Badge>
          )}
          <span className="text-slate-600 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-[#2d2d3a] pt-3">
          <p className="text-slate-300 text-xs leading-relaxed">{shot.scene}<CopyBtn text={shot.scene} /></p>
          {shot.composition && (
            <div>
              <span className="text-slate-500 text-xs font-medium">Composition: </span>
              <span className="text-slate-300 text-xs">{shot.composition}</span>
            </div>
          )}
          {shot.lighting && (
            <div>
              <span className="text-slate-500 text-xs font-medium">Lighting: </span>
              <span className="text-slate-300 text-xs">{shot.lighting}</span>
            </div>
          )}
          {shot.props?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {shot.props.map((p, i) => (
                <Badge key={i} className="bg-slate-700/50 text-slate-300 text-xs">{p}</Badge>
              ))}
            </div>
          )}
          {shot.mood && (
            <p className="text-slate-500 text-xs italic">Mood: {shot.mood}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function VisualIdeasTab({ campaign, variant = 'a' }) {
  const queryClient = useQueryClient();

  const { data: existing } = useQuery({
    queryKey: ['visual-suggestions', campaign.id, variant],
    queryFn: async () => {
      const all = await base44.entities.CampaignCreativeSuggestion.filter({ campaign_id: campaign.id });
      return all.find(s => s.variant === variant) || null;
    }
  });

  const generateMutation = useMutation({
    mutationFn: () => base44.functions.invoke('generateImageSuggestionsWithAI', {
      campaign_id: campaign.id,
      variant
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visual-suggestions', campaign.id, variant] });
      toast.success('Visual ideas generated!');
    },
    onError: (e) => toast.error('Failed: ' + e.message)
  });

  const data = existing || generateMutation.data?.data?.suggestion;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-medium flex items-center gap-2">
            <Camera className="w-4 h-4 text-teal-400" />
            Visual Ideas — Variant {variant.toUpperCase()}
          </p>
          <p className="text-slate-500 text-xs mt-0.5">AI-generated shot list & creative direction. No image generation — use as brief for your photographer/designer.</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-teal-500/30 text-teal-400 hover:bg-teal-500/10 gap-1.5"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {data ? 'Regenerate' : 'Generate'}
        </Button>
      </div>

      {!data && !generateMutation.isPending && (
        <div className="bg-[#17171f] rounded-lg p-8 text-center text-slate-500 text-sm">
          Click "Generate" to get AI visual suggestions for this campaign
        </div>
      )}

      {generateMutation.isPending && (
        <div className="bg-[#17171f] rounded-lg p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-teal-400 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">Generating visual brief…</p>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Shot List */}
          <div>
            <p className="text-slate-400 text-xs font-medium mb-2 flex items-center gap-1.5">
              <Camera className="w-3 h-3" /> Shot List (5 scenes)
            </p>
            <div className="space-y-2">
              {(data.shots || []).map((shot, i) => (
                <ShotCard key={i} shot={shot} idx={i} />
              ))}
            </div>
          </div>

          {/* Overlay texts */}
          {data.overlay_texts?.length > 0 && (
            <div>
              <p className="text-slate-400 text-xs font-medium mb-2 flex items-center gap-1.5">
                <Monitor className="w-3 h-3" /> Overlay Text Options
              </p>
              <div className="space-y-1.5">
                {data.overlay_texts.map((t, i) => (
                  <div key={i} className="bg-[#17171f] rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-white text-sm font-medium">"{t}"</span>
                    <CopyBtn text={t} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Style notes */}
          {data.style_notes && (
            <div className="bg-[#17171f] rounded-lg p-3">
              <p className="text-slate-400 text-xs font-medium mb-1.5 flex items-center gap-1.5">
                <Palette className="w-3 h-3" /> Style Direction
              </p>
              <p className="text-slate-300 text-xs leading-relaxed">{data.style_notes}<CopyBtn text={data.style_notes} /></p>
            </div>
          )}

          {/* Platform notes */}
          {data.platform_notes && Object.keys(data.platform_notes).length > 0 && (
            <div className="bg-[#17171f] rounded-lg p-3">
              <p className="text-slate-400 text-xs font-medium mb-2">Per-Platform Notes</p>
              <div className="space-y-1.5">
                {Object.entries(data.platform_notes).map(([platform, note]) => (
                  <div key={platform} className="flex gap-2">
                    <span className="text-teal-400 text-xs font-medium w-16 flex-shrink-0 capitalize">{platform}:</span>
                    <span className="text-slate-300 text-xs">{note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Do-not list */}
          {data.do_not_list?.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-xs font-medium mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> Do Not Use
              </p>
              <div className="space-y-1">
                {data.do_not_list.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-red-500 text-xs mt-0.5">✕</span>
                    <span className="text-slate-300 text-xs">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}