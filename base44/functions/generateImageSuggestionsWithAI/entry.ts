import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const PROMPT_VERSION = 'img-v1';
const MODEL = 'gpt-4o-mini';

async function callOpenAI(apiKey, messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, response_format: { type: 'json_object' } })
  });
  if (!res.ok) throw new Error('OpenAI error: ' + await res.text());
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

const VERTICAL_VISUAL_CONTEXT = {
  cafe:       'artisan coffee shop: steam, latte art, warm morning light, rustic wood surfaces, cozy interior',
  fashion:    'fashion brand: editorial lighting, lifestyle flatlay, model in motion, clean minimal studio',
  restaurant: 'restaurant: close-up plated food, steam, chef hands, ambient dining room with candles',
  jewelry:    'jewelry brand: macro on gem/metal, velvet backdrop, gifting moment, luxury bokeh',
  other:      'retail/service: clean product shot, lifestyle context, friendly face, bright natural light'
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { campaign_id, variant = 'a' } = await req.json();
    if (!campaign_id) return Response.json({ error: 'campaign_id required' }, { status: 400 });

    const [campaigns] = await Promise.all([
      base44.asServiceRole.entities.CouponCampaign.filter({ id: campaign_id })
    ]);
    if (!campaigns.length) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    const campaign = campaigns[0];

    const [companies, products, brandVoices] = await Promise.all([
      base44.asServiceRole.entities.Company.filter({ id: campaign.company_id }),
      base44.asServiceRole.entities.Product.filter({ id: campaign.product_id }),
      base44.asServiceRole.entities.BrandVoice.filter({ company_id: campaign.company_id })
    ]);

    const company = companies[0] || {};
    const product = products[0] || {};
    const brandVoice = brandVoices[0] || null;
    const vertical = company.vertical || 'other';
    const tone = company.brand_voice_tone || brandVoice?.tone || 'professional';
    const vertCtx = VERTICAL_VISUAL_CONTEXT[vertical] || VERTICAL_VISUAL_CONTEXT.other;
    const variantLabel = variant === 'a' ? 'benefit-led (value, desire, emotion)' : 'urgency-led (FOMO, countdown, exclusivity)';
    const copySnippet = variant === 'a'
      ? (campaign.ig_copy_a || campaign.x_copy_a || '')
      : (campaign.ig_copy_b || campaign.x_copy_b || '');

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    const systemPrompt = `You are a professional social media creative director specializing in ${vertical} brands.
Your job: given a product and brand voice, suggest concrete, actionable photo/video shot ideas for social media campaigns.
Focus on production-ready details: composition, lighting, props, wardrobe, setting, mood. No generic advice.`;

    const userPrompt = `Campaign for: "${product.name || 'product'}" | Brand: ${company.name || 'brand'} | Vertical: ${vertCtx}
Tone: ${tone} | Variant: ${variantLabel}
Copy excerpt: "${copySnippet.slice(0, 200)}"

Return a JSON object with EXACTLY this structure:
{
  "shots": [
    {
      "title": "short title",
      "scene": "one paragraph describing the exact scene",
      "composition": "camera angle, framing, rule of thirds etc",
      "lighting": "natural/studio/golden hour, direction, modifiers",
      "props": ["prop1", "prop2"],
      "mood": "the feeling this evokes",
      "best_platform": "ig|fb|x|linkedin|story"
    }
  ],
  "overlay_texts": ["text option 1", "text option 2", "text option 3"],
  "style_notes": "overall visual direction paragraph — colors, textures, filter style, font vibe",
  "do_not_list": ["visual element to avoid", "...up to 5"],
  "platform_notes": {
    "ig": "aspect ratio + composition tip",
    "stories": "vertical format tip",
    "fb": "tip for fb",
    "linkedin": "professional visual tip"
  }
}
shots array MUST have exactly 5 items. overlay_texts MUST have exactly 3 items. do_not_list: 3-5 items.`;

    const result = await callOpenAI(openaiKey, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    // Validate basics
    if (!Array.isArray(result.shots) || result.shots.length < 3) {
      return Response.json({ error: 'AI returned incomplete shot list' }, { status: 500 });
    }

    // Store in DB
    const suggestion = await base44.asServiceRole.entities.CampaignCreativeSuggestion.create({
      campaign_id,
      company_id: campaign.company_id,
      product_id: campaign.product_id,
      vertical,
      language: campaign.ai_language || 'en',
      shots: result.shots,
      overlay_texts: result.overlay_texts || [],
      style_notes: result.style_notes || '',
      do_not_list: result.do_not_list || [],
      platform_notes: result.platform_notes || {},
      variant,
      prompt_version: PROMPT_VERSION
    });

    return Response.json({ success: true, suggestion });
  } catch (error) {
    console.error('[generateImageSuggestionsWithAI]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});