import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { createWalletClient, createPublicClient, http, parseUnits, parseEther, encodeFunctionData, isAddress, getAddress } from 'npm:viem@2.7.0';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';
import { avalancheFuji, avalanche } from 'npm:viem@2.7.0/chains';

// ── Network resolution helper (company-based) ────────────────────────────────
function normalizeNetwork(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s === 'fuji' || s === 'avalanche_fuji' || s === 'avax_fuji' || s === 'testnet') return 'fuji';
  if (s === 'mainnet' || s === 'avalanche' || s === 'avax' || s === 'avax_mainnet') return 'mainnet';
  return s;
}

function resolveCompanyChain(company, companyToken) {
  const raw = company?.onchain_network || companyToken?.chain || null;
  
  // Fallback to global AVAX_NETWORK if company doesn't specify
  const fallbackNetwork = Deno.env.get('AVAX_NETWORK') || 'fuji';
  const networkToUse = raw || fallbackNetwork;
  
  const normalized = normalizeNetwork(networkToUse);
  if (normalized !== 'fuji' && normalized !== 'mainnet') {
    console.warn(`⚠️ Invalid network "${networkToUse}", falling back to fuji`);
    return {
      chain: avalancheFuji,
      rpcUrl: Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc',
      walletChain: 'avalanche_fuji',
      explorerTx: 'https://testnet.snowtrace.io/tx/',
      networkName: 'fuji',
      isMainnet: false
    };
  }
  
  const isMainnet = normalized === 'mainnet';
  return {
    chain: isMainnet ? avalanche : avalancheFuji,
    rpcUrl: isMainnet
      ? (Deno.env.get('MAINNET_RPC_URL') || 'https://api.avax.network/ext/bc/C/rpc')
      : (Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc'),
    walletChain: isMainnet ? 'avalanche' : 'avalanche_fuji',
    explorerTx: isMainnet ? 'https://snowtrace.io/tx/' : 'https://testnet.snowtrace.io/tx/',
    networkName: normalized,
    isMainnet
  };
}

function requireGasWalletKey() {
  let key = Deno.env.get('GAS_WALLET_PRIVATE_KEY');
  if (!key) throw new Error('Missing GAS_WALLET_PRIVATE_KEY');
  if (!key.startsWith('0x')) key = `0x${key}`;
  return key;
}

async function toReferenceId(value) {
  const encoded    = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return `0x${Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}
// ─────────────────────────────────────────────────────────────────────────────

// MooadonRewards ABI — mintReward emits RewardMinted event (indexed for grant metrics)
// Falls back to legacy ERC-20 transfer if contract doesn't have mintReward
const MOOADON_REWARDS_ABI = [
  {
    type: 'function',
    name: 'mintReward',
    inputs: [
      { name: 'customer',    type: 'address' },
      { name: 'amount',      type: 'uint256' },
      { name: 'referenceId', type: 'bytes32' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to',     type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    name: 'RewardMinted',
    inputs: [
      { name: 'merchant',     type: 'address', indexed: true  },
      { name: 'customer',     type: 'address', indexed: true  },
      { name: 'amount',       type: 'uint256', indexed: false },
      { name: 'referenceId',  type: 'bytes32', indexed: true  }
    ]
  }
];

Deno.serve(async (req) => {
  console.log('🚀 createPOSTransaction function started');
  console.log('📍 Timestamp:', new Date().toISOString());
  
  try {
    console.log('🔐 Step 1: Initializing Base44 client...');
    const base44 = createClientFromRequest(req);
    
    console.log('👤 Step 2: Authenticating user...');
    const user = await base44.auth.me();

    if (!user) {
      console.error('❌ Authentication failed - no user found');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ User authenticated:', user.email, 'Role:', user.role);

    console.log('📦 Step 3: Parsing request body...');
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error('❌ Invalid JSON body:', e.message);
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { phone, amount, order_id, company_id, branch_id, reward_type, coupon_code } = body;
    
    console.log('📋 RAW REQUEST BODY:', JSON.stringify(body, null, 2));
    console.log('📋 Transaction data:', { phone, amount, company_id, branch_id, reward_type });

    // Initialize blockchain tracking variables for all code paths
    let blockchainSuccess = false;
    let txHash = null;

    // Step 3.5: Rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimitStore = globalThis.__rateLimitStore || (globalThis.__rateLimitStore = new Map());
    const now_rl = Date.now();
    const windowMs = 60 * 1000;

    const ipEntry = rateLimitStore.get(`pos:${ip}`);
    if (ipEntry && now_rl < ipEntry.resetAt) {
      if (ipEntry.count >= 120) {
        return Response.json({ error: 'Too many requests. Please try again later.' }, { status: 429, headers: { 'Retry-After': '60' } });
      }
      ipEntry.count++;
    } else {
      rateLimitStore.set(`pos:${ip}`, { count: 1, resetAt: now_rl + windowMs });
    }

    const phoneEntry = rateLimitStore.get(`pos:phone:${phone}`);
    if (phoneEntry && now_rl < phoneEntry.resetAt) {
      if (phoneEntry.count >= 10) {
        return Response.json({ error: 'Too many transactions for this phone number. Please wait.' }, { status: 429, headers: { 'Retry-After': '60' } });
      }
      phoneEntry.count++;
    } else {
      rateLimitStore.set(`pos:phone:${phone}`, { count: 1, resetAt: now_rl + windowMs });
    }

    // Validate inputs
    console.log('✔️ Step 4: Validating inputs...');
    if (!phone || !company_id || !branch_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (amount === undefined || amount === null || amount === '') {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Get company
    console.log('🏢 Step 5: Fetching company...');
    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    if (!companies || companies.length === 0) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }
    const company = companies[0];
    console.log('✅ Company found:', company.name);

    // Check CompanyToken configuration
    console.log('🪙 Step 6: Checking CompanyToken...');
    const companyTokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id: company_id });
    if (!companyTokens || companyTokens.length === 0) {
      return Response.json({ error: 'Company token not configured. Please set up CompanyToken first.' }, { status: 400 });
    }
    // prefer is_primary: true, fallback to newest with contract_address
    const primaryToken = companyTokens.find(t => t.is_primary === true && t.contract_address);
    const companyToken = primaryToken
      || companyTokens.filter(t => t.contract_address).sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0]
      || companyTokens[companyTokens.length - 1];
    console.log(`🪙 Selected token: ${companyToken?.token_symbol} | contract: ${companyToken?.contract_address} | is_primary: ${companyToken?.is_primary}`);
    console.log('✅ CompanyToken found:', companyToken.token_symbol, 'Contract:', companyToken.contract_address);

    // Resolve network
    const chainConfig = resolveCompanyChain(company, companyToken);
    console.log('🌐 Network resolved:', chainConfig.networkName);

    // Calculate tokens
    const rewardRate = company.reward_rate || company.points_to_currency_ratio || 10;
    const tokens = Math.floor(parsedAmount * rewardRate);
    console.log('🎁 Step 7: Tokens calculated:', tokens, companyToken.token_symbol);

    // Check for coupon
    let appliedDiscount = 0;
    let redeemedCoupon = null;
    if (coupon_code) {
      const coupons = await base44.asServiceRole.entities.Coupon.filter({
        company_id, coupon_code, status: 'active'
      });
      if (coupons.length > 0) {
        const coupon = coupons[0];
        const now = new Date();
        if (coupon.status === 'active' && !(coupon.expires_at && new Date(coupon.expires_at) < now) &&
            coupon.times_used < coupon.max_uses && !(coupon.min_purchase_amount && parsedAmount < coupon.min_purchase_amount)) {
          appliedDiscount = coupon.discount_type === 'percentage'
            ? (parsedAmount * coupon.discount_value) / 100
            : coupon.discount_value;
          redeemedCoupon = coupon;
          console.log('✅ Coupon applied! Discount:', appliedDiscount);
        }
      }
    }

    // Identify customer
    console.log('👤 Step 9: Identifying customer for phone:', phone);
    
    // CRITICAL FIX: Enhanced phone normalization
    // Inlined from phoneUtils.ts (cannot import in Deno Deploy)
    const normalizePhone = (p) => {
      if (!p) return '';
      let n = p.trim().replace(/[\s\-\(\)]/g, '');
      if (!n.startsWith('+')) {
        n = n.startsWith('0') ? '+972' + n.substring(1) : '+' + n;
      }
      return n;
    };
    
    const normalizedPhone = normalizePhone(phone);
    console.log(`📞 Phone normalization: "${phone}" → "${normalizedPhone}"`);

    let clients = await base44.asServiceRole.entities.Client.filter({ 
      company_id, 
      phone: normalizedPhone 
    });
    
    // CRITICAL FIX: Deterministic selection - always pick oldest client
    if (clients && clients.length > 1) {
      console.warn(`⚠️ Found ${clients.length} clients with phone ${normalizedPhone} - using oldest`);
      clients.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    }
    
    let is_new_customer = false;
    let client;

    if (clients && clients.length > 0) {
      client = clients[0];
      console.log(`✅ Found existing client: ${client.id}`);
    } else {
      is_new_customer = true;
      client = await base44.asServiceRole.entities.Client.create({
        company_id, phone: normalizedPhone,
        current_balance: 0, total_earned: 0, total_redeemed: 0,
        level: 'Bronze', risk_score: 0, grants_today_count: 0, redemptions_today_count: 0
      });
      console.log(`✅ Created new client: ${client.id}`);
    }
    const client_id = client.id;
    console.log('✅ Customer ready:', client_id, 'Is new:', is_new_customer);

    // Anti-abuse checks
    try {
      const abuseCheckResponse = await base44.asServiceRole.functions.invoke('AntiAbuseService', {
        client_id, company_id, check_type: 'all',
        context: { purchase_timestamp: new Date().toISOString(), amount: parsedAmount }
      });
      if (abuseCheckResponse.data.success && abuseCheckResponse.data.blocked) {
        return Response.json({
          success: false, error: 'Transaction blocked due to suspicious activity',
          violations: abuseCheckResponse.data.violations, risk_score: abuseCheckResponse.data.risk_score
        }, { status: 403 });
      }
    } catch (abuseError) {
      console.error('⚠️ Anti-abuse check failed (non-critical):', abuseError.message);
    }

    // FIX: Removed RewardIntent + claim_token + claim_url
    // POS = auto-send flow only (no claim links)

    const finalAmount = parsedAmount - appliedDiscount;

    // Create transaction
    console.log('📝 Step 11: Creating Transaction entity...');
    let transaction;
    try {
      transaction = await base44.asServiceRole.entities.Transaction.create({
        company_id, branch_id, client_id: client.id, client_phone: normalizedPhone,
        order_id: order_id || `ORD-${Date.now()}`, amount: parsedAmount,
        tokens_expected: (reward_type === 'token' || reward_type === 'points' || !reward_type) ? tokens : 0,
        token_symbol: companyToken.token_symbol,
        status: 'pending', // FIX: Changed from 'completed' to 'pending'
        sms_status: 'pending',
        onchain_status: reward_type === 'token' ? 'pending' : 'none',
        onchain_idempotency_key: `tx:${company_id}:${normalizedPhone}:${order_id || Date.now()}`,
        network: chainConfig.networkName, // FIX: Use resolved network
        retry_count: 0,
        attempted_at: reward_type === 'token' ? new Date().toISOString() : null,
        metadata: {
          reward_type, discount_applied: appliedDiscount, final_amount: finalAmount,
          coupon_code_redeemed: redeemedCoupon?.coupon_code,
          reward_status: 'queued'
        }
      });
    } catch (txError) {
      console.error('❌ Failed to create Transaction:', txError.message);
      throw txError;
    }
    console.log('✅ Transaction created:', transaction.id, '| Status: pending (will be completed after blockchain)');

    // Queue reward
    await base44.asServiceRole.entities.RewardQueue.create({
      transaction_id: transaction.id, customer_id: client.id, company_id, branch_id,
      reward_type: reward_type || 'tokens', amount: tokens,
      status: 'pending', retry_count: 0, max_retries: 3,
      metadata: { order_id: transaction.order_id, token_symbol: companyToken.token_symbol }
    });

    console.log('✅ RewardQueue job created - triggering processor...');
    base44.asServiceRole.functions.invoke('RewardQueueProcessor', {}).catch(err =>
      console.warn('⚠️ RewardQueueProcessor trigger failed (non-critical):', err.message)
    );

    // Mark coupon used
    if (redeemedCoupon) {
      await base44.asServiceRole.entities.Coupon.update(redeemedCoupon.id, {
        times_used: redeemedCoupon.times_used + 1,
        status: (redeemedCoupon.times_used + 1) >= redeemedCoupon.max_uses ? 'used' : 'active',
        used_at: new Date().toISOString(), used_in_transaction: transaction.id
      });
    }

    // Create coupon if reward_type is 'coupon'
    let createdCoupon = null;
    if (reward_type === 'coupon') {
      const couponCode = `COUP-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const baseUrl = 'https://mooadon.com';
      const couponUrl = `${baseUrl}/CouponDisplay?coupon_code=${couponCode}`;
      createdCoupon = await base44.asServiceRole.entities.Coupon.create({
        company_id, client_id: client.id, client_phone: normalizedPhone, transaction_id: transaction.id,
        coupon_code: couponCode, discount_type: 'percentage', discount_value: 10,
        min_purchase_amount: 0, max_uses: 1, times_used: 0, status: 'active',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        coupon_url: couponUrl
      });
      console.log('🎟️ Coupon created:', couponCode);
    }

    // ── WhatsApp notification (reward processing message) ────────────────────
    let TWILIO_ACCOUNT_SID = (company.twilio_account_sid || '').trim() || null;
    let TWILIO_AUTH_TOKEN_VAL = (company.twilio_auth_token || '').trim() || null;
    let TWILIO_WHATSAPP_NUMBER = (company.whatsapp_phone_number || company.twilio_phone_number || '').trim() || null;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN_VAL) {
      TWILIO_ACCOUNT_SID = (Deno.env.get('TWILIO_ACCOUNT_SID') || '').trim() || null;
      TWILIO_AUTH_TOKEN_VAL = (Deno.env.get('TWILIO_AUTH_TOKEN') || '').trim() || null;
      TWILIO_WHATSAPP_NUMBER = (Deno.env.get('TWILIO_WHATSAPP_NUMBER') || '').trim() || null;
    }
    if (!TWILIO_WHATSAPP_NUMBER) TWILIO_WHATSAPP_NUMBER = '+14155238886';

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN_VAL) {
      try {
        let message;
        if (reward_type === 'coupon' && createdCoupon) {
          const couponUrl = `https://mooadon.com/CouponDisplay?coupon_code=${createdCoupon.coupon_code}`;
          message = `🎉 You received a discount coupon from ${company.name}!\n\nCoupon Code: ${createdCoupon.coupon_code}\nDiscount: ${createdCoupon.discount_value}%\nValid until: ${new Date(createdCoupon.expires_at).toLocaleDateString('en-US')}\n\nTap to view:\n${couponUrl}`;
        } else {
          message = `🎉 Transaction Confirmed!\n\nThank you for your purchase from ${company.name}!\n\n✅ Amount: ₪${parsedAmount.toFixed(2)}\n🪙 Tokens Earned: ${tokens} ${companyToken.token_symbol}\n\nYour tokens are being processed and will arrive shortly!`;
        }

        let formattedPhone = normalizedPhone;
        if (!formattedPhone.startsWith('+')) formattedPhone = `+${formattedPhone}`;

        const twilioResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN_VAL}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: `whatsapp:${formattedPhone}`, From: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`, Body: message })
        });

        const smsStatus = twilioResponse.ok ? 'sent' : 'failed';
        await base44.asServiceRole.entities.Transaction.update(transaction.id, { sms_status: smsStatus, sms_sent_at: twilioResponse.ok ? new Date().toISOString() : undefined });
        await base44.asServiceRole.entities.SMSLog.create({
          company_id, client_id: client.id, client_phone: normalizedPhone, transaction_id: transaction.id,
          message_type: 'whatsapp_notification', message_content: message, status: smsStatus,
          sent_at: new Date().toISOString()
        });
      } catch (whatsappError) {
        console.error('❌ WhatsApp error:', whatsappError.message);
        await base44.asServiceRole.entities.Transaction.update(transaction.id, { sms_status: 'failed' });
      }
    }

    // Audit log
    await base44.asServiceRole.entities.AuditLog.create({
      company_id, action: 'pos_transaction', entity_type: 'Transaction', entity_id: transaction.id,
      performed_by: user.id,
      details: { amount: parsedAmount, tokens, client_phone: normalizedPhone, blockchain_success: blockchainSuccess, tx_hash: txHash }
    });

    // Receipt commitment (non-blocking)
    let receipt_hash = null, receipt_id = null;
    try {
      const commitmentRes = await base44.asServiceRole.functions.invoke('createReceiptCommitment', {
        company_id, client_id: client.id, internal_tx_id: transaction.id,
        amount: parsedAmount, currency: 'ILS', created_at: new Date().toISOString()
      });
      if (commitmentRes?.receipt_hash) { receipt_hash = commitmentRes.receipt_hash; receipt_id = commitmentRes.receipt_id; }
    } catch (proofError) {
      console.error('⚠️ Receipt commitment failed (non-critical):', proofError.message);
    }

    // Segmentation (fire-and-forget)
    base44.asServiceRole.functions.invoke('segmentationEngine', { company_id, mode: 'single', client_id })
      .catch(err => console.warn('⚠️ segmentationEngine failed:', err.message));

    return Response.json({
      success: true,
      transaction_id: transaction.id,
      reward_type: reward_type || 'token',
      tokens: (reward_type === 'token' || reward_type === 'points' || !reward_type) ? tokens : 0,
      token_symbol: companyToken.token_symbol,
      reward_status: 'processing',
      message: 'Transaction created - rewards processing in background',
      coupon: createdCoupon ? {
        code: createdCoupon.coupon_code, discount_value: createdCoupon.discount_value,
        discount_type: createdCoupon.discount_type, expires_at: createdCoupon.expires_at
      } : null,
      discount_applied: appliedDiscount, final_amount: finalAmount, original_amount: parsedAmount,
      receipt_hash, receipt_id,
      network: chainConfig.networkName
    });

  } catch (error) {
    console.error('❌ CRITICAL ERROR:', error.message, error.stack);
    return Response.json({ error: error.message || 'Failed to create transaction', error_type: error.name, timestamp: new Date().toISOString() }, { status: 500 });
  }
});