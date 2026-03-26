import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const VIDEO_PROVIDERS = {
  runway: { name: 'Runway Gen-3 Alpha', envKey: 'RUNWAY_API_KEY', costPerSecond: 0.05, maxDuration: 10 },
  luma: { name: 'Luma Dream Machine', envKey: 'LUMA_API_KEY', costPerSecond: 0.04, maxDuration: 5 },
  pika: { name: 'Pika Labs', envKey: 'PIKA_API_KEY', costPerSecond: 0.03, maxDuration: 4 },
  kling: { name: 'Kling AI', envKey: 'KLING_API_KEY', costPerSecond: 0.02, maxDuration: 5 },
};

const VIDEO_STYLES = {
  product_showcase: { motion: 'slow orbit around product, gentle zoom', lighting: 'studio lighting with soft shadows', mood: 'premium, professional', camera: 'smooth dolly shot' },
  lifestyle: { motion: 'handheld natural movement, lifestyle context', lighting: 'natural daylight, warm tones', mood: 'authentic, relatable', camera: 'follow shot' },
  dynamic: { motion: 'fast cuts, energetic transitions', lighting: 'high contrast, dramatic', mood: 'exciting, urgent', camera: 'quick zooms and pans' },
  elegant: { motion: 'slow smooth movements, luxurious pace', lighting: 'soft diffused light, golden hour', mood: 'sophisticated, premium', camera: 'crane shot, smooth glide' },
  social_story: { motion: 'vertical format, quick engaging cuts', lighting: 'bright, social media optimized', mood: 'fun, attention-grabbing', camera: 'POV and selfie angles' },
};

function mockVideoResponse(provider, prompt) {
  const p = VIDEO_PROVIDERS[provider];
  return { provider, status: 'mock', video_url: null, prompt_used: prompt, cost_usd: 0, latency_ms: 0, mock: true, message: `${p?.name || provider} API key not configured. Add ${p?.envKey || 'API_KEY'} to Secrets.` };
}

async function runwayAdapter({ prompt, image_url, duration = 5, aspect_ratio = '16:9' }) {
  const apiKey = Deno.env.get('RUNWAY_API_KEY');
  if (!apiKey) return mockVideoResponse('runway', prompt);
  const startMs = Date.now();
  const endpoint = image_url ? 'https://api.runwayml.com/v1/image_to_video' : 'https://api.runwayml.com/v1/text_to_video';
  const body = { model: 'gen3a_turbo', promptText: prompt, duration, ratio: aspect_ratio.replace(':', '_'), ...(image_url && { promptImage: image_url }) };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Runway-Version': '2024-09-13' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Runway API error: ${await response.text()}`);
  const data = await response.json();
  const taskId = data.id;
  let videoUrl = null;
  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const statusRes = await fetch(`https://api.runwayml.com/v1/tasks/${taskId}`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    const statusData = await statusRes.json();
    if (statusData.status === 'SUCCEEDED') { videoUrl = statusData.output?.[0]; break; }
    else if (statusData.status === 'FAILED') throw new Error(statusData.failure || 'Video generation failed');
  }
  return { provider: 'runway', status: videoUrl ? 'completed' : 'timeout', video_url: videoUrl, task_id: taskId, duration_seconds: duration, cost_usd: duration * 0.05, latency_ms: Date.now() - startMs, mock: false };
}

async function lumaAdapter({ prompt, image_url, aspect_ratio = '16:9' }) {
  const apiKey = Deno.env.get('LUMA_API_KEY');
  if (!apiKey) return mockVideoResponse('luma', prompt);
  const startMs = Date.now();
  const response = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspect_ratio, ...(image_url && { keyframes: { frame0: { type: 'image', url: image_url } } }) }),
  });
  if (!response.ok) throw new Error(`Luma API error: ${await response.text()}`);
  const data = await response.json();
  const generationId = data.id;
  let videoUrl = null;
  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const statusData = await (await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${generationId}`, { headers: { 'Authorization': `Bearer ${apiKey}` } })).json();
    if (statusData.state === 'completed') { videoUrl = statusData.assets?.video; break; }
    else if (statusData.state === 'failed') throw new Error(statusData.failure_reason || 'Video generation failed');
  }
  return { provider: 'luma', status: videoUrl ? 'completed' : 'timeout', video_url: videoUrl, generation_id: generationId, duration_seconds: 5, cost_usd: 0.20, latency_ms: Date.now() - startMs, mock: false };
}

async function pikaAdapter({ prompt, image_url, aspect_ratio = '16:9' }) {
  const apiKey = Deno.env.get('PIKA_API_KEY');
  if (!apiKey) return mockVideoResponse('pika', prompt);
  const startMs = Date.now();
  const response = await fetch('https://api.pika.art/v1/generate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspect_ratio, ...(image_url && { image: image_url }) }),
  });
  if (!response.ok) throw new Error(`Pika API error: ${await response.text()}`);
  const data = await response.json();
  return { provider: 'pika', status: 'completed', video_url: data.video_url, generation_id: data.id, duration_seconds: 4, cost_usd: 0.12, latency_ms: Date.now() - startMs, mock: false };
}

async function klingAdapter({ prompt, image_url, duration = 5, aspect_ratio = '16:9' }) {
  const apiKey = Deno.env.get('KLING_API_KEY');
  if (!apiKey) return mockVideoResponse('kling', prompt);
  const startMs = Date.now();
  const response = await fetch('https://api.klingai.com/v1/videos/generate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, duration, aspect_ratio, ...(image_url && { reference_image: image_url }) }),
  });
  if (!response.ok) throw new Error(`Kling API error: ${await response.text()}`);
  const data = await response.json();
  const taskId = data.task_id;
  let videoUrl = null;
  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const statusData = await (await fetch(`https://api.klingai.com/v1/videos/${taskId}`, { headers: { 'Authorization': `Bearer ${apiKey}` } })).json();
    if (statusData.status === 'completed') { videoUrl = statusData.video_url; break; }
    else if (statusData.status === 'failed') throw new Error(statusData.error || 'Video generation failed');
  }
  return { provider: 'kling', status: videoUrl ? 'completed' : 'timeout', video_url: videoUrl, task_id: taskId, duration_seconds: duration, cost_usd: duration * 0.02, latency_ms: Date.now() - startMs, mock: false };
}

async function generateVideoWithProvider(params, preferredProvider = 'runway') {
  const adapters = { runway: runwayAdapter, luma: lumaAdapter, pika: pikaAdapter, kling: klingAdapter };
  const chain = [preferredProvider, ...Object.keys(adapters).filter(p => p !== preferredProvider)];
  for (const provider of chain) {
    if (!adapters[provider]) continue;
    try {
      const result = await adapters[provider](params);
      if (!result.mock && result.video_url) return result;
    } catch (err) {
      console.warn(`[${provider}] Failed: ${err.message}. Trying next...`);
    }
  }
  return {
    provider: 'none', status: 'no_provider', video_url: null, cost_usd: 0, latency_ms: 0, mock: true,
    message: 'No AI video provider configured. Add RUNWAY_API_KEY, LUMA_API_KEY, PIKA_API_KEY, or KLING_API_KEY to Secrets.',
    available_providers: Object.entries(VIDEO_PROVIDERS).map(([key, val]) => ({ id: key, name: val.name, secret_name: val.envKey, cost_per_second: `$${val.costPerSecond}`, max_duration: `${val.maxDuration}s` })),
  };
}

function buildVideoPrompt({ product, company, campaign, style = 'product_showcase', customPrompt = null }) {
  if (customPrompt) return customPrompt;
  const preset = VIDEO_STYLES[style] || VIDEO_STYLES.product_showcase;
  const productName = product?.name || 'product';
  const brandName = company?.name || 'brand';
  const vertical = company?.vertical || 'retail';
  const offerText = campaign?.cta || '';
  return `${productName} by ${brandName} - ${preset.motion}. ${preset.lighting}, ${preset.mood} mood. Camera: ${preset.camera}. ${offerText ? `Promotional video for: "${offerText}".` : ''} Professional marketing video, ${vertical} industry, high production quality. No text overlays.`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      company_id, product_id = null, campaign_id = null,
      aspect_ratio = '16:9', duration = 5, style = 'product_showcase',
      custom_prompt = null, source_image_url = null, provider = 'runway',
    } = await req.json();

    if (!company_id) return Response.json({ error: 'company_id required' }, { status: 400 });

    const [companies, products, campaigns] = await Promise.all([
      base44.asServiceRole.entities.Company.filter({ id: company_id }),
      product_id ? base44.asServiceRole.entities.Product.filter({ id: product_id }) : Promise.resolve([]),
      campaign_id ? base44.asServiceRole.entities.CouponCampaign.filter({ id: campaign_id }) : Promise.resolve([]),
    ]);

    const company = companies[0];
    if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });

    const product = products[0] || null;
    const campaign = campaigns[0] || null;
    const prompt = buildVideoPrompt({ product, company, campaign, style, customPrompt: custom_prompt });

    const result = await generateVideoWithProvider({ prompt, image_url: source_image_url, duration, aspect_ratio }, provider);

    return Response.json({
      success: true,
      video: result,
      prompt_used: prompt,
      provider_used: result.provider,
      mock: result.mock,
      ...(result.mock && {
        setup_instructions: {
          message: 'No AI video provider configured. Add API keys to generate real videos.',
          steps: [
            '1. Go to Base44 → Settings → Secrets',
            '2. Add: RUNWAY_API_KEY (Recommended), LUMA_API_KEY, PIKA_API_KEY, or KLING_API_KEY',
            '3. Refresh and try again',
          ],
        },
      }),
    });
  } catch (error) {
    console.error('[generateAIVideo]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});