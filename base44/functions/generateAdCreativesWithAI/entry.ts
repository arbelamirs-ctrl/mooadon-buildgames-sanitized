import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import OpenAI from 'npm:openai';

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

// Template definitions: fixed layout placements for each style
const TEMPLATES = {
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, product-first. White space, one bold line.',
    overlay_position: 'bottom',
    max_headline_chars: 30,
    max_cta_chars: 15,
  },
  bold: {
    id: 'bold',
    name: 'Bold',
    description: 'High contrast, energetic. Big text, strong CTA.',
    overlay_position: 'center',
    max_headline_chars: 25,
    max_cta_chars: 12,
  },
  elegant: {
    id: 'elegant',
    name: 'Elegant',
    description: 'Premium feel. Soft palette, refined typography.',
    overlay_position: 'top',
    max_headline_chars: 35,
    max_cta_chars: 18,
  },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      company_id,
      product_id,
      campaign_copy, // { ig_copy_a, ig_copy_b, cta, hashtags }
      format = 'story', // 'story' | 'post'
      template_style, // 'minimal' | 'bold' | 'elegant' | undefined (generate all 3)
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

    const stylesToGenerate = template_style
      ? [TEMPLATES[template_style]].filter(Boolean)
      : Object.values(TEMPLATES);

    // AI: generate overlay text proposals for each style
    const formatLabel = format === 'story' ? 'Instagram Story (1080×1920)' : 'Instagram Post (1080×1080)';

    const systemPrompt = `You are an expert ad creative director for ${vertical} brands.
You produce overlay text for social media ad templates.
Rules:
- Max 1 headline (short, punchy — no fluff)
- Max 1 offer line (e.g. "Get 20% off")
- Max 1 CTA (action verb, ≤3 words)
- NO more than 3 text elements total
- Match brand tone: ${company.brand_voice_tone || 'professional'}
- Style note per template variant as requested
- Output ONLY valid JSON`;

    const userPrompt = `Brand: ${company.name}
Product: ${product.name} — ${product.description || ''}
Campaign copy reference: ${campaign_copy?.ig_copy_a || ''}
CTA hint: ${campaign_copy?.cta || 'Shop Now'}
Format: ${formatLabel}

Generate overlay text for these 3 template styles: minimal, bold, elegant.
For each style return:
- headline (≤30 chars for minimal/elegant, ≤25 for bold)
- offer_line (optional, ≤25 chars)
- cta (≤15 chars)
- bg_color_suggestion (hex, complementary to brand primary ${brandPrimary})
- text_color (hex, high contrast)

Respond with JSON: { "minimal": {...}, "bold": {...}, "elegant": {...} }`;

    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    let overlayTexts = {};
    try {
      overlayTexts = JSON.parse(aiRes.choices[0].message.content);
    } catch {
      overlayTexts = { minimal: { headline: product.name, cta: 'Shop Now' }, bold: { headline: product.name, cta: 'Get It Now' }, elegant: { headline: product.name, cta: 'Discover' } };
    }

    // Build creative specs for each style
    const creatives = stylesToGenerate.map((template) => {
      const overlay = overlayTexts[template.id] || {};
      const dimensions = format === 'story' ? { w: 1080, h: 1920 } : { w: 1080, h: 1080 };

      return {
        template_id: template.id,
        template_name: template.name,
        format,
        dimensions,
        product_image_url: productImage,
        company_logo_url: companyLogo,
        overlay: {
          headline: overlay.headline || product.name,
          offer_line: overlay.offer_line || null,
          cta: overlay.cta || 'Shop Now',
          position: template.overlay_position,
          bg_color: overlay.bg_color_suggestion || brandPrimary,
          text_color: overlay.text_color || '#ffffff',
        },
        brand_colors: {
          primary: brandPrimary,
          secondary: brandSecondary,
        },
        metadata: {
          template_id: template.id,
          colors_used: [brandPrimary, brandSecondary, overlay.bg_color_suggestion].filter(Boolean),
          text_used: [overlay.headline, overlay.offer_line, overlay.cta].filter(Boolean),
          product_id,
          company_id,
          format,
        },
      };
    });

    return Response.json({ success: true, creatives, product_image_url: productImage });
  } catch (error) {
    console.error('[generateAdCreativesWithAI]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});