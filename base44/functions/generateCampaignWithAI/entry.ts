import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const AI_DAILY_LIMIT = parseInt(Deno.env.get('AI_CAMPAIGNS_DAILY_LIMIT') || '10');
const QUALITY_GATE   = 80;
const MAX_REWRITE_RETRIES = 2;
const CREATOR_MODEL  = 'gpt-4o';
const JUDGE_MODEL    = 'gpt-4o-mini';
const PROMPT_VERSION = 'v5-hardened';

// In-memory cache per warm instance
const sessionCache = new Map();

// ─── REQUIRED SCHEMA FIELDS ───────────────────────────────────────────────────
const REQUIRED_PLATFORM_FIELDS = ['headline', 'primary_text', 'alt_versions', 'hashtags', 'cta', 'disclaimer'];
const REQUIRED_PLATFORMS = ['ig', 'fb', 'x', 'linkedin', 'global'];

// ─── SCHEMA VALIDATOR ─────────────────────────────────────────────────────────
const HASHTAG_RULES = { ig: [8, 10], fb: [3, 8], x: [1, 3], linkedin: [3, 5] };

function validateSchema(obj) {
  const errors = [];
  for (const platform of ['ig', 'fb', 'x', 'linkedin']) {
    if (!obj[platform] || typeof obj[platform] !== 'object') {
      errors.push(`Missing platform: ${platform}`);
      continue;
    }
    for (const field of REQUIRED_PLATFORM_FIELDS) {
      if (obj[platform][field] === undefined || obj[platform][field] === null) {
        errors.push(`${platform}.${field} missing`);
      }
    }
    // alt_versions: exactly 2 non-empty strings
    const avs = obj[platform].alt_versions;
    if (!Array.isArray(avs) || avs.length !== 2 || avs.some(s => !s || typeof s !== 'string')) {
      errors.push(`${platform}.alt_versions must be array of exactly 2 non-empty strings`);
    }
    // hashtags: array within allowed range
    const tags = obj[platform].hashtags;
    if (!Array.isArray(tags)) {
      errors.push(`${platform}.hashtags must be array`);
    } else {
      const [min, max] = HASHTAG_RULES[platform] || [1, 10];
      const count = tags.filter(Boolean).length;
      if (count < min || count > max) {
        errors.push(`${platform}.hashtags has ${count} items (expected ${min}–${max})`);
      }
    }
    // disclaimer: max 200 chars
    if (obj[platform].disclaimer && typeof obj[platform].disclaimer === 'string' && obj[platform].disclaimer.length > 200) {
      errors.push(`${platform}.disclaimer is too long (${obj[platform].disclaimer.length} chars, max 200)`);
    }
  }
  if (!obj.global || typeof obj.global !== 'object') errors.push('Missing global block');
  return errors;
}

// ─── FORBIDDEN WORDS HARD VALIDATOR ──────────────────────────────────────────
function checkForbiddenClaims(copy, forbiddenList) {
  if (!forbiddenList || forbiddenList.length === 0) return [];
  const allText = JSON.stringify(copy).toLowerCase();
  return forbiddenList.filter(w => w && allText.includes(w.toLowerCase()));
}

// ─── X PLATFORM QUALITY CHECKS ───────────────────────────────────────────────
function checkXQuality(xObj, emojiPolicy) {
  const issues = [];
  const text = xObj?.primary_text || '';

  // Char limit
  if (text.length > 280) issues.push(`x.primary_text is ${text.length} chars (limit 280)`);

  // Hashtag count
  const hashtagCount = (xObj?.hashtags || []).filter(Boolean).length;
  if (hashtagCount > 3) issues.push(`x.hashtags has ${hashtagCount} items (max 3)`);

  // ALL CAPS check
  const words = text.split(/\s+/);
  const allCapsWords = words.filter(w => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w));
  if (allCapsWords.length > 2) issues.push(`x.primary_text contains excessive ALL CAPS: ${allCapsWords.join(', ')}`);

  // Excessive punctuation
  if (/[!]{2,}|[?]{2,}/.test(text)) issues.push('x.primary_text has excessive punctuation (!! or ??)');

  // Emoji count
  const emojiCount = (text.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu) || []).length;
  const maxEmojis = emojiPolicy === 'none' ? 0 : emojiPolicy === 'light' ? 2 : 5;
  if (emojiCount > maxEmojis) issues.push(`x.primary_text has ${emojiCount} emojis (max ${maxEmojis} for policy "${emojiPolicy}")`);

  return issues;
}

// ─── X CHAR LIMIT HARD ENFORCER (word-boundary, CTA-preserving) ───────────────
function enforceXLimit(copy) {
  if (!copy?.x?.primary_text) return copy;
  const txt = copy.x.primary_text;
  if (txt.length <= 280) return copy;

  const cta = copy.x.cta || '';
  const LIMIT = 280;
  const ELLIPSIS = '…';

  // Try to preserve CTA: if CTA is at the end of the text, keep it
  let body = txt;
  let ctaSuffix = '';
  if (cta && txt.endsWith(cta)) {
    body = txt.slice(0, txt.length - cta.length).trim();
    ctaSuffix = ' ' + cta;
  }

  // Reserve space for ellipsis + optional CTA
  const reserve = ELLIPSIS.length + ctaSuffix.length;
  const availableChars = LIMIT - reserve;

  // Truncate body to last word boundary within availableChars
  let truncated = body.slice(0, availableChars);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > availableChars * 0.7) {
    truncated = truncated.slice(0, lastSpace);
  }
  truncated = truncated.trimEnd();

  const result = (truncated + ELLIPSIS + ctaSuffix).trim();
  // Safety: if still over limit, hard-slice
  const final = result.length <= LIMIT ? result : result.slice(0, LIMIT - 1) + ELLIPSIS;
  return { ...copy, x: { ...copy.x, primary_text: final } };
}

// ─── PLATFORM RULES ──────────────────────────────────────────────────────────
const PLATFORM_RULES = `
PLATFORM HARD RULES:
- x.primary_text: STRICT max 280 characters total. Count every character including spaces. If over 280, you FAIL.
- x.hashtags: max 3 items — no more
- x: avoid ALL CAPS words, avoid excessive punctuation (!!!), avoid more than 2 emojis total
- ig.hashtags: exactly 10 items
- fb.hashtags: 3-8 items
- linkedin.primary_text: professional tone, max 1 emoji, 3-5 hashtags
- linkedin.hashtags: 3-5 items
- All alt_versions arrays must have exactly 2 non-empty strings
`;

// ─── BASE COMPLIANCE ─────────────────────────────────────────────────────────
const BASE_COMPLIANCE = `
COMPLIANCE RULES (NEVER VIOLATE):
- No unverifiable superlatives: "best in town", "#1", "cheapest", "guaranteed", "world's best"
- No medical, health, or therapeutic promises
- No misleading urgency ("only 1 left" unless true)
- No competitor mentions or bashing
- All discount values must match the actual offer exactly
- No discriminatory language
`;

// ─── OUTPUT SCHEMA ────────────────────────────────────────────────────────────
const OUTPUT_SCHEMA = `
Return ONLY a valid JSON object with this EXACT structure (no extra keys, no missing keys):
{
  "ig":       { "headline": "string", "primary_text": "string", "alt_versions": ["string","string"], "hashtags": ["","","","","","","","","",""], "cta": "string", "disclaimer": "string" },
  "fb":       { "headline": "string", "primary_text": "string", "alt_versions": ["string","string"], "hashtags": ["","","","",""], "cta": "string", "disclaimer": "string" },
  "x":        { "headline": "string", "primary_text": "string MAX 280 CHARS", "alt_versions": ["string","string"], "hashtags": ["","",""], "cta": "string", "disclaimer": "string" },
  "linkedin": { "headline": "string", "primary_text": "string", "alt_versions": ["string","string"], "hashtags": ["","","",""], "cta": "string", "disclaimer": "string" },
  "global":   { "positioning": "string", "offer_summary": "string", "constraints_followed": ["string"] }
}
CRITICAL BEFORE SUBMITTING: Count x.primary_text characters. It MUST be ≤280. If it is longer, shorten it.
`;

// ─── JUDGE SCHEMA ─────────────────────────────────────────────────────────────
const JUDGE_SCHEMA = `
Return ONLY valid JSON:
{
  "score_overall": number 0-100,
  "scores": { "clarity": number, "brand_fit": number, "platform_fit": number, "originality": number },
  "issues": ["string"],
  "rewrite_required": boolean,
  "rewrite_instructions": ["string"]
}
`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function genCode(prefix) {
  return `${prefix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

function cacheKey(companyId, productId, discountValue, expiryDate, price, vertical, variantType, language, brandVoiceVersion) {
  return `${PROMPT_VERSION}_${companyId}_${productId}_${discountValue}_${price}_${expiryDate}_${vertical}_${variantType}_${language}_${brandVoiceVersion}`;
}

function getVerticalContext(vertical) {
  return {
    cafe:       'Artisan cafe/coffee shop. Evoke warmth, sensory pleasure, morning ritual.',
    fashion:    'Fashion & lifestyle brand. Style identity, exclusivity, trend relevance.',
    restaurant: 'Restaurant. Vivid flavors, chef story, occasion dining.',
    jewelry:    'Jewelry/luxury accessories. Craftsmanship, gifting moments, prestige.',
    other:      'Retail/service brand. Emphasize value, convenience, trust.'
  }[vertical] || 'Retail/service brand. Emphasize value, convenience, trust.';
}

// ─── OPENAI CALL ─────────────────────────────────────────────────────────────
async function callOpenAI(apiKey, model, messages) {
  const t = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, response_format: { type: 'json_object' } })
  });
  if (!res.ok) throw new Error(`OpenAI [${model}] error: ` + await res.text());
  const data = await res.json();
  const usage = data.usage || {};
  return {
    content: JSON.parse(data.choices[0].message.content),
    tokens_total: usage.total_tokens || 0,
    latency_ms: Date.now() - t,
    model
  };
}

// ─── BUILD SYSTEM PROMPT ─────────────────────────────────────────────────────
function buildSystemPrompt(ctx) {
  const { company, product, tokenSymbol, discountValue, expiryDate, brandVoice, language } = ctx;
  const vertCtx = getVerticalContext(company.vertical || 'other');
  const tone = company.brand_voice_tone || brandVoice?.tone || 'professional';
  const style = company.brand_voice_style || (brandVoice?.copy_length === 'short' ? 'short punchy' : 'clear and engaging');
  const emojiPolicy = company.emoji_policy || (brandVoice?.use_emojis === false ? 'none' : 'light');
  const forbiddenClaims = [
    ...(company.forbidden_claims || []),
    ...(brandVoice?.forbidden_words ? brandVoice.forbidden_words.split(',').map(s => s.trim()) : [])
  ];
  const keywordsToUse = [
    ...(company.keywords_to_use || []),
    ...(brandVoice?.brand_keywords ? brandVoice.brand_keywords.split(',').map(s => s.trim()) : [])
  ];
  const keywordsToAvoid = company.keywords_to_avoid || [];
  const customCompliance = brandVoice?.compliance_rules || '';
  const styleRef = brandVoice?.sample_approved_copy ? `Style reference (approved brand copy): "${brandVoice.sample_approved_copy}"` : '';
  const regionNote = company.target_region ? `Target region: ${company.target_region}.` : '';
  const langNote = language !== 'en' ? `Write ALL copy in language code: ${language}. Do not mix languages.` : 'Write all copy in English.';

  return `You are an expert social media copywriter.
Business: ${company.name} | Vertical: ${vertCtx}
Product: "${product.name}" | Price: ${product.price_tokens} ${tokenSymbol} tokens | Discount: ${discountValue} tokens off | Expires: ${expiryDate}
${regionNote}
${langNote}

BRAND VOICE:
- Tone: ${tone}
- Style: ${style}
- Emoji policy: ${emojiPolicy} (none=no emojis, light=1-2 max, allowed=use naturally)
${forbiddenClaims.length ? `- FORBIDDEN claims/words (NEVER USE): ${forbiddenClaims.join(', ')}` : ''}
${keywordsToUse.length ? `- Keywords to include naturally: ${keywordsToUse.join(', ')}` : ''}
${keywordsToAvoid.length ? `- Keywords to avoid: ${keywordsToAvoid.join(', ')}` : ''}
${styleRef}

${BASE_COMPLIANCE}
${customCompliance ? `ADDITIONAL COMPLIANCE: ${customCompliance}` : ''}
${PLATFORM_RULES}
${OUTPUT_SCHEMA}`;
}

// ─── GENERATE ONE VARIANT with schema + forbidden validation loop ─────────────
async function generateVariant(apiKey, systemPrompt, variantType, ctx) {
  const { company_id, product_id, discountValue, expiryDate, price, vertical, language, brandVoiceVersion, forbiddenClaims, emojiPolicy } = ctx;
  const ck = cacheKey(company_id, product_id, discountValue, expiryDate, price, vertical, variantType, language, brandVoiceVersion);

  if (sessionCache.has(ck)) {
    const cached = sessionCache.get(ck);
    return { ...cached, from_cache: true };
  }

  const variantLabel = variantType === 'benefit'
    ? `VARIANT A — benefit-led: Focus on VALUE and BENEFIT the customer gains/feels/experiences. Emotionally resonant and desire-building.`
    : `VARIANT B — urgency/scarcity-led: Focus on LIMITED TIME and FOMO. What they LOSE if they don't act. Countdown language, scarcity, exclusivity.`;

  let totalTokens = 0;
  let totalLatency = 0;
  let finalCopy = null;
  let qualityScore = 0;
  let scores = {};
  let issues = [];
  let passCount = 0;

  // ── PASS 1: DRAFT ────────────────────────────────────────────────────────────
  let draftRes;
  let schemaErrors = ['init'];
  let schemaRetries = 0;

  while (schemaErrors.length > 0 && schemaRetries < 3) {
    const retryNote = schemaRetries > 0 ? `\n\nPREVIOUS ATTEMPT FAILED SCHEMA VALIDATION: ${schemaErrors.join(', ')}. Fix ALL issues.` : '';
    draftRes = await callOpenAI(apiKey, CREATOR_MODEL, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: variantLabel + retryNote }
    ]);
    totalTokens += draftRes.tokens_total;
    totalLatency += draftRes.latency_ms;
    passCount++;
    schemaErrors = validateSchema(draftRes.content);
    schemaRetries++;
  }

  if (schemaErrors.length > 0) {
    // Schema still invalid after retries — use what we have
    console.warn(`[generateVariant:${variantType}] schema still has errors after ${schemaRetries} retries:`, schemaErrors);
  }

  finalCopy = enforceXLimit(draftRes.content);

  // ── HARD CHECK: forbidden words ───────────────────────────────────────────
  const foundForbidden = checkForbiddenClaims(finalCopy, forbiddenClaims);
  if (foundForbidden.length > 0) {
    console.warn(`[generateVariant:${variantType}] forbidden words found: ${foundForbidden.join(', ')} — triggering forced rewrite`);
    const fixRes = await callOpenAI(apiKey, CREATOR_MODEL, [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `REWRITE REQUIRED — your previous draft contained forbidden words: ${foundForbidden.join(', ')}.
Remove ALL instances of these words/claims and rewrite naturally. Original:\n${JSON.stringify(finalCopy, null, 2)}\n${variantLabel}`
      }
    ]);
    totalTokens += fixRes.tokens_total;
    totalLatency += fixRes.latency_ms;
    passCount++;
    finalCopy = enforceXLimit(fixRes.content);
  }

  // ── PASS 2: JUDGE ─────────────────────────────────────────────────────────
  const xLen = finalCopy?.x?.primary_text?.length || 0;
  const xQualityIssues = checkXQuality(finalCopy?.x, emojiPolicy || 'light');
  const xHardFails = xQualityIssues.length > 0 ? `\nX PLATFORM HARD FAILURES DETECTED: ${xQualityIssues.join('; ')}. rewrite_required must be true.` : '';

  const judgeRes = await callOpenAI(apiKey, JUDGE_MODEL, [
    { role: 'system', content: `You are a senior social media copy editor and compliance reviewer. Evaluate strictly.` },
    {
      role: 'user',
      content: `Evaluate this ${variantType}-led ad copy for a ${vertical} brand.
x.primary_text length: ${xLen} chars (limit: 280)
x.hashtags count: ${(finalCopy?.x?.hashtags || []).filter(Boolean).length} (max 3)
COPY:\n${JSON.stringify(finalCopy, null, 2)}
Check: x char limit, x hashtag count (max 3), x ALL CAPS, x excessive punctuation, x emoji count vs policy "${emojiPolicy}", brand voice match, forbidden claims, platform appropriateness, CTA strength, originality, compliance, schema completeness.
${xHardFails}
${JUDGE_SCHEMA}`
    }
  ]);
  totalTokens += judgeRes.tokens_total;
  totalLatency += judgeRes.latency_ms;
  passCount++;

  const judgment = judgeRes.content;
  qualityScore = judgment.score_overall || 0;
  scores = judgment.scores || {};
  issues = judgment.issues || [];

  // ── PASS 3: REWRITE if score < gate ───────────────────────────────────────
  if (qualityScore < QUALITY_GATE || judgment.rewrite_required) {
    let rewriteAttempt = 0;
    while ((qualityScore < QUALITY_GATE || judgment.rewrite_required) && rewriteAttempt < MAX_REWRITE_RETRIES) {
      const rewriteRes = await callOpenAI(apiKey, CREATOR_MODEL, [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Rewrite this ${variantType}-led ad copy fixing ALL issues.
ORIGINAL:\n${JSON.stringify(finalCopy, null, 2)}
SCORE: ${qualityScore}/100
ISSUES: ${issues.join('; ')}
INSTRUCTIONS: ${(judgment.rewrite_instructions || []).join('; ')}
${variantLabel}
CRITICAL: x.primary_text MUST be ≤280 chars. Count before submitting.`
        }
      ]);
      totalTokens += rewriteRes.tokens_total;
      totalLatency += rewriteRes.latency_ms;
      passCount++;
      finalCopy = enforceXLimit(rewriteRes.content);
      const schemaErrs2 = validateSchema(finalCopy);
      if (schemaErrs2.length > 0) {
        issues.push(`Schema issues after rewrite: ${schemaErrs2.join(', ')}`);
      }

      // Re-score
      const rescoreRes = await callOpenAI(apiKey, JUDGE_MODEL, [
        { role: 'system', content: 'You are a senior social media copy reviewer. Score this revised copy.' },
        { role: 'user', content: `Score this revised ${variantType}-led copy:\n${JSON.stringify(finalCopy, null, 2)}\n${JUDGE_SCHEMA}` }
      ]);
      totalTokens += rescoreRes.tokens_total;
      totalLatency += rescoreRes.latency_ms;
      passCount++;
      qualityScore = rescoreRes.content.score_overall || qualityScore;
      scores = rescoreRes.content.scores || scores;
      rewriteAttempt++;

      if (qualityScore >= QUALITY_GATE) break;
    }
  }

  // ── FINAL HARD ENFORCEMENT ────────────────────────────────────────────────
  finalCopy = enforceXLimit(finalCopy);
  const finalForbidden = checkForbiddenClaims(finalCopy, forbiddenClaims);
  if (finalForbidden.length > 0) {
    // Micro-rewrite: ask AI to fix only the broken phrases naturally (no raw strip)
    try {
      const microRes = await callOpenAI(apiKey, CREATOR_MODEL, [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `FINAL COMPLIANCE FIX: The following forbidden words/claims still appear in the copy: ${finalForbidden.join(', ')}.
Rewrite ONLY the sentences that contain these words — keep everything else identical.
Do not remove content, replace the phrase with a natural alternative that conveys the same meaning without the forbidden terms.
Return the complete corrected JSON:
${JSON.stringify(finalCopy, null, 2)}`
        }
      ]);
      totalTokens += microRes.tokens_total;
      totalLatency += microRes.latency_ms;
      passCount++;
      const microFixed = enforceXLimit(microRes.content);
      // Only accept if schema is still valid
      if (validateSchema(microFixed).length === 0) {
        finalCopy = microFixed;
        issues.push(`Micro-rewrite removed forbidden: ${finalForbidden.join(', ')}`);
      } else {
        // Fallback: raw strip (last resort) only if micro-rewrite broke schema
        const copyStr = JSON.stringify(finalCopy);
        let cleaned = copyStr;
        for (const fw of finalForbidden) {
          cleaned = cleaned.replace(new RegExp(fw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[removed]');
        }
        finalCopy = JSON.parse(cleaned);
        issues.push(`Forbidden words stripped (micro-rewrite failed schema): ${finalForbidden.join(', ')}`);
      }
    } catch (e) {
      issues.push(`Forbidden words could not be fixed: ${e.message}`);
    }
  }

  // Log passes for cost auditing
  console.log(`[variant:${variantType}] passes:${passCount} tokens:${totalTokens} score:${qualityScore} x_len:${finalCopy?.x?.primary_text?.length || 0}`);

  const result = { copy: finalCopy, qualityScore, scores, issues, totalTokens, totalLatency, passCount, from_cache: false };
  sessionCache.set(ck, result);
  return result;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { company_id, product_id, language: requestedLang } = await req.json();
    if (!company_id || !product_id) return Response.json({ error: 'company_id and product_id required' }, { status: 400 });

    // Fetch all needed data in parallel
    const [products, companies, tokens, brandVoices] = await Promise.all([
      base44.asServiceRole.entities.Product.filter({ id: product_id }),
      base44.asServiceRole.entities.Company.filter({ id: company_id }),
      base44.asServiceRole.entities.CompanyToken.filter({ company_id }),
      base44.asServiceRole.entities.BrandVoice.filter({ company_id })
    ]);

    if (!products.length) return Response.json({ error: 'Product not found' }, { status: 404 });
    if (!companies.length) return Response.json({ error: 'Company not found' }, { status: 404 });

    // ── PLAN GATING ────────────────────────────────────────────────────────────
    const company_ = companies[0];
    const planTier = company_.plan_tier || 'basic';
    const planStatus = company_.plan_status || 'active';
    const effectiveTier = (planStatus === 'past_due' || planStatus === 'canceled') ? 'basic' : planTier;
    const PRO_FEATURES = ['basic', 'advanced', 'pro'];
    if (effectiveTier !== 'pro') {
      return Response.json({
        error: 'AI campaigns require a Pro plan. Please upgrade.',
        upgrade_required: true,
        required_tier: 'pro',
        current_tier: effectiveTier
      }, { status: 403 });
    }

    // ── AI BUDGET CHECK ────────────────────────────────────────────────────────
    // Estimate cost before generation (~$0.015-0.025 per campaign)
    const estimatedCost = 0.02;
    try {
      const budgetRes = await base44.functions.invoke('checkAIBudget', { 
        company_id, 
        estimated_cost_usd: estimatedCost 
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
      console.warn('[generateCampaignWithAI] Budget check failed (non-blocking):', budgetErr.message);
    }

    const product = products[0];
    if (product.company_id !== company_id) return Response.json({ error: 'Product does not belong to this company' }, { status: 403 });

    // Rate limit
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const allCampaigns = await base44.asServiceRole.entities.CouponCampaign.filter({ company_id });
    const todayCount = allCampaigns.filter(c => new Date(c.created_date) >= todayStart).length;
    const remaining = Math.max(0, AI_DAILY_LIMIT - todayCount);
    if (todayCount >= AI_DAILY_LIMIT) {
      return Response.json({ error: `Daily AI generation limit reached (${AI_DAILY_LIMIT}/day). Try again tomorrow.`, remaining: 0, limit: AI_DAILY_LIMIT }, { status: 429 });
    }

    const company = companies[0];
    const token = tokens[0];
    const brandVoice = brandVoices[0] || null;
    const tokenSymbol = token?.token_symbol || 'tokens';
    const discountValue = Math.floor(product.price_tokens * 0.1) || 50;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const vertical = company.vertical || 'other';
    const language = requestedLang || brandVoice?.language || company.target_region?.startsWith('IL') ? 'he' : 'en';

    // Brand voice version for cache invalidation
    const brandVoiceVersion = [
      company.brand_voice_tone, company.brand_voice_style, company.emoji_policy,
      (company.forbidden_claims || []).join(','), (company.keywords_to_use || []).join(',')
    ].join('|');

    const forbiddenClaims = [
      ...(company.forbidden_claims || []),
      ...(brandVoice?.forbidden_words ? brandVoice.forbidden_words.split(',').map(s => s.trim()) : [])
    ].filter(Boolean);

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    const systemPrompt = buildSystemPrompt({ company, product, tokenSymbol, discountValue, expiryDate, brandVoice, language });
    const variantCtx = { company_id, product_id, discountValue, expiryDate: expiresAt, price: product.price_tokens, vertical, language, brandVoiceVersion, forbiddenClaims, emojiPolicy: company.emoji_policy || brandVoice?.use_emojis === false ? 'none' : 'light' };

    // ── Generate A and B in parallel ──────────────────────────────────────────
    const [vA, vB] = await Promise.all([
      generateVariant(openaiKey, systemPrompt, 'benefit', variantCtx),
      generateVariant(openaiKey, systemPrompt, 'urgency', variantCtx)
    ]);

    const copyA = vA.copy;
    const copyB = vB.copy;
    const totalTokensUsed = vA.totalTokens + vB.totalTokens;
    const totalLatency = vA.totalLatency + vB.totalLatency;
    const totalPasses = vA.passCount + vB.passCount;
    const avgScore = Math.round((vA.qualityScore + vB.qualityScore) / 2);
    const estimatedCostUsd = parseFloat(((totalTokensUsed / 1000) * 0.005).toFixed(4));

    const symbolPart = (token?.token_symbol || company.name.substring(0, 4)).toUpperCase().replace(/\s+/g, '').substring(0, 5);
    const codeA = genCode(symbolPart);
    const codeB = genCode(symbolPart);

    const qualityNotesA = [
      ...(vA.issues || []).slice(0, 5),
      ...Object.entries(vA.scores || {}).map(([k, v]) => `${k}: ${v}/100`)
    ];
    const qualityNotesB = [
      ...(vB.issues || []).slice(0, 5),
      ...Object.entries(vB.scores || {}).map(([k, v]) => `${k}: ${v}/100`)
    ];

    const campaign = await base44.asServiceRole.entities.CouponCampaign.create({
      company_id, product_id,
      product_name: product.name,
      product_price: product.price_tokens,
      coupon_code: codeA,
      coupon_code_b: codeB,
      status: 'draft',
      ig_copy_a:       copyA.ig?.primary_text || '',
      fb_copy_a:       copyA.fb?.primary_text || '',
      x_copy_a:        copyA.x?.primary_text || '',
      linkedin_copy_a: copyA.linkedin?.primary_text || '',
      ig_copy_b:       copyB.ig?.primary_text || '',
      fb_copy_b:       copyB.fb?.primary_text || '',
      x_copy_b:        copyB.x?.primary_text || '',
      linkedin_copy_b: copyB.linkedin?.primary_text || '',
      ig_active_variant: 'a', fb_active_variant: 'a', x_active_variant: 'a', linkedin_active_variant: 'a',
      hashtags: (copyA.ig?.hashtags || []).join(', '),
      cta: copyA.ig?.cta || copyA.global?.offer_summary || '',
      discount_type: 'tokens',
      discount_value: discountValue,
      expires_at: expiresAt,
      views_a: 0, copies_a: 0, redemptions_a: 0,
      views_b: 0, copies_b: 0, redemptions_b: 0,
      views: 0, copies: 0, redemptions: 0,
      structured_copy_a: JSON.stringify(copyA),
      structured_copy_b: JSON.stringify(copyB),
      creator_model: CREATOR_MODEL,
      judge_model: JUDGE_MODEL,
      prompt_version: PROMPT_VERSION,
      ai_model: `${CREATOR_MODEL}+${JUDGE_MODEL}`,
      ai_tokens_used: totalTokensUsed,
      ai_prompt_vertical: vertical,
      ai_quality_score: avgScore,
      ai_quality_score_a: vA.qualityScore,
      ai_quality_score_b: vB.qualityScore,
      ai_quality_notes: JSON.stringify({ a: qualityNotesA, b: qualityNotesB }),
      ai_issues_a: (vA.issues || []).join('; '),
      ai_issues_b: (vB.issues || []).join('; '),
      ai_passes: totalPasses,
      ai_language: language,
      ai_latency_ms: totalLatency,
      ai_cost_estimate_usd: estimatedCostUsd,
      ai_prompt_version: PROMPT_VERSION
    });

    await Promise.all([
      base44.asServiceRole.entities.Coupon.create({ company_id, coupon_code: codeA, discount_type: 'percentage', discount_value: 10, min_purchase_amount: 0, max_uses: 1000, times_used: 0, status: 'active', expires_at: expiresAt, client_phone: 'campaign-a' }),
      base44.asServiceRole.entities.Coupon.create({ company_id, coupon_code: codeB, discount_type: 'percentage', discount_value: 10, min_purchase_amount: 0, max_uses: 1000, times_used: 0, status: 'active', expires_at: expiresAt, client_phone: 'campaign-b' })
    ]);

    const totalTime = Date.now() - t0;
    console.log(`[generateCampaignWithAI] ${PROMPT_VERSION} | ${totalTime}ms | tokens:${totalTokensUsed} | passes_a:${vA.passCount} passes_b:${vB.passCount} | score_a:${vA.qualityScore} score_b:${vB.qualityScore} | cost:$${estimatedCostUsd} | x_len_a:${copyA.x?.primary_text?.length||0} x_len_b:${copyB.x?.primary_text?.length||0} | cached_a:${vA.from_cache} cached_b:${vB.from_cache} | lang:${language}`);

    // Record usage to budget
    base44.functions.invoke('recordAIUsage', {
      company_id,
      feature: 'campaign_generate',
      cost_usd: estimatedCostUsd,
      usage_id: `campaign_${campaign.id}`,
      context: { campaign_id: campaign.id, product_id, variant_count: 2 }
    }).catch(err => console.warn('[generateCampaignWithAI] Usage record failed:', err.message));

    return Response.json({
      success: true,
      campaign,
      meta: {
        tokens_used: totalTokensUsed,
        passes_a: vA.passCount, passes_b: vB.passCount,
        quality_score_a: vA.qualityScore, quality_score_b: vB.qualityScore,
        issues_a: vA.issues, issues_b: vB.issues,
        cost_estimate_usd: estimatedCostUsd,
        latency_ms: totalTime,
        prompt_version: PROMPT_VERSION,
        language,
        from_cache_a: vA.from_cache, from_cache_b: vB.from_cache,
        x_len_a: copyA.x?.primary_text?.length || 0,
        x_len_b: copyB.x?.primary_text?.length || 0,
        rate_limit: { used: todayCount + 1, limit: AI_DAILY_LIMIT, remaining: remaining - 1 }
      }
    });

  } catch (error) {
    console.error('[generateCampaignWithAI] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});