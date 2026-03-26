import React from 'react';

const DISCOUNT_TYPES = [
  { value: 'percent', label: '% Off' },
  { value: 'tokens', label: 'Token Value' },
  { value: 'free', label: 'Free Item' },
];

export default function OfferBuilderStep({ products, offer, onChange }) {
  const set = (key, val) => onChange({ ...offer, [key]: val });

  const selectedProduct = products.find(p => p.id === offer.product_id);

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">Define your offer precisely so the AI generates accurate, compelling copy — no guessing.</p>

      {/* Product */}
      <div>
        <label className="text-slate-300 text-xs font-medium mb-1.5 block">Product *</label>
        <select
          value={offer.product_id ?? ''}
          onChange={e => {
            const p = products.find(x => x.id === e.target.value);
            if (p) {
              onChange({ ...offer, product_id: p.id, product_name: p.name, price: p.price_tokens });
            } else {
              onChange({ ...offer, product_id: '' });
            }
          }}
          className="w-full bg-[#17171f] border border-[#2d2d3a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/60"
        >
          <option value="" disabled>Select a product...</option>
          {(products || []).map(p => (
            <option key={p.id} value={p.id}>{p.name} — {p.price_tokens} pts</option>
          ))}
        </select>
      </div>

      {/* Discount */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-slate-400 text-xs mb-1.5 block">Discount type</label>
          <div className="flex gap-1">
            {DISCOUNT_TYPES.map(d => (
              <button
                key={d.value}
                onClick={() => set('discount_type', d.value)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                  offer.discount_type === d.value
                    ? 'bg-purple-500 text-white'
                    : 'bg-[#17171f] border border-[#2d2d3a] text-slate-400 hover:text-white'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1.5 block">
            {offer.discount_type === 'percent' ? 'Discount %' : offer.discount_type === 'free' ? 'Free item name' : 'Token value off'}
          </label>
          <input
            value={offer.discount_value || ''}
            onChange={e => set('discount_value', e.target.value)}
            placeholder={offer.discount_type === 'percent' ? '20' : offer.discount_type === 'free' ? 'Coffee' : '50'}
            className="w-full bg-[#17171f] border border-[#2d2d3a] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-purple-500/60"
          />
        </div>
      </div>

      {/* Expiry + Max redemptions */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-slate-400 text-xs mb-1.5 block">Offer expiry date</label>
          <input
            type="date"
            value={offer.expires_at ? offer.expires_at.split('T')[0] : ''}
            onChange={e => set('expires_at', e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="w-full bg-[#17171f] border border-[#2d2d3a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/60 [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1.5 block">Max redemptions (optional)</label>
          <input
            type="number"
            value={offer.max_redemptions || ''}
            onChange={e => set('max_redemptions', e.target.value)}
            placeholder="e.g., 100"
            className="w-full bg-[#17171f] border border-[#2d2d3a] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-purple-500/60"
          />
        </div>
      </div>

      {/* Fine print */}
      <div>
        <label className="text-slate-400 text-xs mb-1.5 block">Fine print / T&C (optional)</label>
        <input
          value={offer.fine_print || ''}
          onChange={e => set('fine_print', e.target.value)}
          placeholder="e.g., One per customer. Cannot be combined with other offers."
          className="w-full bg-[#17171f] border border-[#2d2d3a] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-purple-500/60"
        />
      </div>

      {/* Summary */}
      {selectedProduct && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-xs text-purple-300">
          <span className="font-medium">Offer summary: </span>
          {selectedProduct.name}
          {offer.discount_type === 'percent' && offer.discount_value ? ` — ${offer.discount_value}% off` : ''}
          {offer.discount_type === 'tokens' && offer.discount_value ? ` — ${offer.discount_value} tokens off` : ''}
          {offer.discount_type === 'free' && offer.discount_value ? ` — free ${offer.discount_value}` : ''}
          {offer.expires_at ? ` · expires ${new Date(offer.expires_at).toLocaleDateString()}` : ''}
        </div>
      )}
    </div>
  );
}