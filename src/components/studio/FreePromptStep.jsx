import React from 'react';

export default function FreePromptStep({ value, onChange }) {
  const set = (key, val) => onChange({ ...value, [key]: val });

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">Describe what you want to promote in your own words. The AI will suggest angles and generate campaign copy.</p>

      <div>
        <label className="text-slate-300 text-xs font-medium mb-1.5 block">What do you want to promote? *</label>
        <textarea
          value={value.description || ''}
          onChange={e => set('description', e.target.value)}
          placeholder="e.g., We're launching our new summer collection of handmade earrings. We want to drive traffic to the store this weekend."
          rows={4}
          className="w-full bg-[#17171f] border border-[#2d2d3a] rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-600 resize-none focus:outline-none focus:border-purple-500/60"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-slate-400 text-xs mb-1.5 block">Target audience (optional)</label>
          <input
            value={value.audience || ''}
            onChange={e => set('audience', e.target.value)}
            placeholder="e.g., Women 25–45, local area"
            className="w-full bg-[#17171f] border border-[#2d2d3a] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-purple-500/60"
          />
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1.5 block">Constraints / notes (optional)</label>
          <input
            value={value.notes || ''}
            onChange={e => set('notes', e.target.value)}
            placeholder="e.g., No price mentions, family-friendly"
            className="w-full bg-[#17171f] border border-[#2d2d3a] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-purple-500/60"
          />
        </div>
      </div>
    </div>
  );
}