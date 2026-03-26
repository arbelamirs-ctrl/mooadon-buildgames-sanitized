import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import SocialShareButtons from './SocialShareButtons';

export default function ShareCampaignModal({ campaign, onClose }) {
  const [variant, setVariant] = useState('a');
  if (!campaign) return null;

  const text = variant === 'a'
    ? (campaign.ig_copy_a || campaign.fb_copy_a || `${campaign.product_name} — Use code: ${campaign.coupon_code}`)
    : (campaign.ig_copy_b || campaign.fb_copy_b || `${campaign.product_name} — Use code: ${campaign.coupon_code_b || campaign.coupon_code}`);

  const code = variant === 'a' ? campaign.coupon_code : (campaign.coupon_code_b || campaign.coupon_code);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#1f2128] border-[#2d2d3a] text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            🚀 Share Campaign — {campaign.product_name}
          </DialogTitle>
        </DialogHeader>

        {/* Variant tabs */}
        <div className="flex gap-2">
          {['a', ...(campaign.coupon_code_b ? ['b'] : [])].map(v => (
            <button
              key={v}
              onClick={() => setVariant(v)}
              className={`text-xs px-4 py-1.5 rounded-full border transition-colors font-medium ${
                variant === v
                  ? 'border-purple-500 text-purple-400 bg-purple-500/10'
                  : 'border-[#2d2d3a] text-slate-500 hover:text-slate-300'
              }`}
            >
              Variant {v.toUpperCase()}
            </button>
          ))}
          <Badge className="bg-teal-500/10 text-teal-400 ml-auto font-mono text-xs">{code}</Badge>
        </div>

        {/* Preview */}
        <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Preview</p>
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{text}</p>
          {campaign.hashtags && (
            <p className="text-xs text-blue-400 mt-2">{campaign.hashtags}</p>
          )}
        </div>

        {/* Share buttons */}
        <SocialShareButtons campaign={campaign} variant={variant} />
      </DialogContent>
    </Dialog>
  );
}