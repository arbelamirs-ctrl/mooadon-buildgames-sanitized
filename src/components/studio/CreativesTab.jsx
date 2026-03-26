import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Download, CheckCircle, ImageIcon, Upload } from 'lucide-react';
import { toast } from 'sonner';

const FORMATS = [
  { id: 'story', label: 'IG Story', dims: '1080×1920', aspect: '9/16' },
  { id: 'post', label: 'IG Post', dims: '1080×1080', aspect: '1/1' },
];

const TEMPLATE_STYLES = [
  { id: 'minimal', label: 'Minimal', desc: 'Clean, product-first' },
  { id: 'bold', label: 'Bold', desc: 'High contrast, energetic' },
  { id: 'elegant', label: 'Elegant', desc: 'Premium, refined' },
];

// Canvas-based creative renderer
function CreativeCard({ creative, isSelected, onSelect, onSetPrimary }) {
  const { overlay, product_image_url, company_logo_url, brand_colors, template_name, dimensions } = creative;
  const isStory = dimensions?.h > dimensions?.w;

  return (
    <div
      className={`relative rounded-xl border-2 cursor-pointer transition-all overflow-hidden ${isSelected ? 'border-purple-500' : 'border-[#2d2d3a] hover:border-purple-500/50'}`}
      onClick={onSelect}
    >
      {/* Creative Preview */}
      <div
        className="relative w-full bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-end overflow-hidden"
        style={{ aspectRatio: isStory ? '9/16' : '1/1', minHeight: isStory ? 180 : 120 }}
      >
        {/* Product image background */}
        {product_image_url && (
          <img
            src={product_image_url}
            alt="product"
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
        )}
        {!product_image_url && (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-slate-600" />
          </div>
        )}

        {/* Overlay panel */}
        <div
          className="relative w-full px-3 py-2.5"
          style={{ background: overlay.bg_color + 'ee' }}
        >
          {/* Logo small */}
          {company_logo_url && (
            <img src={company_logo_url} alt="logo" className="h-4 mb-1 object-contain opacity-80" />
          )}
          <p className="font-bold text-sm leading-tight truncate" style={{ color: overlay.text_color }}>
            {overlay.headline}
          </p>
          {overlay.offer_line && (
            <p className="text-xs mt-0.5 opacity-90 truncate" style={{ color: overlay.text_color }}>
              {overlay.offer_line}
            </p>
          )}
          <div
            className="mt-1.5 inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: overlay.text_color, color: overlay.bg_color }}
          >
            {overlay.cta}
          </div>
        </div>

        {/* Selected checkmark */}
        {isSelected && (
          <div className="absolute top-2 right-2 bg-purple-500 rounded-full p-0.5">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="px-2.5 py-2 bg-[#1f2128]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-300">{template_name}</span>
          <div className="flex gap-0.5">
            {(creative.brand_colors?.primary ? [creative.brand_colors.primary, creative.brand_colors.secondary] : []).map((c, i) => (
              <div key={i} className="w-3 h-3 rounded-full border border-white/10" style={{ background: c }} />
            ))}
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5">{overlay.headline}</p>
      </div>

      {isSelected && (
        <div className="px-2.5 pb-2 bg-[#1f2128]">
          <Button
            size="sm"
            className="w-full text-xs h-6 bg-purple-500 hover:bg-purple-600"
            onClick={(e) => { e.stopPropagation(); onSetPrimary?.(); }}
          >
            Set as Primary
          </Button>
        </div>
      )}
    </div>
  );
}

export default function CreativesTab({ companyId, products = [], campaign = null, onCreativeSelected }) {
  const [format, setFormat] = useState('post');
  const [generating, setGenerating] = useState(false);
  const [creatives, setCreatives] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(campaign?.product_id || products[0]?.id || '');
  const [uploadingImg, setUploadingImg] = useState(false);

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const hasProductImage = !!(selectedProduct?.product_image_url || selectedProduct?.image_url);

  const handleUploadImage = async (file) => {
    if (!selectedProductId) return toast.error('Select a product first');
    setUploadingImg(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Product.update(selectedProductId, { product_image_url: file_url });
      toast.success('Product image uploaded!');
      // Refresh product data by re-querying (parent should invalidate)
      onCreativeSelected?.({ type: 'product_image_updated', product_id: selectedProductId, image_url: file_url });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploadingImg(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedProductId) return toast.error('Select a product');
    setGenerating(true);
    setCreatives([]);
    setSelectedIdx(null);
    try {
      const res = await base44.functions.invoke('generateAdCreativesWithAI', {
        company_id: companyId,
        product_id: selectedProductId,
        campaign_copy: campaign ? {
          ig_copy_a: campaign.ig_copy_a,
          cta: campaign.cta,
        } : null,
        format,
      });
      if (res.data?.success && res.data?.creatives?.length) {
        setCreatives(res.data.creatives);
        toast.success(`${res.data.creatives.length} creatives generated!`);
      } else {
        toast.error(res.data?.error || 'Generation failed');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSetPrimary = (creative) => {
    onCreativeSelected?.({ type: 'primary', creative });
    toast.success('Creative set as primary!');
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">Generate agency-quality ad creatives using your product image and brand kit.</p>

      {/* Product selector */}
      {products.length > 0 && (
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Product</label>
          <div className="flex gap-2 flex-wrap">
            {products.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProductId(p.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${selectedProductId === p.id ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-[#2d2d3a] text-slate-400 hover:border-purple-500/30'}`}
              >
                {(p.product_image_url || p.image_url) && (
                  <img src={p.product_image_url || p.image_url} className="w-5 h-5 rounded object-cover" />
                )}
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Product image upload */}
      {selectedProductId && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#17171f] border border-[#2d2d3a]">
          {selectedProduct?.product_image_url || selectedProduct?.image_url ? (
            <img src={selectedProduct.product_image_url || selectedProduct.image_url} className="w-12 h-12 rounded-lg object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-[#2d2d3a] flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-slate-500" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-xs text-white font-medium">{selectedProduct?.name}</p>
            <p className="text-[10px] text-slate-500">{hasProductImage ? 'Product image ready' : 'No product image — upload for best results'}</p>
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUploadImage(e.target.files[0])}
            />
            <Button size="sm" variant="outline" className="border-[#2d2d3a] text-slate-400 text-xs gap-1" disabled={uploadingImg} asChild={false}>
              {uploadingImg ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {hasProductImage ? 'Replace' : 'Upload'}
            </Button>
          </label>
        </div>
      )}

      {/* Format selector */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Format</label>
        <div className="flex gap-2">
          {FORMATS.map(f => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${format === f.id ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-[#2d2d3a] text-slate-400 hover:border-purple-500/30'}`}
            >
              <span className="font-medium">{f.label}</span>
              <span className="ml-1 text-slate-500">{f.dims}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <Button
        className="w-full bg-purple-500 hover:bg-purple-600 gap-2"
        onClick={handleGenerate}
        disabled={generating || !selectedProductId}
      >
        {generating ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Generating 3 creatives...</>
        ) : (
          <><Sparkles className="w-4 h-4" /> Generate 3 Creatives</>
        )}
      </Button>

      {/* Creatives grid */}
      {creatives.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-2">Select one → Set as Primary</p>
          <div className="grid grid-cols-3 gap-3">
            {creatives.map((creative, i) => (
              <CreativeCard
                key={i}
                creative={creative}
                isSelected={selectedIdx === i}
                onSelect={() => setSelectedIdx(i)}
                onSetPrimary={() => handleSetPrimary(creative)}
              />
            ))}
          </div>

          <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
            <span>💡</span>
            <span>Creatives use your product image + brand colors. Upload a high-quality product photo for best results.</span>
          </div>
        </div>
      )}
    </div>
  );
}