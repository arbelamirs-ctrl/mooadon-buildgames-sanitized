import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const PROVIDERS = {
  dalle: { name: 'DALL-E 3', envKey: 'OPENAI_API_KEY', costPerImage: 0.04 },
  dreamina: { name: 'Dreamina (CapCut)', envKey: 'DREAMINA_API_KEY', costPerImage: 0.02 },
  stability: { name: 'Stability AI', envKey: 'STABILITY_API_KEY', costPerImage: 0.03 },
  leonardo: { name: 'Leonardo AI', envKey: 'LEONARDO_API_KEY', costPerImage: 0.02 },
};

const ASPECT_TO_SIZE = {
  '1:1': { dalle: '1024x1024', stability: '1024x1024' },
  '9:16': { dalle: '1024x1792', stability: '896x1152' },
  '16:9': { dalle: '1792x1024', stability: '1152x896' },
  '4:3': { dalle: '1024x1024', stability: '1024x1024' },
  '3:4': { dalle: '1024x1792', stability: '896x1152' },
};

const STYLE_PRESETS = {
  product_hero: { prefix: 'Professional product photography,', suffix: 'studio lighting, clean background, high-end commercial style, 8k quality' },
  lifestyle: { prefix: 'Lifestyle photography,', suffix: 'natural lighting, authentic moment, warm tones, professional quality' },
  minimal: { prefix: 'Minimalist design,', suffix: 'clean white background, soft shadows, modern aesthetic, premium feel' },
  vibrant: { prefix: 'Vibrant colorful image,', suffix: 'bold colors, energetic mood, eye-catching, social media optimized' },
  elegant: { prefix: 'Elegant luxury photography,', suffix: 'sophisticated lighting, premium textures, high-end brand aesthetic' },
  seasonal: { prefix: 'Seasonal themed photography,', suffix: 'festive elements, warm atmosphere, holiday mood, celebration vibes' },
};

async function dalleAdapter({ prompt, size = '1024x1024', style = 'vivid', quality = 'hd' }) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return mockResponse('dalle', prompt);
  const startMs = Date.now();
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size, style, quality, response_format: 'url' }),
  });
  if (!response.ok) throw new Error(`DALL-E API error: ${await response.text()}`);
  const data = await response.json();
  return {
    provider: 'dalle', status: 'completed',
    image_url: data.data[0]?.url,
    revised_prompt: data.data[0]?.revised_prompt,
    cost_usd: quality === 'hd' ? 0.08 : 0.04,
    latency_ms: Date.now() - startMs, mock: false,
  };
}

async function dreaminaAdapter({ prompt, aspect_ratio = '1:1' }) {
  const apiKey = Deno.env.get('DREAMINA_API_KEY');
  if (!apiKey) return mockResponse('dreamina', prompt);
  const startMs = Date.now();
  const response = await fetch('https://api.capcut.com/v1/dreamina/generate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspect_ratio, num_images: 1 }),
  });
  if (!response.ok) throw new Error(`Dreamina API error: ${await response.text()}`);
  const data = await response.json();
  return {
    provider: 'dreamina', status: 'completed',
    image_url: data.images?.[0]?.url || data.result?.url,
    job_id: data.job_id || data.id,
    cost_usd: 0.02, latency_ms: Date.now() - startMs, mock: false,
  };
}

async function stabilityAdapter({ prompt, size = '1024x1024', style_preset = 'photographic' }) {
  const apiKey = Deno.env.get('STABILITY_API_KEY');
  if (!apiKey) return mockResponse('stability', prompt);
  const startMs = Date.now();
  const [width, height] = size.split('x').map(Number);
  const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ text_prompts: [{ text: prompt, weight: 1 }], cfg_scale: 7, width, height, samples: 1, steps: 30, style_preset }),
  });
  if (!response.ok) throw new Error(`Stability API error: ${await response.text()}`);
  const data = await response.json();
  const base64Image = data.artifacts?.[0]?.base64;
  return {
    provider: 'stability', status: 'completed',
    image_url: base64Image ? `data:image/png;base64,${base64Image}` : null,
    image_base64: base64Image,
    cost_usd: 0.03, latency_ms: Date.now() - startMs, mock: false,
  };
}

async function leonardoAdapter({ prompt, aspect_ratio = '1:1' }) {
  const apiKey = Deno.env.get('LEONARDO_API_KEY');
  if (!apiKey) return mockResponse('leonardo', prompt);
  const startMs = Date.now();
  const dimensions = { '1:1': { width: 1024, height: 1024 }, '9:16': { width: 768, height: 1344 }, '16:9': { width: 1344, height: 768 } };
  const { width, height } = dimensions[aspect_ratio] || dimensions['1:1'];
  const createResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, modelId: 'b24e16ff-06e3-43eb-8d33-4416c2d75876', width, height, num_images: 1, guidance_scale: 7, presetStyle: 'DYNAMIC' }),
  });
  if (!createResponse.ok) throw new Error(`Leonardo API error: ${await createResponse.text()}`);
  const createData = await createResponse.json();
  const generationId = createData.sdGenerationJob?.generationId;
  if (!generationId) throw new Error('No generation ID returned');
  let imageUrl = null;
  for (let i = 0; i < 12; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const statusResponse = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const statusData = await statusResponse.json();
    const images = statusData.generations_by_pk?.generated_images;
    if (images && images.length > 0) { imageUrl = images[0].url; break; }
  }
  return {
    provider: 'leonardo', status: imageUrl ? 'completed' : 'timeout',
    image_url: imageUrl, generation_id: generationId,
    cost_usd: 0.02, latency_ms: Date.now() - startMs, mock: false,
  };
}

function mockResponse(provider, prompt) {
  return {
    provider, status: 'mock', image_url: null, prompt_used: prompt,
    cost_usd: 0, latency_ms: 0, mock: true,
    message: `${PROVIDERS[provider]?.name || provider} API key not configured. Add ${PROVIDERS[provider]?.envKey || 'API_KEY'} to Secrets.`,
  };
}

async function generateWithProvider(params, preferredProvider = 'dalle') {
  const adapters = { dalle: dalleAdapter, dreamina: dreaminaAdapter, stability: stabilityAdapter, leonardo: leonardoAdapter };
  const chain = [preferredProvider, ...Object.keys(adapters).filter(p => p !== preferredProvider)];
  for (const provider of chain) {
    if (!adapters[provider]) continue;
    try {
      const result = await adapters[provider](params);
      if (!result.mock) return result;
    } catch (err) {
      console.warn(`[${provider}] Failed: ${err.message}. Trying next...`);
    }
  }
  return {
    provider: 'none', status: 'no_provider', image_url: null, cost_usd: 0, latency_ms: 0, mock: true,
    message: 'No AI image provider configured. Add one of: OPENAI_API_KEY, DREAMINA_API_KEY, STABILITY_API_KEY, LEONARDO_API_KEY',
    available_providers: Object.entries(PROVIDERS).map(([key, val]) => ({ id: key, name: val.name, secret_name: val.envKey, cost_per_image: `$${val.costPerImage}` })),
  };
}

function buildImagePrompt({ product, company, campaign, style = 'product_hero', customPrompt = null }) {
  if (customPrompt) return customPrompt;
  const preset = STYLE_PRESETS[style] || STYLE_PRESETS.product_hero;
  const vertical = company?.vertical || 'retail';
  const productName = product?.name || 'product';
  const brandName = company?.name || 'brand';
  const offerText = campaign?.cta || '';
  const verticalContext = {
    cafe: 'artisan coffee shop setting, warm wooden surfaces, steam rising',
    restaurant: 'elegant dining environment, beautifully plated food, ambient lighting',
    fashion: 'fashion editorial style, clean backdrop, model lifestyle shot',
    jewelry: 'luxury jewelry photography, velvet surface, sparkling gems, soft bokeh',
    retail: 'professional retail photography, clean presentation, commercial quality',
  };
  const context = verticalContext[vertical] || verticalContext.retail;
  return `${preset.prefix} ${productName} for ${brandName}, ${context}. ${offerText ? `Marketing message: "${offerText}".` : ''} ${preset.suffix}. Do not include any text or words in the image.`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      company_id, product_id, campaign_id = null,
      aspect_ratio = '1:1', style = 'product_hero', custom_prompt = null,
      provider = 'dalle', quality = 'hd', num_images = 1,
    } = await req.json();

    if (!company_id) return Response.json({ error: 'company_id required' }, { status: 400 });

    const [companies, products, campaigns] = await Promise.all([
      base44.asServiceRole.entities.Company.filter({ id: company_id }),
      product_id ? base44.asServiceRole.entities.Product.filter({ id: product_id }) : Promise.resolve([]),
      campaign_id ? base44.asServiceRole.entities.CouponCampaign.filter({ id: campaign_id }) : Promise.resolve([]),
    ]);

    const company = companies[0];
    const product = products[0] || null;
    const campaign = campaigns[0] || null;
    if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });

    // ── AI BUDGET CHECK ────────────────────────────────────────────────────────
    const estimatedCostUsd = 0.04; // DALL-E 3
    try {
     const budgetRes = await base44.functions.invoke('checkAIBudget', { 
       company_id, 
       estimated_cost_usd: estimatedCostUsd 
     });
     if (!budgetRes.data.allowed) {
       return Response.json({
         error: 'AI budget exceeded for this month. Please upgrade your plan or wait until next month.',
         budget_exceeded: true,
         current_spend: budgetRes.data.current_spend,
         budget: budgetRes.data.budget,
         remaining: budgetRes.data.remaining,
         reset_date: budgetRes.data.reset_date
       }, { status: 402 });
     }
    } catch (budgetErr) {
     console.warn('[generateAIImage] Budget check failed (non-blocking):', budgetErr.message);
    }

    const prompt = buildImagePrompt({ product, company, campaign, style, customPrompt: custom_prompt });
    const sizeMap = ASPECT_TO_SIZE[aspect_ratio] || ASPECT_TO_SIZE['1:1'];

    const results = [];
    for (let i = 0; i < Math.min(num_images, 4); i++) {
      const result = await generateWithProvider({
        prompt, size: sizeMap.dalle || '1024x1024', aspect_ratio, quality, style_preset: style,
      }, provider);
      results.push(result);
    }

    const totalCost = results.reduce((sum, r) => sum + (r.cost_usd || 0), 0);
    const allMock = results.every(r => r.mock);

    // Record usage to budget
    if (!allMock) {
      base44.functions.invoke('recordAIUsage', {
        company_id,
        feature: 'image_creative',
        cost_usd: totalCost,
        usage_id: `image_${campaign_id || 'direct'}_${Date.now()}`,
        context: { campaign_id, product_id, style, num_images, provider }
      }).catch(err => console.warn('[generateAIImage] Usage record failed:', err.message));
    }

    return Response.json({
      success: true,
      images: results,
      prompt_used: prompt,
      total_cost_usd: totalCost,
      provider_used: results[0]?.provider || 'none',
      mock: allMock,
      ...(allMock && {
        setup_instructions: {
          message: 'No AI provider configured. Add API keys to generate real images.',
          steps: [
            '1. Go to Base44 → Settings → Secrets',
            '2. Add: OPENAI_API_KEY (DALL-E 3 - Recommended)',
            '3. Or: STABILITY_API_KEY / LEONARDO_API_KEY / DREAMINA_API_KEY',
            '4. Refresh and try again',
          ],
        },
      }),
    });
  } catch (error) {
    console.error('[generateAIImage]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});