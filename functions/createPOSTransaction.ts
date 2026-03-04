import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createWalletClient, createPublicClient, http, parseUnits, parseEther } from 'npm:viem@2.7.0';
import { avalancheFuji } from 'npm:viem@2.7.0/chains';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';

const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
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

    // Step 3.5: Rate limiting and anti-abuse checks
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    console.log('🔍 Request IP:', ip, 'Phone:', phone);

    const rateLimitStore = globalThis.__rateLimitStore || (globalThis.__rateLimitStore = new Map());
    const now_rl = Date.now();
    const windowMs = 60 * 1000;

    const ipEntry = rateLimitStore.get(`pos:${ip}`);
    if (ipEntry && now_rl < ipEntry.resetAt) {
      if (ipEntry.count >= 120) {
        console.warn('⚠️ Rate limit exceeded for IP:', ip);
        return Response.json({ error: 'Too many requests. Please try again later.' }, { status: 429, headers: { 'Retry-After': '60' } });
      }
      ipEntry.count++;
    } else {
      rateLimitStore.set(`pos:${ip}`, { count: 1, resetAt: now_rl + windowMs });
    }

    const phoneEntry = rateLimitStore.get(`pos:phone:${phone}`);
    if (phoneEntry && now_rl < phoneEntry.resetAt) {
      if (phoneEntry.count >= 10) {
        console.warn('⚠️ Rate limit exceeded for phone:', phone);
        return Response.json({ error: 'Too many transactions for this phone number. Please wait.' }, { status: 429, headers: { 'Retry-After': '60' } });
      }
      phoneEntry.count++;
    } else {
      rateLimitStore.set(`pos:phone:${phone}`, { count: 1, resetAt: now_rl + windowMs });
    }

    console.log('✅ Rate limit check passed');

    // Validate inputs
    console.log('✔️ Step 4: Validating inputs...');
    if (!phone || !company_id || !branch_id) {
      console.error('❌ Missing required fields:', { phone: !!phone, company_id: !!company_id, branch_id: !!branch_id });
      return Response.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }
    // amount is required but CAN be 0 for free-item / manual reward grants
    if (amount === undefined || amount === null || amount === '') {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      console.error('❌ Invalid amount:', amount, 'parsed:', parsedAmount);
      return Response.json({ 
        error: 'Invalid amount' 
      }, { status: 400 });
    }
    console.log('✅ Inputs validated - Amount:', parsedAmount);

    // Get company
    console.log('🏢 Step 5: Fetching company...');
    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    if (!companies || companies.length === 0) {
      console.error('❌ Company not found for ID:', company_id);
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }
    const company = companies[0];
    console.log('✅ Company found:', company.name, 'ID:', company.id);

    // Check CompanyToken configuration
    console.log('🪙 Step 6: Checking CompanyToken...');
    const companyTokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id: company_id });
    if (!companyTokens || companyTokens.length === 0) {
      console.error('❌ CompanyToken not found for company:', company_id);
      console.error('⚠️ Company must have a token configured to process transactions');
      return Response.json({ 
        error: 'Company token not configured. Please set up CompanyToken first.' 
      }, { status: 400 });
    }
    // FIX: Prefer active token with a contract address; fallback to first
    const activeTokens = companyTokens.filter(t => t.is_active !== false && t.contract_address);
    const companyToken = activeTokens.length > 0
      ? activeTokens[activeTokens.length - 1]   // newest active token
      : companyTokens[companyTokens.length - 1]; // newest overall
    console.log('✅ CompanyToken found:', companyToken.token_symbol, 'Contract:', companyToken.contract_address);
    console.log('💰 Treasury balance:', companyToken.treasury_balance);

    // Verify blockchain credentials
    console.log('🔑 Step 7: Verifying blockchain credentials...');
    const avalanchePrivateKey = Deno.env.get("GAS_WALLET_PRIVATE_KEY");
    if (!avalanchePrivateKey) {
      console.error('❌ GAS_WALLET_PRIVATE_KEY not set in secrets!');
      return Response.json({ 
        error: 'Missing GAS_WALLET_PRIVATE_KEY — please set this secret in Environment Variables.' 
      }, { status: 500 });
    }
    console.log('✅ GAS_WALLET_PRIVATE_KEY is set (length:', avalanchePrivateKey.length, ')');
    
    // TOKEN_CONTRACT env var is optional - we prefer companyToken.contract_address
    console.log('✅ Using company-specific token contract:', companyToken.contract_address || Deno.env.get('TOKEN_CONTRACT') || '(none yet)');

    // Calculate tokens (1 ILS = N tokens based on company settings)
    console.log('💰 Step 8: Calculating tokens...');
    let tokensRatio = company.points_to_currency_ratio || company.reward_rate || 10;

    // ✅ FIX: Ensure ratio is valid
    if (tokensRatio <= 0) {
      console.warn('⚠️ Invalid tokensRatio:', tokensRatio, '- using default 10');
      tokensRatio = 10;
    }

    const tokens = Math.floor(parsedAmount * tokensRatio);

    // ✅ FIX: Validate tokens
    if (tokens <= 0 && parsedAmount > 0) {
      console.error('❌ Tokens = 0!', { parsedAmount, tokensRatio });
      return Response.json({ 
        error: 'Invalid reward configuration',
        details: 'points_to_currency_ratio must be > 0'
      }, { status: 400 });
    }

    console.log('✅ Tokens calculated:', tokens, '(ratio:', tokensRatio, ')');
    console.log('🎁 Reward type:', reward_type || 'token');
    console.log('🔍 Raw reward_type value:', JSON.stringify(reward_type), 'Type:', typeof reward_type);

    // Check if applying a coupon
    let appliedDiscount = 0;
    let redeemedCoupon = null;
    
    if (coupon_code) {
      console.log('🎟️ Checking coupon:', coupon_code);
      
      const coupons = await base44.asServiceRole.entities.Coupon.filter({
        company_id: company_id,
        code: coupon_code.toUpperCase()
      });
      
      if (coupons && coupons.length > 0) {
        const coupon = coupons[0];
        
        // Validate coupon
        const now = new Date();
        
        if (coupon.status !== 'active') {
          console.log('❌ Coupon not active:', coupon.status);
        } else if (coupon.expires_at && new Date(coupon.expires_at) < now) {
          console.log('❌ Coupon expired');
        } else if (coupon.times_used >= coupon.max_uses) {
          console.log('❌ Coupon already used');
        } else if (coupon.min_purchase_amount && parsedAmount < coupon.min_purchase_amount) {
          console.log('❌ Purchase amount too low');
        } else {
          // Apply discount
          if (coupon.discount_type === 'percentage') {
            appliedDiscount = (parsedAmount * coupon.discount_value) / 100;
          } else {
            appliedDiscount = coupon.discount_value;
          }
          
          redeemedCoupon = coupon;
          console.log('✅ Coupon applied! Discount:', appliedDiscount);
        }
      }
    }

    // STEP 9: Identify customer inline (no inter-function call)
    console.log('👤 Step 9: Identifying customer for phone:', phone);

    // Normalize phone
    let normalizedPhone = phone.trim();
    if (!normalizedPhone.startsWith('+')) normalizedPhone = '+' + normalizedPhone;

    // Look up existing client by phone + company
    let clients = await base44.asServiceRole.entities.Client.filter({
      company_id: company_id,
      phone: normalizedPhone
    });

    let is_new_customer = false;
    let client;

    if (clients && clients.length > 0) {
      client = clients[0];
      console.log('✅ Existing customer found:', client.id);
    } else {
      // Create new client
      is_new_customer = true;
      client = await base44.asServiceRole.entities.Client.create({
        company_id: company_id,
        phone: normalizedPhone,
        current_balance: 0,
        total_earned: 0,
        total_redeemed: 0,
        level: 'Bronze',
        risk_score: 0,
        grants_today_count: 0,
        redemptions_today_count: 0
      });
      console.log('✅ New customer created:', client.id);
    }

    const client_id = client.id;
    console.log('✅ Customer ready:', client_id, 'Is new:', is_new_customer);

    // STEP 9B: Run anti-abuse checks
    console.log('🛡️ Step 9B: Running anti-abuse checks...');
    try {
      const abuseCheckResponse = await base44.asServiceRole.functions.invoke('AntiAbuseService', {
        client_id: client_id,
        company_id: company_id,
        check_type: 'all',
        context: {
          purchase_timestamp: new Date().toISOString(),
          amount: parsedAmount
        }
      });

      if (abuseCheckResponse.data.success && abuseCheckResponse.data.blocked) {
        console.error('🚫 Customer blocked due to suspicious activity');
        return Response.json({ 
          success: false,
          error: 'Transaction blocked due to suspicious activity',
          violations: abuseCheckResponse.data.violations,
          risk_score: abuseCheckResponse.data.risk_score
        }, { status: 403 });
      }
      console.log('✅ Anti-abuse checks passed. Risk score:', abuseCheckResponse.data.risk_score || 0);
    } catch (abuseError) {
      console.error('⚠️ Anti-abuse check failed (non-critical):', abuseError.message);
      // Continue with transaction even if anti-abuse check fails
    }

    // Create RewardIntent for claim flow
    console.log('🎫 Step 10: Creating RewardIntent...');
    const claimToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const rewardIntent = await base44.asServiceRole.entities.RewardIntent.create({
      company_id: company_id,
      client_phone: phone,
      merchant_id: branch_id,
      receipt_id: order_id || `ORD-${Date.now()}`,
      amount: parsedAmount,
      points: (reward_type === 'token' || reward_type === 'points' || !reward_type) ? tokens : 0,
      status: 'CREATED',
      claim_url: claimToken,
      claim_token: claimToken,  // FIX: store the actual token, not the intent ID
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    // GUARD: abort if claim_token wasn't generated
    if (!claimToken) {
      console.error('CRITICAL: claim_token is empty — aborting transaction');
      return Response.json({ error: 'Failed to generate claim token' }, { status: 500 });
    }

    const baseUrl = 'https://mooadon.base44.app';
    const claimUrl = `${baseUrl}/ClaimReward?token=${claimToken}`;
    console.log('✅ RewardIntent created:', rewardIntent.id, 'Token:', claimToken, 'Claim URL:', claimUrl);

    // Calculate final amount after discount
    const finalAmount = parsedAmount - appliedDiscount;
    
    // Create transaction (completed immediately - rewards processed async)
    console.log('📝 Step 11: Creating Transaction entity...');
    let transaction;
    try {
      transaction = await base44.asServiceRole.entities.Transaction.create({
        company_id: company_id,
        branch_id: branch_id,
        client_id: client.id,
        client_phone: phone,
        order_id: order_id || `ORD-${Date.now()}`,
        amount: parsedAmount,
        tokens_expected: (reward_type === 'token' || reward_type === 'points' || !reward_type) ? tokens : 0,
        token_symbol: companyToken.token_symbol,
        status: 'completed',
        claim_token: claimToken,  // FIX: was incorrectly set to rewardIntent.id
        claim_url: claimUrl,
        sms_status: 'pending',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          reward_type,
          discount_applied: appliedDiscount,
          final_amount: finalAmount,
          coupon_code_redeemed: redeemedCoupon?.coupon_code,
          reward_intent_id: rewardIntent.id,
          reward_status: 'queued'
        }
      });
      console.log('✅ Transaction created successfully:', transaction.id);
    } catch (txError) {
      console.error('❌ Failed to create Transaction:', txError.message);
      console.error('Error stack:', txError.stack);
      throw txError;
    }

    // Queue reward for async processing
    console.log('📥 Step 11B: Queuing reward for async processing...');
    await base44.asServiceRole.entities.RewardQueue.create({
      transaction_id: transaction.id,
      customer_id: client.id,
      company_id: company_id,
      branch_id: branch_id,
      reward_type: reward_type || 'tokens',
      amount: tokens,
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
      metadata: {
        order_id: transaction.order_id,
        token_symbol: companyToken.token_symbol
      }
    });
    console.log('✅ Reward queued for processing');

    // FIX: Fire-and-forget - trigger RewardQueueProcessor immediately
    base44.asServiceRole.functions.invoke('RewardQueueProcessor', {}).catch(err =>
      console.warn('⚠️ RewardQueueProcessor trigger failed (non-critical):', err.message)
    );

    // Mark coupon as used if applicable
    if (redeemedCoupon) {
      await base44.asServiceRole.entities.Coupon.update(redeemedCoupon.id, {
        times_used: redeemedCoupon.times_used + 1,
        status: (redeemedCoupon.times_used + 1) >= redeemedCoupon.max_uses ? 'used' : 'active',
        used_at: new Date().toISOString(),
        used_in_transaction: transaction.id
      });
      console.log('✅ Coupon marked as used');
    }

    // Create coupon if reward_type is 'coupon'
    let createdCoupon = null;
    if (reward_type === 'coupon') {
      const couponCode = `COUP-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const discountValue = 10; // 10% discount
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      
      createdCoupon = await base44.asServiceRole.entities.Coupon.create({
        company_id: company_id,
        client_id: client.id,
        client_phone: phone,
        transaction_id: transaction.id,
        coupon_code: couponCode,
        discount_type: 'percentage',
        discount_value: discountValue,
        min_purchase_amount: 0,
        max_uses: 1,
        times_used: 0,
        status: 'active',
        expires_at: expiresAt.toISOString()
      });
      
      console.log('🎟️ Coupon created:', couponCode);
    }

    // Skip immediate blockchain processing - now handled by async queue
    console.log('⏭️ Step 12: Skipping immediate blockchain processing (async queue will handle)');

    if (reward_type === 'token') {
      console.log('✅ reward_type === "token" - Starting blockchain transfer process...');
      
      // IMPROVED: Check if client has personal wallet
      if (!client.wallet_address) {
        console.log('📝 Step 13: Client has NO personal wallet - creating custodial wallet and sending claim link...');
        try {
          // Create custodial wallet via createCustodialWallet function
          const custodialResult = await base44.asServiceRole.functions.invoke('createCustodialWallet', {
            client_id: client.id,
            company_id: company_id
          });

          if (!custodialResult.data?.wallet_address) {
            throw new Error('Failed to create custodial wallet: ' + (custodialResult.data?.error || 'unknown error'));
          }

          const custodialAddress = custodialResult.data.wallet_address;
          console.log('🔑 Custodial wallet created:', custodialAddress);

          // Update client with custodial wallet
          await base44.asServiceRole.entities.Client.update(client.id, {
            wallet_address: custodialAddress,
            wallet_chain: 'avalanche_fuji',
            hasWallet: true,
            encryptedPrivateKey: custodialResult.data.encrypted_private_key || null
          });

          client.wallet_address = custodialAddress;
          console.log('✅ Custodial wallet saved to DB');

          // Send WhatsApp with claim link (user hasn't connected own wallet yet)
          console.log('📱 Sending WhatsApp with claim link for custodial wallet...');
          // This will be handled in Step 15 with special messaging for custodial flow
        } catch (walletError) {
          console.error('❌ Failed to create custodial wallet:', walletError.message);
          // Non-blocking: continue without custodial wallet, tokens stay in treasury
          console.warn('⚠️ Proceeding without custodial wallet - tokens will remain in treasury');
          blockchainSuccess = false;
          // Skip blockchain transfer
          client.wallet_address = null;
        }
      } else {
        console.log('✅ Client already has personal wallet:', client.wallet_address);
      }
      
      // IMPROVED: Only send tokens to blockchain if client has wallet (personal or custodial was created)
      if (!client.wallet_address) {
        console.log('⏭️ Step 14: Skipping blockchain transfer - no wallet available for client');
        console.log('💰 Tokens held in company treasury - customer can claim via link');
        blockchainSuccess = false;
      } else {
        console.log('🔗 Step 14: Writing to blockchain...');
        console.log('   - Client wallet:', client.wallet_address);
        console.log('   - Tokens to send:', tokens);
        console.log('   - Using CompanyToken contract:', companyToken.contract_address);

        try {
          // Setup blockchain connection - Avalanche Fuji testnet
          const rpcUrl = Deno.env.get('AVALANCHE_RPC') || 'https://api.avax-test.network/ext/bc/C/rpc';
          console.log('[POS] rpcUrl:', rpcUrl);

          // Use GAS_WALLET_PRIVATE_KEY as relayer
          let relayerPrivateKey = Deno.env.get('GAS_WALLET_PRIVATE_KEY');
          if (!relayerPrivateKey) {
            throw new Error('Missing GAS_WALLET_PRIVATE_KEY — please set this secret in Environment Variables.');
          }

          // Ensure private key has 0x prefix for viem
          if (!relayerPrivateKey.startsWith('0x')) {
            relayerPrivateKey = `0x${relayerPrivateKey}`;
          }

          // Create viem account and clients
          const account = privateKeyToAccount(relayerPrivateKey);
          console.log('✅ Relayer wallet:', account.address);

          const publicClient = createPublicClient({
            chain: avalancheFuji,
            transport: http(rpcUrl)
          });

          const walletClient = createWalletClient({
            account,
            chain: avalancheFuji,
            transport: http(rpcUrl)
          });

          // AUTO-FUND: Check treasury AVAX balance, fund if low
          const treasuryAddress = company.blockchain_wallet_address;
          if (treasuryAddress) {
            try {
              const treasuryBalance = await publicClient.getBalance({ address: treasuryAddress });
              console.log('[POS] treasury:', treasuryAddress, 'AVAX balance:', treasuryBalance.toString());
              if (treasuryBalance < parseEther('0.02')) {
                console.log('[POS] Treasury low on AVAX, funding 0.05 AVAX from relayer...');
                const fundHash = await walletClient.sendTransaction({
                  to: treasuryAddress,
                  value: parseEther('0.05')
                });
                console.log('[POS] fundedTreasuryTx:', fundHash);
                await publicClient.waitForTransactionReceipt({ hash: fundHash, timeout: 30_000 });
                console.log('[POS] Treasury funded successfully');
              }
            } catch (fundError) {
              console.error('[POS] Treasury funding failed:', fundError.message);
            }
          }

          // Use company-specific token contract address from CompanyToken
          // 🔴 CRITICAL FIX: NO FALLBACK to global TOKEN_CONTRACT!
          const tokenContractAddress = companyToken.contract_address
            ? (companyToken.contract_address.includes('$') ? companyToken.contract_address.split('$')[1] : companyToken.contract_address)
            : null;

          if (!tokenContractAddress) {
            console.error('❌ CRITICAL: CompanyToken has no contract_address!');
            console.error('   Company ID:', company_id);
            console.error('   Token Symbol:', companyToken.token_symbol);
            console.error('   CompanyToken ID:', companyToken.id);

            await base44.asServiceRole.entities.Transaction.update(transaction.id, {
              status: 'failed',
              metadata: {
                ...transaction.metadata,
                error: 'Company token not deployed - no contract_address',
                failed_at: new Date().toISOString()
              }
            });

            return Response.json({
              error: 'Company token not deployed. Please contact support to deploy your token.',
              company_id: company_id,
              token_symbol: companyToken.token_symbol,
              action_required: 'deployCompanyToken'
            }, { status: 400 });
          }

          console.log('📄 Token contract (company-specific):', tokenContractAddress, '| Symbol:', companyToken.token_symbol);

          // Validate address format
          const { isAddress, getAddress } = await import('npm:viem@2.7.0');
          if (!isAddress(client.wallet_address)) {
            throw new Error(`Invalid address format: ${client.wallet_address}`);
          }

          const recipientAddress = getAddress(client.wallet_address);
          console.log('✅ Recipient address:', recipientAddress);

          // Token has 18 decimals
          const tokensToSend = tokens;
          const amountInWei = parseUnits(tokensToSend.toString(), 18);

          console.log('💱 Sending', tokensToSend, 'tokens to', recipientAddress);

          // Encode transfer function call
          const { encodeFunctionData } = await import('npm:viem@2.7.0');
          const data = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [recipientAddress, amountInWei]
          });

          console.log('📦 Encoded transfer data');

          // Send transaction
          txHash = await walletClient.sendTransaction({
            to: tokenContractAddress,
            data,
            gas: 100000n
          });

          console.log('📤 Blockchain TX sent:', txHash);

          // Wait for confirmation
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
            timeout: 60_000
          });

          // Convert all BigInt values to numbers for database storage
          const blockNumber = Number(receipt.blockNumber);
          const gasUsed = Number(receipt.gasUsed);
          console.log('✅ Blockchain TX confirmed! Block:', blockNumber);

          blockchainSuccess = true;

          // Update transaction with blockchain data (ensure no BigInt values)
          const updateData = {
            status: 'completed',
            tokens_actual: Number(tokens),
            blockchain_tx_hash: String(txHash),
            blockchain_confirmed_at: new Date().toISOString(),
            metadata: JSON.parse(JSON.stringify({
              ...transaction.metadata,
              blockchain_tx_hash: String(txHash),
              block_number: blockNumber,
              gas_used: gasUsed,
              relayer_address: String(account.address),
              gas_paid_by_relayer: true
            }, (key, value) => typeof value === 'bigint' ? value.toString() : value))
          };
          await base44.asServiceRole.entities.Transaction.update(transaction.id, updateData);

          console.log('✅ Blockchain confirmation - WhatsApp already sent after transaction creation');

          // Calculate new level based on total_earned
          const newTotalEarned = (client.total_earned || 0) + tokens;
          let newLevel = 'Bronze';
          if (newTotalEarned >= 10001) {
            newLevel = 'Gold';
          } else if (newTotalEarned >= 1001) {
            newLevel = 'Silver';
          }

          // Update client balances
          await base44.asServiceRole.entities.Client.update(client.id, {
            current_balance: Number((client.current_balance || 0) + tokens),
            total_earned: Number(newTotalEarned),
            level: newLevel,
            tokenBalance: Number((client.tokenBalance || 0) + tokensToSend),
            onchain_balance: Number((client.onchain_balance || 0) + tokensToSend),
            last_sync: new Date().toISOString(),
            last_activity: new Date().toISOString()
          });

          // Create ledger event
          await base44.asServiceRole.entities.LedgerEvent.create({
            company_id: company_id,
            client_id: client.id,
            transaction_id: transaction.id,
            type: 'earn',
            points: Number(tokens),
            balance_before: Number(client.current_balance || 0),
            balance_after: Number((client.current_balance || 0) + tokens),
            source: 'pos',
            description: `Earned ${tokens} ${companyToken.token_symbol} tokens from purchase of ₪${parsedAmount}`,
            performed_by: user.id,
            metadata: {
              amount: parsedAmount,
              tx_hash: txHash,
              block_number: blockNumber,
              tokens_sent: Number(tokensToSend),
              contract_address: tokenContractAddress
            }
          });

          // STEP 14B: Process Benefits using BenefitsEngine  
          console.log('🎁 Step 14B: Processing benefits via BenefitsEngine...');
          try {
            // Calculate purchase count for nth purchase benefits
            const clientTransactions = await base44.asServiceRole.entities.Transaction.filter({
              client_id: client.id,
              company_id: company_id,
              status: 'completed'
            });
            const purchase_count = clientTransactions.length;

            const trigger_event = is_new_customer ? 'USER_SIGNUP' : 
                                 purchase_count === 2 ? 'NTH_PURCHASE_COMPLETED' : 
                                 'PURCHASE_COMPLETED';

            console.log('🎯 Trigger event:', trigger_event, 'Purchase count:', purchase_count);

            // Call the BenefitsEngine internally (inline)
            const eligibleBenefits = await checkBenefitEligibility(
              base44, 
              client.id, 
              company_id, 
              trigger_event, 
              { purchase_count, is_new_customer, amount: parsedAmount }
            );

            console.log('✅ Eligible benefits:', eligibleBenefits.length);

            const grants = [];
            for (const eligibleBenefit of eligibleBenefits) {
              try {
                const grant = await issueBenefitGrant(
                  base44,
                  eligibleBenefit.benefit_id,
                  client.id,
                  company_id,
                  { transaction_id: transaction.id, amount: parsedAmount }
                );
                grants.push(grant);
                console.log('✅ Grant issued:', grant.id);
              } catch (grantError) {
                console.error('⚠️ Failed to issue grant:', grantError.message);
              }
            }

            console.log('✅ Benefits processed:', grants.length, 'grants issued');

            // Update transaction metadata with benefits
            if (grants.length > 0) {
              await base44.asServiceRole.entities.Transaction.update(transaction.id, {
                metadata: {
                  ...transaction.metadata,
                  benefits_issued: grants.length,
                  grant_ids: grants.map(g => g.id)
                }
              });
            }
          } catch (benefitsError) {
            console.error('⚠️ Benefits processing failed (non-critical):', benefitsError.message);
            console.error('Stack:', benefitsError.stack);
          }

          // Create blockchain transfer record
          await base44.asServiceRole.entities.BlockchainTransfer.create({
            company_id: company_id,
            client_id: client.id,
            from_address: String(account.address),
            to_address: String(client.wallet_address),
            chain: 'avalanche_fuji',
            amount: Number(tokensToSend),
            tx_hash: String(txHash),
            status: 'confirmed',
            block_number: blockNumber
          });

          console.log('✅ Blockchain transfer recorded');

        } catch (blockchainError) {
          console.error('❌❌❌ BLOCKCHAIN ERROR CAUGHT ❌❌❌');
          console.error('Error message:', blockchainError.message);
          console.error('Error stack:', blockchainError.stack);
          console.error('Full error object:', JSON.stringify(blockchainError, null, 2));
          
          // CRITICAL: Mark transaction as blockchain_failed when blockchain fails
          // Business logic (token calculation) succeeded, blockchain is just a bonus feature
          await base44.asServiceRole.entities.Transaction.update(transaction.id, {
            status: 'blockchain_failed',
            tokens_actual: tokens,
            metadata: {
              ...transaction.metadata,
              blockchain_error: blockchainError.message,
              blockchain_attempted: true,
              blockchain_success: false
            }
          });
          
          // Calculate new level based on total_earned
          const newTotalEarned = (client.total_earned || 0) + tokens;
          let newLevel = 'Bronze';
          if (newTotalEarned >= 10001) {
            newLevel = 'Gold';
          } else if (newTotalEarned >= 1001) {
            newLevel = 'Silver';
          }

          // Update client balances even if blockchain failed
          await base44.asServiceRole.entities.Client.update(client.id, {
            current_balance: Number((client.current_balance || 0) + tokens),
            total_earned: Number(newTotalEarned),
            level: newLevel,
            last_activity: new Date().toISOString()
          });
          
          // Create ledger event for tokens earned (without blockchain)
          await base44.asServiceRole.entities.LedgerEvent.create({
            company_id: company_id,
            client_id: client.id,
            transaction_id: transaction.id,
            type: 'earn',
            points: Number(tokens),
            balance_before: Number(client.current_balance || 0),
            balance_after: Number((client.current_balance || 0) + tokens),
            source: 'pos',
            description: `Earned ${tokens} ${companyToken.token_symbol} tokens from purchase of ₪${parsedAmount} (blockchain failed)`,
            performed_by: user.id,
            metadata: {
              amount: parsedAmount,
              blockchain_error: blockchainError.message
            }
          });

          // Create BlockchainTransfer record with failed status
          let fromAddress = 'unknown';
          try {
            let pk = Deno.env.get("GAS_WALLET_PRIVATE_KEY");
            if (pk) {
              if (!pk.startsWith('0x')) pk = `0x${pk}`;
              const acc = privateKeyToAccount(pk);
              fromAddress = acc.address;
            }
          } catch {}
          await base44.asServiceRole.entities.BlockchainTransfer.create({
            company_id: company_id,
            client_id: client.id,
            transaction_id: transaction.id,
            from_address: fromAddress,
            to_address: client.wallet_address || 'unknown',
            chain: 'avalanche_fuji',
            amount: Number(tokens),
            status: 'failed',
            error_message: blockchainError.message
          });

          console.log('✅ Transaction marked as blockchain_failed and failure logged');
          blockchainSuccess = false;
        }
      }
    } else if (reward_type === 'coupon') {
      console.log('⚠️ Skipping blockchain - reward_type is "coupon":', reward_type);
      await base44.asServiceRole.entities.Transaction.update(transaction.id, {
        status: 'completed',
        tokens_actual: 0
      });
      console.log('✅ Transaction marked as completed (coupon reward - no blockchain)');
    } else {
      // FIX: reward_type === 'points' or any non-token type → off-chain balance grant
      console.log('ℹ️ Off-chain grant - reward_type:', reward_type, 'tokens:', tokens);
      const _newBalance = (client.current_balance || 0) + tokens;
      const _newTotalEarned = (client.total_earned || 0) + tokens;
      let _newLevel = 'Bronze';
      if (_newTotalEarned >= 10001) _newLevel = 'Gold';
      else if (_newTotalEarned >= 1001) _newLevel = 'Silver';

      await base44.asServiceRole.entities.Client.update(client.id, {
        current_balance: _newBalance,
        total_earned: _newTotalEarned,
        level: _newLevel,
        last_activity: new Date().toISOString()
      });

      if (tokens > 0) {
        await base44.asServiceRole.entities.LedgerEvent.create({
          company_id: company_id,
          client_id: client.id,
          transaction_id: transaction.id,
          type: 'earn',
          points: tokens,
          balance_before: client.current_balance || 0,
          balance_after: _newBalance,
          source: 'pos',
          description: `Earned ${tokens} ${companyToken.token_symbol} (off-chain grant)`
        });
      }
      await base44.asServiceRole.entities.Transaction.update(transaction.id, {
        status: 'completed',
        tokens_actual: tokens
      });
      blockchainSuccess = false; // off-chain, no TX hash
      console.log('✅ Off-chain balance grant done:', tokens, 'for', phone);
    }

    // Send WhatsApp notification
    console.log('📱 Step 15: Sending WhatsApp notification...');
    
    // ✅ FIX: trim() to catch whitespace-only credentials, || null to force fallback
    let TWILIO_ACCOUNT_SID = (company.twilio_account_sid || '').trim() || null;
    let TWILIO_AUTH_TOKEN = (company.twilio_auth_token || '').trim() || null;
    let TWILIO_WHATSAPP_NUMBER = (company.whatsapp_phone_number || company.twilio_phone_number || '').trim() || null;
    let twilioSource = 'company';

    // Fallback to Secrets if Company doesn't have valid credentials
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      TWILIO_ACCOUNT_SID = (Deno.env.get('TWILIO_ACCOUNT_SID') || '').trim() || null;
      TWILIO_AUTH_TOKEN = (Deno.env.get('TWILIO_AUTH_TOKEN') || '').trim() || null;
      TWILIO_WHATSAPP_NUMBER = (Deno.env.get('TWILIO_WHATSAPP_NUMBER') || '').trim() || null;
      twilioSource = 'secrets';
    }

    // Default WhatsApp sandbox number if still not set
    if (!TWILIO_WHATSAPP_NUMBER) {
      TWILIO_WHATSAPP_NUMBER = '+14155238886';
    }

    console.log('📞 Twilio source:', twilioSource);
    console.log('📞 SID available:', !!TWILIO_ACCOUNT_SID);
    console.log('📞 WhatsApp number:', TWILIO_WHATSAPP_NUMBER);

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      try {
        let message;

        if (reward_type === 'coupon' && createdCoupon) {
          const expiryDate = new Date(createdCoupon.expires_at).toLocaleDateString('en-US');
          message = `🎉 You received a discount coupon from ${company.name}!

Coupon Code: ${createdCoupon.coupon_code}
Discount: ${createdCoupon.discount_value}%
Valid until: ${expiryDate}`;

        } else {
          // IMPROVED: Different message if customer has custodial wallet (needs to claim)
          if (reward_type === 'token' && !blockchainSuccess && client.wallet_address) {
            // Custodial wallet created but tokens are in treasury (awaiting claim)
            message = `🎉 Your ${tokens} ${companyToken.token_symbol} tokens from ${company.name} are ready to claim!

Tap the link below to connect your wallet and receive your tokens:
${claimUrl}

Your tokens are securely held in our custody until you claim them.`;
          } else {
            // Standard message - always include claim link
            message = `🎉 Transaction Confirmed!

Thank you for your purchase from ${company.name}!

✅ Amount: ₪${parsedAmount.toFixed(2)}
🪙 Tokens Earned: ${tokens} ${companyToken.token_symbol}

Tap to view your reward:
${claimUrl}`;
          }
        }

        // Format phone for WhatsApp
        let formattedPhone = phone.trim();
        if (!formattedPhone.startsWith('+')) formattedPhone = `+${formattedPhone}`;
        const whatsappTo = `whatsapp:${formattedPhone}`;
        const whatsappFrom = `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;

        console.log('📞 Sending WhatsApp - TO:', whatsappTo, 'FROM:', whatsappFrom);

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        
        const twilioResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: whatsappTo,
            From: whatsappFrom,
            Body: message
          })
        });

        if (twilioResponse.ok) {
          const result = await twilioResponse.json();
          await base44.asServiceRole.entities.Transaction.update(transaction.id, {
            sms_status: 'sent',
            sms_sent_at: new Date().toISOString()
          });

          await base44.asServiceRole.entities.SMSLog.create({
            company_id: company_id,
            client_id: client.id,
            client_phone: phone,
            transaction_id: transaction.id,
            message_type: 'whatsapp_notification',
            message_content: message,
            status: 'sent',
            sent_at: new Date().toISOString(),
            metadata: { message_sid: result.sid }
          });

          console.log(`✅ WhatsApp sent successfully! SID: ${result.sid}`);
        } else {
          const errorText = await twilioResponse.text();
          console.error('❌ Twilio error:', errorText);

          await base44.asServiceRole.entities.Transaction.update(transaction.id, {
            sms_status: 'failed'
          });

          await base44.asServiceRole.entities.SMSLog.create({
            company_id: company_id,
            client_id: client.id,
            client_phone: phone,
            transaction_id: transaction.id,
            message_type: 'whatsapp_notification',
            message_content: message,
            status: 'failed',
            error_message: errorText
          });
        }
      } catch (whatsappError) {
        console.error('❌ WhatsApp error:', whatsappError.message);

        await base44.asServiceRole.entities.Transaction.update(transaction.id, {
          sms_status: 'failed'
        });

        await base44.asServiceRole.entities.SMSLog.create({
          company_id: company_id,
          client_id: client.id,
          client_phone: phone,
          transaction_id: transaction.id,
          message_type: 'whatsapp_notification',
          message_content: 'Failed to send',
          status: 'failed',
          error_message: whatsappError.message
        });
      }
    } else {
      console.log('⚠️ Twilio credentials not configured - skipping WhatsApp');
    }

    // Create audit log
    await base44.asServiceRole.entities.AuditLog.create({
      company_id: company_id,
      action: 'pos_transaction',
      entity_type: 'Transaction',
      entity_id: transaction.id,
      performed_by: user.id,
      details: {
        amount: parsedAmount,
        tokens: tokens,
        client_phone: phone,
        blockchain_success: blockchainSuccess,
        tx_hash: txHash
      }
    });

    console.log('🎉 Transaction completed successfully!');

    // Create Receipt Commitment (Proof Rail) - non-blocking
    let receipt_hash = null;
    let receipt_id = null;
    try {
      console.log('🔏 Step 16: Creating receipt commitment (Proof Rail)...');
      const commitmentRes = await base44.asServiceRole.functions.invoke('createReceiptCommitment', {
        company_id: company_id,
        client_id: client.id || null,
        internal_tx_id: transaction.id,
        amount: parsedAmount,
        currency: 'ILS',
        created_at: new Date().toISOString()
      });
      if (commitmentRes && commitmentRes.receipt_hash) {
        receipt_hash = commitmentRes.receipt_hash;
        receipt_id = commitmentRes.receipt_id;
        console.log('✅ Receipt commitment created:', receipt_id, 'hash:', receipt_hash);
      }
    } catch (proofError) {
      console.error('⚠️ Receipt commitment failed (non-critical):', proofError.message);
    }

    return Response.json({
      success: true,
      transaction_id: transaction.id,
      reward_type: reward_type || 'token',
      tokens: (reward_type === 'token' || reward_type === 'points' || !reward_type) ? tokens : 0,
      token_symbol: companyToken.token_symbol,
      reward_status: 'pending',
      message: 'Transaction completed - rewards processing in background',
      blockchain_success: blockchainSuccess,
      blockchain_warning: !blockchainSuccess ? 'Blockchain transfer failed but transaction succeeded - tokens queued for retry' : null,
      coupon: createdCoupon ? {
        code: createdCoupon.coupon_code,
        discount_value: createdCoupon.discount_value,
        discount_type: createdCoupon.discount_type,
        expires_at: createdCoupon.expires_at
      } : null,
      discount_applied: appliedDiscount,
      final_amount: finalAmount,
      original_amount: parsedAmount,
      receipt_hash,
      receipt_id
    });

  } catch (error) {
    console.error('❌❌❌ CRITICAL ERROR IN createPOSTransaction ❌❌❌');
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('Error occurred at:', new Date().toISOString());
    
    return Response.json({
      error: error.message || 'Failed to create transaction',
      error_type: error.name,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});

// Helper: Check benefit eligibility
async function checkBenefitEligibility(base44, client_id, company_id, trigger_event, context) {
  const eligibleBenefits = [];
  const benefits = await base44.asServiceRole.entities.Benefit.filter({
    company_id, trigger_event, status: 'ACTIVE'
  });
  console.log(`🔍 Found ${benefits.length} active benefits for ${trigger_event}`);
  
  const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
  if (clients.length === 0) return eligibleBenefits;
  const client = clients[0];

  const pastGrants = await base44.asServiceRole.entities.BenefitGrant.filter({ client_id, company_id });

  for (const benefit of benefits) {
    const now = new Date();
    if (now < new Date(benefit.start_date)) continue;
    if (benefit.end_date && now > new Date(benefit.end_date)) continue;
    if (benefit.max_grants && benefit.grants_issued >= benefit.max_grants) continue;

    const rules = benefit.rule_json || {};
    let isEligible = true;

    // USER_SIGNUP or new customer
    if (trigger_event === 'USER_SIGNUP' || (trigger_event === 'PURCHASE_COMPLETED' && context?.is_new_customer)) {
      if (pastGrants.filter(g => g.benefit_id === benefit.id).length > 0) isEligible = false;
    }

    // NTH_PURCHASE_COMPLETED
    if (trigger_event === 'NTH_PURCHASE_COMPLETED' && rules.purchase_number === 2) {
      if (context?.purchase_count !== 2) isEligible = false;
      if (pastGrants.some(g => g.benefit_id === benefit.id)) isEligible = false;
    }

    // Daily limit
    if (client.grants_today_count && client.grants_today_count >= 10) isEligible = false;

    if (isEligible) {
      eligibleBenefits.push({ benefit_id: benefit.id, benefit_name: benefit.name, benefit_type: benefit.type, rules });
      console.log(`✅ Eligible: ${benefit.name}`);
    } else {
      console.log(`❌ Not eligible: ${benefit.name}`);
    }
  }
  return eligibleBenefits;
}

// Helper: Issue benefit grant
async function issueBenefitGrant(base44, benefit_id, client_id, company_id, context) {
  const benefits = await base44.asServiceRole.entities.Benefit.filter({ id: benefit_id });
  if (benefits.length === 0) throw new Error('Benefit not found');
  const benefit = benefits[0];

  const rules = benefit.rule_json || {};
  const validityDays = rules.validity_days || 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + validityDays);

  const code = `${benefit.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
  console.log(`📝 Creating BenefitGrant for ${benefit.name}`);

  const grant = await base44.asServiceRole.entities.BenefitGrant.create({
    benefit_id, client_id, company_id,
    state: 'ACTIVE',
    issued_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    code,
    metadata: context || {}
  });

  await base44.asServiceRole.entities.Benefit.update(benefit_id, {
    grants_issued: benefit.grants_issued + 1
  });

  const client = await base44.asServiceRole.entities.Client.filter({ id: client_id });
  if (client.length > 0) {
    await base44.asServiceRole.entities.Client.update(client_id, {
      grants_today_count: (client[0].grants_today_count || 0) + 1,
      last_grant_at: new Date().toISOString()
    });
  }

  await base44.asServiceRole.entities.EventLog.create({
    company_id, client_id,
    event_type: 'BENEFIT_GRANTED',
    event_data: {
      benefit_id, benefit_name: benefit.name, benefit_type: benefit.type,
      grant_id: grant.id, code, expires_at: expiresAt.toISOString()
    }
  });

  return grant;
}