import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import OpenAI from 'npm:openai';

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

// ─── Template Layout Specs ────────────────────────────────────────────────────
const TEMPLATE_SPECS = {
  minimal: {
    style: 'minimal',
    name: 'Minimal',
    description: 'Clean, product-first. White space, single bold headline at bottom.',
    layout: {
      product_image: { position: 'fill', opacity: 0.9 },
      overlay: { position: 'bottom', height_pct: 30 },
      headline: { size: 'xl', weight: 'bold', align: 'left' },
      offer_line: { size: 'sm', weight: 'regular', visible: true },
      cta: { style: 'pill', position: 'inline' },
      logo: { position: 'top-left', size: 'sm' },
      animation: 'fade-up',
    },
    max_chars: { headline: 32, offer: 28, cta: 15 },
  },
  bold: {
    style: 'bold',
    name: 'Bold',
    description: 'High contrast, energetic. Big text centered, strong CTA badge.',
    layout: {
      product_image: { position: 'fill', opacity: 0.7 },
      overlay: { position: 'center', height_pct: 50 },
      headline: { size: '3xl', weight: 'extrabold', align: 'center' },
      offer_line: { size: 'lg', weight: 'bold', visible: true },
      cta: { style: 'badge', position: 'below-headline' },
      logo: { position: 'top-right', size: 'md' },
      animation: 'zoom-punch',
    },
    max_chars: { headline: 24, offer: 20, cta: 12 },
  },
  elegant: {
    style: 'elegant',
    name: 'Elegant',
    description: 'Premium feel. Soft overlay top, refined typography.',
    layout: {
      product_image: { position: 'fill', opacity: 0.85 },
      overlay: { position: 'top', height_pct: 35 },
      headline: { size: 'lg', weight: 'light', align: 'center', letterSpacing: 'wide' },
      offer_line: { size: 'xs', weight: 'regular', visible: true },
      cta: { style: 'outline-pill', position: 'bottom-bar' },
      logo: { position: 'center-top', size: 'md' },
      animation: 'gentle-float',
    },
    max_chars: { headline: 38, offer: 30, cta: 18 },
  },
};

// ─── Provider Adapters ────────────────────────────────────────────────────────

// RunwayAdapter: primary provider
// In production, call Runway ML Gen-3 API. Here we build the prompt spec.
async function runwayAdapter({ prompt, product_image_url, duration_secs = 5 }) {
  const runwayApiKey = Deno.env.get('RUNWAY_API_KEY');

  if (!runwayApiKey) {
    // Mock response for dev/demo (no Runway key configured)
    return {
      provider: 'mock',
      job_id: `mock_${Date.now()}`,
      status: 'completed',
      video_url: null,
      thumbnail_url: product_image_url || null,
      cost_usd: 0,
      latency_ms: 0,
      mock: true,
    };
  }

  // Real Runway Gen-3 Alpha call
  const startMs = Date.now();
  const body = {
    model: 'gen3a_turbo',
    promptImage: product_image_url,
    promptText: prompt,
    duration: duration_secs,
    ratio: '1280:768',
    watermark: false,
  };

  const resp = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${runwayApiKey}`,
      'X-Runway-Version': '2024-11-06',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Runway error: ${err}`);
  }

  const data = await resp.json();
  return {
    provider: 'runway',
    job_id: data.id,
    status: 'generating', // async — needs polling
    video_url: null,
    thumbnail_url: product_image_url || null,
    cost_usd: 0.05, // estimate per video
    latency_ms: Date.now() - startMs,
  };
}

// LumaAdapter: fallback
async function lumaAdapter({ prompt, product_image_url }) {
  const lumaKey = Deno.env.get('LUMA_API_KEY');
  if (!lumaKey) {
    return { provider: 'mock', job_id: `luma_mock_${Date.now()}`, status: 'completed', video_url: null, thumbnail_url: product_image_url, cost_usd: 0, latency_ms: 0, mock: true };
  }
  // Real call would go here
  throw new Error('Luma adapter not fully implemented');
}

// Provider selection with fallback chain
async function generateWithProvider(params, preferredProvider = 'runway') {
  const adapters = {
    runway: runwayAdapter,
    luma: lumaAdapter,
  };

  const chain = [preferredProvider, ...Object.keys(adapters).filter(p => p !== preferredProvider)];

  for (const provider of chain) {
    if (!adapters[provider]) continue;
    try {
      const result = await adapters[provider](params);
      return result;
    } catch (err) {
      console.warn(`[Provider ${provider}] failed: ${err.message}. Trying next...`);
    }
  }

  // Final fallback: mock
  return {
    provider: 'mock',
    job_id: `fallback_mock_${Date.now()}`,
    status: 'completed',
    video_url: null,
    thumbnail_url: params.product_image_url || null,
    cost_usd: 0,
    latency_ms: 0,
    mock: true,
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      company_id,
      product_id,
      format = '9:16',          // '9:16' | '1:1' | '16:9'
      template_style,            // 'minimal' | 'bold' | 'elegant' | undefined (all 3)
      offer_cta = 'Shop Now',
      offer_line = null,
      provider = 'runway',
      campaign_id = null,
    } = await req.json();

    if (!company_id || !product_id) {
      return Response.json({ error: 'company_id and product_id required' }, { status: 400 });
    }

    // Fetch company + product
    const [companies, products] = await Promise.all([
      base44.asServiceRole.entities.Company.filter({ id: company_id }),
      base44.asServiceRole.entities.Product.filter({ id: product_id }),
    ]);
    const company = companies[0];
    const product = products[0];
    if (!company || !product) return Response.json({ error: 'Company or product not found' }, { status: 404 });

    const productImage = product.product_image_url || product.image_url || null;
    const brandPrimary = company.brand_color_primary || company.primary_color || '#10b981';
    const brandSecondary = company.brand_color_secondary || '#1f2128';
    const companyLogo = company.logo_url || null;
    const vertical = company.vertical || 'other';
    const brandTone = company.brand_voice_tone || 'professional';

    const stylesToGenerate = template_style
      ? [TEMPLATES_SPECS_KEY(template_style)].filter(Boolean)
      : Object.values(TEMPLATE_SPECS);

    // ── Step 1: AI generates overlay text for each style ──
    const formatLabel = { '9:16': 'Vertical Story 9:16', '1:1': 'Square Post 1:1', '16:9': 'Landscape 16:9' }[format] || format;

    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert ad creative director for ${vertical} retail brands. 
Produce short overlay text for branded video ads.
Brand tone: ${brandTone}. 
Rules: headline ≤38 chars, offer_line ≤30 chars, cta ≤18 chars.
Output ONLY valid JSON.`
        },
        {
          role: 'user',
          content: `Brand: ${company.name}
Product: ${product.name} — ${product.description || ''}
CTA hint: ${offer_cta}
Offer line hint: ${offer_line || 'none'}
Format: ${formatLabel}

Generate overlay text for minimal, bold, and elegant styles.
For each return: headline, offer_line (optional), cta, bg_color (hex, from brand palette ${brandPrimary}), text_color (hex, high contrast).
JSON: { "minimal": {...}, "bold": {...}, "elegant": {...} }`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.75,
    });

    let overlayTexts = {};
    try {
      overlayTexts = JSON.parse(aiRes.choices[0].message.content);
    } catch {
      const fallback = { headline: product.name, offer_line: offer_line, cta: offer_cta, bg_color: brandPrimary, text_color: '#ffffff' };
      overlayTexts = { minimal: fallback, bold: fallback, elegant: fallback };
    }

    // ── Step 2: Generate video for each style via provider ──
    const creativeResults = await Promise.all(
      stylesToGenerate.map(async (template) => {
        const overlay = overlayTexts[template.style] || {};
        const spec = TEMPLATE_SPECS[template.style];

        const videoPrompt = `Branded product advertisement video for ${company.name}.
Product: ${product.name}.
Style: ${template.description}.
Show the product prominently with ${template.layout.animation} animation.
Text overlay: "${overlay.headline || product.name}". CTA: "${overlay.cta || offer_cta}".
Brand colors: primary ${brandPrimary}, secondary ${brandSecondary}.
Clean, professional retail ad. No text in video (overlay added post-render).
High quality, ${formatLabel} format.`;

        const providerResult = await generateWithProvider({
          prompt: videoPrompt,
          product_image_url: productImage,
          duration_secs: 6,
        }, provider);

        const overlaySpec = {
          headline: overlay.headline || product.name,
          offer_line: overlay.offer_line || offer_line || null,
          cta: overlay.cta || offer_cta,
          bg_color: overlay.bg_color || brandPrimary,
          text_color: overlay.text_color || '#ffffff',
          position: spec.layout.overlay.position,
          brand_colors: { primary: brandPrimary, secondary: brandSecondary },
          logo_url: companyLogo,
        };

        // Save VideoCreative record
        const record = await base44.asServiceRole.entities.VideoCreative.create({
          company_id,
          product_id,
          campaign_id: campaign_id || undefined,
          template_style: template.style,
          format,
          status: providerResult.mock ? 'review' : 'generating',
          provider: providerResult.provider,
          provider_job_id: providerResult.job_id,
          video_url: providerResult.video_url || null,
          thumbnail_url: providerResult.thumbnail_url || productImage,
          product_image_url: productImage,
          overlay_spec: JSON.stringify(overlaySpec),
          cost_usd: providerResult.cost_usd || 0,
          latency_ms: providerResult.latency_ms || 0,
        });

        return {
          ...record,
          template_name: template.name,
          template_description: template.description,
          layout_spec: spec.layout,
          overlay: overlaySpec,
          provider_result: providerResult,
          is_mock: providerResult.mock || false,
        };
      })
    );

    return Response.json({
      success: true,
      creatives: creativeResults,
      provider_used: creativeResults[0]?.provider_result?.provider || provider,
      mock_mode: creativeResults[0]?.is_mock || false,
    });

  } catch (error) {
    console.error('[generateBrandedVideoCreatives]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper to handle template_style key lookup
function TEMPLATES_SPECS_KEY(style) {
  return TEMPLATE_SPECS[style] || null;
}