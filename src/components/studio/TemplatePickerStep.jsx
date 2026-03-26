import React from 'react';
import { CAMPAIGN_TEMPLATES } from './CAMPAIGN_TEMPLATES';

const OBJECTIVE_COLORS = {
  traffic: 'bg-green-500/20 text-green-400',
  conversion: 'bg-blue-500/20 text-blue-400',
  loyalty: 'bg-purple-500/20 text-purple-400',
  awareness: 'bg-teal-500/20 text-teal-400',
  reactivation: 'bg-amber-500/20 text-amber-400',
};

export default function TemplatePickerStep({ companyVertical, selected, onSelect }) {
  const sorted = [...CAMPAIGN_TEMPLATES].sort((a, b) => {
    const aMatch = a.best_for.includes(companyVertical) ? -1 : 0;
    const bMatch = b.best_for.includes(companyVertical) ? -1 : 0;
    return aMatch - bMatch;
  });

  return (
    <div className="space-y-3">
      <p className="text-slate-400 text-sm">Pick a campaign type. The AI will use this as a starting point for your copy and angles.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sorted.map(tmpl => {
          const isMatch = tmpl.best_for.includes(companyVertical);
          const isSelected = selected?.id === tmpl.id;
          return (
            <button
              key={tmpl.id}
              onClick={() => onSelect(tmpl)}
              className={`text-left p-4 rounded-xl border transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-[#2d2d3a] bg-[#17171f] hover:border-purple-500/40 hover:bg-[#1f2128]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{tmpl.emoji}</span>
                  <div>
                    <div className="text-white text-sm font-medium">{tmpl.name}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{tmpl.description}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${OBJECTIVE_COLORS[tmpl.objective] || 'bg-slate-500/20 text-slate-400'}`}>
                    {tmpl.objective}
                  </span>
                  {isMatch && (
                    <span className="text-xs text-teal-400">✓ Best fit</span>
                  )}
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500 italic">{tmpl.platform_notes}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}