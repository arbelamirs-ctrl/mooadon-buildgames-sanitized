import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { ethers } from 'npm:ethers@6.9.0';

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
    networkName: normalized,
    isMainnet,
    rpcUrl
  };
}
// ─────────────────────────────────────────────────────────────────────────────

// ── ERC20 ABI (minimal for transfer) ────────────────────────────────────────
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

// ── Utility Functions ──────────────────────────────────────────────────────
function normalizeAmount(amount) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num <= 0) throw new Error('Amount must be a positive number');
  return num;
}

function validateWalletAddress(address, chain) {
  if (chain === 'avalanche') {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
  return false;
}

function getMasterWallet() {
  const privateKey = Deno.env.get('OWNER_PRIVATE_KEY');
  if (!privateKey) throw new Error('OWNER_PRIVATE_KEY not configured');
  const wallet = new ethers.Wallet(privateKey);
  return { wallet, address: wallet.address };
}

function formatTokenAmount(amount, decimals) {
  return ethers.parseUnits(amount.toString(), decimals);
}

function errorResponse(code, message, status = 500) {
  return Response.json({ success: false, error_code: code, error: message }, { status });
}

// ── Main Function ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const base44 = createClientFromRequest(req);

    // Auth check — require either authenticated user or valid service token
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (e) {}

    if (!user) {
      const svcToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
      const reqToken = req.headers.get('X-Service-Token');
      if (!svcToken || reqToken !== svcToken) {
        return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);
      }
    }

    const body = await req.json();
    const { companyId, recipientAddress, amount, reason } = body;

    // Validate inputs
    if (!companyId || !recipientAddress || !amount) {
      return errorResponse('MISSING_FIELDS', 'Missing required fields: companyId, recipientAddress, amount', 400);
    }

    if (!validateWalletAddress(recipientAddress, 'avalanche')) {
      return errorResponse('INVALID_ADDRESS', 'Invalid recipient wallet address', 400);
    }

    const transferAmount = normalizeAmount(amount);

    console.log(`🔄 transferTokensOnChain: Company ${companyId}, Amount: ${transferAmount}, To: ${recipientAddress}`);

    // Get company token
    const companyTokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id: companyId });
    if (!companyTokens || companyTokens.length === 0) {
      return errorResponse('NO_TOKEN', 'Company token not configured', 404);
    }

    // ✅ FIX: Prefer active token, but throw explicit error if none have contract_address
    const activeTokens = companyTokens.filter(t => t.is_active !== false && t.contract_address);
    const companyToken = activeTokens.length > 0
      ? activeTokens[activeTokens.length - 1]
      : companyTokens[companyTokens.length - 1];

    // ✅ FIX: Explicit validation instead of silent fallback
    if (!companyToken.contract_address) {
      return errorResponse('NO_CONTRACT_DEPLOYED',
        `Company token not deployed. Token symbol: ${companyToken.token_symbol}. ` +
        `Please deploy the token contract before attempting transfers.`, 500);
    }

    console.log('✅ Using company token:', companyToken.token_symbol, '| Contract:', companyToken.contract_address);

    // Check treasury balance
    if (companyToken.treasury_balance < transferAmount) {
      return errorResponse('INSUFFICIENT_BALANCE',
        `Insufficient treasury balance. Required: ${transferAmount}, Available: ${companyToken.treasury_balance}`, 400);
    }

    // Get company details
    const companies = await base44.asServiceRole.entities.Company.filter({ id: companyId });
    if (!companies || companies.length === 0) {
      return errorResponse('NO_COMPANY', 'Company not found', 404);
    }
    const company = companies[0];

    // ✅ Use resolveChainConfig for dynamic network selection
    const chainConfig = resolveChainConfig(company, companyToken);
    const { networkName, isMainnet, rpcUrl } = chainConfig;
    console.log(`🌐 Network resolved: ${networkName}`);

    // Get provider and master wallet
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const { wallet: masterWallet, address: masterAddress } = getMasterWallet();
    const connectedWallet = masterWallet.connect(provider);

    const companyTreasuryAddress = company.blockchain_wallet_address || masterAddress;

    console.log('🔑 Master Wallet (pays gas):', masterAddress);
    console.log('💼 Company Treasury:', companyTreasuryAddress);

    // Get token contract address
    const tokenContractAddress = companyToken.contract_address;

    const cleanAddress = tokenContractAddress.includes('$')
      ? tokenContractAddress.split('$')[1]
      : tokenContractAddress;

    console.log('📄 Token Contract:', cleanAddress);

    // Create contract instance
    const tokenContract = new ethers.Contract(cleanAddress, ERC20_ABI, connectedWallet);

    // Get decimals
    const decimals = await tokenContract.decimals();
    console.log('💠 Token Decimals:', decimals);

    // Format transfer amount
    const formattedAmount = formatTokenAmount(transferAmount, decimals);
    console.log('💰 Formatted Amount:', ethers.formatUnits(formattedAmount, decimals));

    // Check sender balance
    const senderBalance = await tokenContract.balanceOf(masterAddress);
    console.log('📊 Sender Balance:', ethers.formatUnits(senderBalance, decimals));

    if (senderBalance < formattedAmount) {
      return errorResponse('INSUFFICIENT_SENDER_BALANCE',
        `Sender wallet has insufficient tokens. Has: ${ethers.formatUnits(senderBalance, decimals)}, Needs: ${transferAmount}`, 400);
    }

    // Execute transfer
    console.log('📤 Sending transaction...');
    const tx = await tokenContract.transfer(recipientAddress, formattedAmount);
    console.log('✅ TX sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();

    // ✅ Receipt verification
    if (receipt.status !== 1) {
      console.error('❌ TX reverted on-chain! Hash:', tx.hash);
      return errorResponse('TX_REVERTED',
        `Transaction reverted on-chain. Hash: ${tx.hash}`, 500);
    }

    console.log('✅ TX confirmed! Block:', receipt.blockNumber);

    const explorerBase = isMainnet ? 'https://snowtrace.io' : 'https://testnet.snowtrace.io';
    const explorerUrl = `${explorerBase}/tx/${tx.hash}`;

    // Update treasury balance
    const newBalance = companyToken.treasury_balance - transferAmount;
    await base44.asServiceRole.entities.CompanyToken.update(companyToken.id, {
      treasury_balance: newBalance,
      last_sync: new Date().toISOString()
    });

    console.log('💰 Updated treasury balance:', newBalance);

    // Audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        company_id: companyId,
        action: 'token_transfer',
        entity_type: 'CompanyToken',
        entity_id: companyToken.id,
        user_id: user?.id,
        details: {
          amount: transferAmount,
          recipient: recipientAddress,
          tx_hash: tx.hash,
          block_number: receipt.blockNumber,
          reason: reason || 'manual_transfer',
          network: networkName,
          phase: 2
        }
      });
    } catch (auditError) {
      console.warn('Audit log failed (non-blocking):', auditError.message);
    }

    return Response.json({
      success: true,
      tx_hash: tx.hash,
      block_number: receipt.blockNumber,
      explorer_url: explorerUrl,
      amount: transferAmount,
      token_symbol: companyToken.token_symbol,
      new_treasury_balance: newBalance,
      network: networkName
    });

  } catch (error) {
    console.error('transferTokensOnChain error:', error.message, error.stack);
    return errorResponse('TRANSFER_FAILED', error.message, 500);
  }
});