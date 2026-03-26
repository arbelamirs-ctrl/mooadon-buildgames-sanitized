import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const PLATFORMS = [
  {
    id: 'facebook',
    label: 'Facebook',
    color: 'bg-blue-600 hover:bg-blue-700',
    icon: (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    getUrl: (text) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.origin)}&quote=${encodeURIComponent(text)}`
  },
  {
    id: 'instagram',
    label: 'Instagram',
    color: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:opacity-90',
    icon: (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
    getUrl: () => `https://www.instagram.com/`
  },
  {
    id: 'x',
    label: 'X (Twitter)',
    color: 'bg-black hover:bg-gray-900',
    icon: (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    getUrl: (text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    color: 'bg-blue-700 hover:bg-blue-800',
    icon: (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    getUrl: (text) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin)}&summary=${encodeURIComponent(text)}`
  }
];

export default function SocialShareButtons({ campaign, variant = 'a' }) {
  const text = variant === 'a'
    ? (campaign.ig_copy_a || campaign.fb_copy_a || `${campaign.product_name} — Use code: ${campaign.coupon_code}`)
    : (campaign.ig_copy_b || campaign.fb_copy_b || `${campaign.product_name} — Use code: ${campaign.coupon_code_b || campaign.coupon_code}`);

  const handleShare = (platform) => {
    navigator.clipboard.writeText(text).catch(() => {});
    toast.success(`Caption copied! Opening ${platform.label}...`, { duration: 3000 });
    setTimeout(() => {
      window.open(platform.getUrl(text), '_blank', 'noopener,noreferrer,width=600,height=600');
    }, 400);
  };

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Caption copied!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-3">
      {/* Caption preview */}
      <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Variant {variant.toUpperCase()} caption</span>
          <button
            onClick={handleCopy}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${copied ? 'text-green-400 bg-green-500/10' : 'text-slate-400 hover:text-white bg-[#2d2d3a] hover:bg-[#3d3d4a]'}`}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words">{text}</p>
      </div>

      {/* Note */}
      <p className="text-xs text-slate-500">ℹ️ הטקסט יועתק אוטומטית כשתלחץ על רשת — הדבק אותו בפוסט.</p>

      {/* Platform buttons */}
      <div className="flex flex-wrap gap-1.5">
        {PLATFORMS.map(p => (
          <Button
            key={p.id}
            size="sm"
            className={`${p.color} text-white text-xs h-7 gap-1.5 px-2.5`}
            onClick={() => handleShare(p)}
          >
            {p.icon}
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}