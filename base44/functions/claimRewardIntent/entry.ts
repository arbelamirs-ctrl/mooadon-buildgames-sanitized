import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { ethers } from 'npm:ethers@6.9.0';

// In-memory rate limiter: key -> { count, resetAt }
const claimRateLimit = new Map();
function checkClaimRateLimit(key) {
  const now = Date.now();
  const entry = claimRateLimit.get(key);
  if (!entry || now > entry.resetAt) {
    claimRateLimit.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

// ── Chain config helper (inlined — cannot import sibling files in Deno deploy) ─
function normalizeNetwork(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s === 'fuji' || s === 'avalanche_fuji' || s === 'avax_fuji' || s === 'testnet') return 'fuji';
  if (s === 'mainnet' || s === 'avalanche' || s === 'avax' || s === 'avax_mainnet') return 'mainnet';
  return s;
}

function resolveChainConfig(company, companyToken) {
  const raw = company?.onchain_network || companyToken?.chain || null;
  if (!raw) {
    throw new Error(
      `Network not configured for company "${company?.name || company?.id}". ` +
      `Set company.onchain_network to "fuji" or "mainnet".`
    );
  }
  const normalized = normalizeNetwork(raw);
  if (normalized !== 'fuji' && normalized !== 'mainnet') {
    throw new Error(`Invalid network "${raw}" for company "${company?.name || company?.id}". Must be "fuji" or "mainnet".`);
  }
  const isMainnet = normalized === 'mainnet';
  const rpcUrl = isMainnet
    ? (Deno.env.get('MAINNET_RPC_URL') || 'https://api.avax.network/ext/bc/C/rpc')
    : (Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc');
  return {
    rpcUrl,
    walletChain: isMainnet ? 'avalanche' : 'avalanche_fuji',
    isMainnet,
    networkName: normalized,
    explorerBase: isMainnet ? 'https://snowtrace.io/tx' : 'https://testnet.snowtrace.io/tx',
  };
}
// ─────────────────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

Deno.serve(async (req) => {
  let intent_id;
  try {
    const base44 = createClientFromRequest(req);

    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    if (!checkClaimRateLimit(ip)) {
      return Response.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    const body = await req.json();
    intent_id = body.intent_id;
    const { user_wallet } = body;

    if (!intent_id || !user_wallet) {
      return Response.json({ error: 'Missing intent_id or user_wallet' }, { status: 400 });
    }

    // Get intent
    const intents = await base44.asServiceRole.entities.RewardIntent.filter({ id: intent_id });
    if (!intents[0]) {
      return Response.json({ error: 'Intent not found' }, { status: 404 });
    }
    const intent = intents[0];

    // Check status
    if (intent.status === 'PROCESSING') {
      return Response.json({ error: 'Claim already in progress' }, { status: 409 });
    }
    if (intent.status !== 'CREATED') {
      return Response.json({
        error: `Intent already ${intent.status.toLowerCase()}`,
        tx_hash: intent.tx_hash
      }, { status: 400 });
    }

    // Acquire PROCESSING lock BEFORE any blockchain call
    await base44.asServiceRole.entities.RewardIntent.update(intent_id, {
      status: 'PROCESSING',
      processing_started_at: new Date().toISOString()
    });

    // Check expiration
    if (new Date() > new Date(intent.expires_at)) {
      await base44.asServiceRole.entities.RewardIntent.update(intent_id, { status: 'EXPIRED' });
      return Response.json({ error: 'Intent expired' }, { status: 400 });
    }

    // Get company
    const companies = await base44.asServiceRole.entities.Company.filter({ id: intent.company_id });
    if (!companies[0]) return Response.json({ error: 'Company not found' }, { status: 404 });
    const company = companies[0];

    // Get CompanyToken
    const companyTokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id: intent.company_id });
    if (!companyTokens.length) {
      return Response.json({ error: 'Company token not configured' }, { status: 500 });
    }
    const activeToks = companyTokens.filter(t => t.is_active !== false && t.contract_address);
    const companyToken = activeToks.length > 0
      ? activeToks[activeToks.length - 1]
      : companyTokens[companyTokens.length - 1];

    // ✅ Single source of truth for network config — throws if misconfigured
    const chainConfig = resolveChainConfig(company, companyToken);
    const { rpcUrl, walletChain, explorerBase, networkName } = chainConfig;
    console.log(`🌐 Network: ${networkName} | RPC: ${rpcUrl}`);

    const provider = new ethers.JsonRpcProvider(rpcUrl);

    let treasuryPrivateKey = Deno.env.get('OWNER_PRIVATE_KEY');
    if (!treasuryPrivateKey) {
      return Response.json({ error: 'OWNER_PRIVATE_KEY not configured' }, { status: 500 });
    }
    if (!treasuryPrivateKey.startsWith('0x')) treasuryPrivateKey = `0x${treasuryPrivateKey}`;

    const treasuryWallet = new ethers.Wallet(treasuryPrivateKey, provider);
    console.log('✅ Treasury wallet:', treasuryWallet.address);

    // Check treasury DB balance
    if (companyToken.treasury_balance < intent.points) {
      return Response.json({
        error: 'Insufficient treasury balance',
        required: intent.points,
        available: companyToken.treasury_balance
      }, { status: 400 });
    }

    // Get token contract — MUST be company-specific, NO global fallback
    let tokenContractAddress = companyToken.contract_address;
    if (!tokenContractAddress) {
      console.error('🚫 No contract_address for company token', {
        company_id: intent.company_id,
        companyToken_id: companyToken.id,
        token_symbol: companyToken.token_symbol
      });
      await base44.asServiceRole.entities.RewardIntent.update(intent_id, {
        status: 'FAILED',
        error_message: 'Company token contract not deployed. Please complete blockchain setup.'
      });
      return Response.json({
        error: 'Company token contract not deployed. Please complete blockchain setup in the Admin panel.'
      }, { status: 500 });
    }

    // Remove legacy prefix if present
    if (tokenContractAddress.includes('$')) {
      tokenContractAddress = tokenContractAddress.split('$')[1];
    }
    console.log('✅ Token contract:', tokenContractAddress, '| Symbol:', companyToken.token_symbol);

    const tokenContract = new ethers.Contract(tokenContractAddress, ERC20_ABI, treasuryWallet);

    // Get decimals and convert amount
    const decimals = await tokenContract.decimals();
    const tokensToSend = intent.points;
    const amountInWei = ethers.parseUnits(tokensToSend.toString(), decimals);

    console.log('💱 Sending', tokensToSend, 'tokens to', user_wallet);

    // Check on-chain balance
    const onChainBalance = await tokenContract.balanceOf(treasuryWallet.address);
    console.log('📊 Treasury on-chain balance:', ethers.formatUnits(onChainBalance, decimals));
    if (onChainBalance < amountInWei) {
      return Response.json({
        error: 'Insufficient on-chain balance in treasury',
        required: ethers.formatUnits(amountInWei, decimals),
        available: ethers.formatUnits(onChainBalance, decimals)
      }, { status: 400 });
    }

    // Execute blockchain transaction
    const tx = await tokenContract.transfer(user_wallet, amountInWei);
    console.log('📤 Blockchain TX sent:', tx.hash);

    const receipt = await tx.wait();
    console.log('✅ Blockchain TX confirmed! Block:', receipt.blockNumber, 'Status:', receipt.status);

    // ✅ Receipt verification (ethers: status 1 = success, 0 = reverted)
    if (receipt.status !== 1) {
      console.error('❌ TX reverted on-chain! Hash:', receipt.hash);
      await base44.asServiceRole.entities.RewardIntent.update(intent_id, {
        status: 'FAILED',
        error_message: 'Transaction reverted on-chain',
        tx_hash: receipt.hash
      });
      return Response.json({
        error: 'Blockchain transaction reverted',
        tx_hash: receipt.hash,
        explorer_url: `${explorerBase}/${receipt.hash}`
      }, { status: 500 });
    }

    // Update treasury balance in database
    await base44.asServiceRole.entities.CompanyToken.update(companyToken.id, {
      treasury_balance: companyToken.treasury_balance - tokensToSend,
      distributed_tokens: (companyToken.distributed_tokens || 0) + tokensToSend
    });

    // Mark intent as claimed
    await base44.asServiceRole.entities.RewardIntent.update(intent_id, {
      status: 'CLAIMED',
      user_wallet,
      tx_hash: receipt.hash,
      claimed_at: new Date().toISOString()
    });

    // CRITICAL FIX: Phone normalization
    // Inlined from phoneUtils.ts (cannot import in Deno Deploy)
    const normalizePhone = (p) => {
      if (!p) return '';
      let n = p.trim().replace(/[\s\-\(\)]/g, '');
      if (!n.startsWith('+')) {
        n = n.startsWith('0') ? '+972' + n.substring(1) : '+' + n;
      }
      return n;
    };
    
    const normalizedPhone = normalizePhone(intent.client_phone);
    console.log(`📞 Phone normalization: "${intent.client_phone}" → "${normalizedPhone}"`);

    // Find or create client
    let clients = await base44.asServiceRole.entities.Client.filter({
      company_id: intent.company_id,
      phone: normalizedPhone
    });

    // CRITICAL FIX: Deterministic selection - always pick oldest client
    if (clients.length > 1) {
      console.warn(`⚠️ Found ${clients.length} clients with phone ${normalizedPhone} - using oldest`);
      clients.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    }

    let client;
    let balanceBefore;
    if (!clients[0]) {
      balanceBefore = 0;
      client = await base44.asServiceRole.entities.Client.create({
        company_id: intent.company_id,
        phone: normalizedPhone,  // Store normalized phone
        wallet_address: user_wallet,
        wallet_chain: walletChain,
        current_balance: tokensToSend,
        total_earned: tokensToSend,
        total_redeemed: 0,
        onchain_balance: tokensToSend,
        last_sync: new Date().toISOString()
      });
      console.log(`✅ Created new client: ${client.id}`);
    } else {
      client = clients[0];
      balanceBefore = client.current_balance || 0;
      await base44.asServiceRole.entities.Client.update(client.id, {
        wallet_address: user_wallet,
        wallet_chain: walletChain,
        current_balance: balanceBefore + tokensToSend,
        total_earned: (client.total_earned || 0) + tokensToSend,
        onchain_balance: (client.onchain_balance || 0) + tokensToSend,
        last_sync: new Date().toISOString()
      });
      console.log(`✅ Updated existing client: ${client.id}`);
    }

    // Create ledger event
    await base44.asServiceRole.entities.LedgerEvent.create({
      company_id: intent.company_id,
      client_id: client.id,
      type: 'earn',
      points: tokensToSend,
      balance_before: balanceBefore,
      balance_after: balanceBefore + tokensToSend,
      source: 'pos',
      description: `Claimed ${tokensToSend} tokens via gasless intent ${intent_id}`,
      metadata: {
        intent_id,
        tx_hash: receipt.hash,
        block_number: receipt.blockNumber,
        relayer: treasuryWallet.address,
        user_wallet,
        network: networkName
      }
    });

    // Create blockchain transfer record
    await base44.asServiceRole.entities.BlockchainTransfer.create({
      company_id: intent.company_id,
      client_id: client.id,
      from_address: treasuryWallet.address,
      to_address: user_wallet,
      chain: walletChain,
      amount: tokensToSend,
      tx_hash: receipt.hash,
      status: 'confirmed',
      block_number: receipt.blockNumber
    });

    // Send WhatsApp confirmation (non-blocking)
    try {
      const tokenSymbol = companyToken.token_symbol || 'tokens';
      await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
        phone: intent.client_phone,
        message: `✅ Tokens claimed!\n\n🎉 ${tokensToSend} ${tokenSymbol} have been successfully added to your wallet!\n\nThank you for choosing ${company.name}! 🙏`,
        company_id: intent.company_id
      });
    } catch (whatsappError) {
      console.error('❌ WhatsApp confirmation error:', whatsappError.message);
    }

    return Response.json({
      success: true,
      tx_hash: receipt.hash,
      tokens_claimed: tokensToSend,
      explorer_url: `${explorerBase}/${receipt.hash}`,
      user_wallet,
      treasury_address: treasuryWallet.address,
      network: networkName
    });

  } catch (error) {
    console.error('❌ Claim error:', error.message);

    // Release PROCESSING lock on error
    if (intent_id) {
      try {
        await (createClientFromRequest(req)).asServiceRole.entities.RewardIntent.update(intent_id, {
          status: 'FAILED',
          error_message: error.message
        });
      } catch (updateErr) {
        console.error('⚠️ Failed to release PROCESSING lock:', updateErr.message);
      }
    }

    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});