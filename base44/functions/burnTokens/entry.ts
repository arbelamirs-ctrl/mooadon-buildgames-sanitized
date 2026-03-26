import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { ethers } from 'npm:ethers@6.9.0';

const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

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
  console.log('🔥 burnTokens function started');
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // ── Admin-only check ────────────────────────────────────────────────────
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { clientId, amount } = await req.json();
    console.log('📋 Request:', { clientId, amount });

    if (!clientId || !amount || amount <= 0) {
      return Response.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
    }

    // Get client
    const client = await base44.asServiceRole.entities.Client.get(clientId);
    if (!client) {
      return Response.json({ success: false, error: 'Client not found' }, { status: 404 });
    }

    if (!client.wallet_address) {
      return Response.json({ 
        success: false, 
        error: 'Client does not have a wallet address' 
      }, { status: 400 });
    }

    // ✅ Verify admin user owns the client's company
    if (user.role !== 'super_admin') {
      const userPermissions = await base44.asServiceRole.entities.UserPermission.filter({
        user_id: user.id,
        company_id: client.company_id,
        is_active: true
      });
      
      if (userPermissions.length === 0) {
        return Response.json({ 
          success: false, 
          error: 'Forbidden: You do not have access to this client' 
        }, { status: 403 });
      }
    }

    // Check token balance
    const tokenBalance = client.tokenBalance || 0;
    if (tokenBalance < amount) {
      return Response.json({ 
        success: false, 
        error: `Insufficient token balance. Available: ${tokenBalance}` 
      }, { status: 400 });
    }

    // Get company
    const companies = await base44.asServiceRole.entities.Company.filter({ 
      id: client.company_id 
    });
    if (!companies || companies.length === 0) {
      return Response.json({
        success: false,
        error: 'Company not found'
      }, { status: 404 });
    }
    const company = companies[0];

    // ✅ FIX: Get company token with active-token-preferring logic (not just [0])
    const companyTokens = await base44.asServiceRole.entities.CompanyToken.filter({ 
      company_id: client.company_id 
    });
    
    if (!companyTokens || companyTokens.length === 0) {
      return Response.json({
        success: false,
        error: 'Company token not configured'
      }, { status: 400 });
    }
    
    // Prefer active token with contract_address, newest first
    const activeTokens = companyTokens.filter(t => t.is_active !== false && t.contract_address);
    const companyToken = activeTokens.length > 0
      ? activeTokens[activeTokens.length - 1]
      : companyTokens[companyTokens.length - 1];

    if (!companyToken.contract_address) {
      return Response.json({
        success: false,
        error: `Company token not deployed. Token symbol: ${companyToken.token_symbol}. Please deploy contract first.`
      }, { status: 500 });
    }

    console.log('✅ Company token:', companyToken.contract_address, '| Symbol:', companyToken.token_symbol);

    // ✅ FIX: Use resolveChainConfig instead of hard-coded RPC
    const chainConfig = resolveChainConfig(company, companyToken);
    const { rpcUrl, explorerBase, networkName } = chainConfig;
    console.log(`🌐 Network: ${networkName} | RPC: ${rpcUrl}`);

    // Setup blockchain connection
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const privateKey = Deno.env.get("OWNER_PRIVATE_KEY");
    
    if (!privateKey) {
      throw new Error('OWNER_PRIVATE_KEY not configured');
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Clean contract address if needed (remove legacy prefixes)
    let cleanAddress = companyToken.contract_address;
    if (cleanAddress.includes('$')) {
      cleanAddress = cleanAddress.split('$')[1];
    }

    const tokenContract = new ethers.Contract(
      cleanAddress,
      ERC20_ABI,
      wallet
    );

    // Get decimals and convert amount
    const decimals = await tokenContract.decimals();
    const amountInWei = ethers.parseUnits(amount.toString(), decimals);

    // Execute burn (transfer to dead address)
    console.log(`🔥 Burning ${amount} tokens from ${client.wallet_address}`);
    const tx = await tokenContract.transfer(BURN_ADDRESS, amountInWei);
    console.log('📤 Transaction sent:', tx.hash);
    
    const receipt = await tx.wait();
    console.log('✅ Burn confirmed! Block:', receipt.blockNumber);

    // Update client balances
    const newTokenBalance = tokenBalance - amount;
    await base44.asServiceRole.entities.Client.update(clientId, {
      tokenBalance: newTokenBalance,
      onchain_balance: (client.onchain_balance || 0) - amount,
      last_sync: new Date().toISOString(),
      last_activity: new Date().toISOString()
    });

    // Update company token supply
    await base44.asServiceRole.entities.CompanyToken.update(companyToken.id, {
      distributed_tokens: (companyToken.distributed_tokens || 0) - amount
    });

    // Create ledger event
    await base44.asServiceRole.entities.LedgerEvent.create({
      company_id: client.company_id,
      client_id: clientId,
      type: 'adjust',
      points: 0,
      balance_before: client.current_balance || 0,
      balance_after: client.current_balance || 0,
      source: 'system',
      description: `Burned ${amount} ${companyToken.token_symbol} tokens`,
      metadata: {
        tx_hash: receipt.hash,
        block_number: receipt.blockNumber,
        tokens_burned: amount,
        burn_address: BURN_ADDRESS,
        network: networkName
      }
    });

    // Create audit log
    await base44.asServiceRole.entities.AuditLog.create({
      company_id: client.company_id,
      action: 'burn_tokens',
      entity_type: 'Client',
      entity_id: clientId,
      performed_by: user.id,
      details: {
        tokensBurned: amount,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        newTokenBalance,
        burn_address: BURN_ADDRESS,
        network: networkName
      }
    });

    console.log('🎉 Token burn completed!');
    return Response.json({
      success: true,
      data: {
        tokensBurned: amount,
        newTokenBalance,
        transactionHash: receipt.hash,
        network: networkName,
        explorerUrl: `${explorerBase}/${receipt.hash}`
      }
    });

  } catch (error) {
    console.error('❌ Burn error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to burn tokens'
    }, { status: 500 });
  }
});