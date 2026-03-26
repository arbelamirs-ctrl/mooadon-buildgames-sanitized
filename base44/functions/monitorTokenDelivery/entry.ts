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
    rpcUrl,
    explorerBase: isMainnet ? 'https://snowtrace.io/tx' : 'https://testnet.snowtrace.io/tx'
  };
}
// ─────────────────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

const STALE_MINUTES = 30;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  try {
    const base44 = createClientFromRequest(req);

    // Auth: allow service-role token OR admin
    const svcToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
    const reqToken = req.headers.get('X-Service-Token');
    const isSvcCall = !!(svcToken && reqToken === svcToken);

    if (!isSvcCall) {
      let user = null;
      try { user = await base44.auth.me(); } catch (_) {}
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return Response.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    console.log('🔍 [monitorTokenDelivery] Starting scan...');

    const cutoffTime = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();

    const allTransactions = await base44.asServiceRole.entities.Transaction.filter({
      status: 'pending'
    });

    const staleTransactions = allTransactions.filter(tx =>
      tx.created_date < cutoffTime && tx.token_delivery_status !== 'delivered'
    );

    if (staleTransactions.length === 0) {
      console.log('✅ No stale transactions found');
      return Response.json({ success: true, stale_count: 0, message: 'No stale transactions' });
    }

    console.log(`⚠️ Found ${staleTransactions.length} stale transactions`);

    const results = [];

    for (const tx of staleTransactions) {
      try {
        console.log(`🔄 Processing transaction ${tx.id}...`);

        const companies = await base44.asServiceRole.entities.Company.filter({ id: tx.company_id });
        if (companies.length === 0) {
          console.warn(`Company not found for transaction ${tx.id}`);
          continue;
        }
        const company = companies[0];

        const companyTokens = await base44.asServiceRole.entities.CompanyToken.filter({
          company_id: tx.company_id
        });
        if (companyTokens.length === 0) {
          console.warn(`No company token for transaction ${tx.id}`);
          continue;
        }

        const activeToks = companyTokens.filter(t => t.is_active !== false && t.contract_address);
        const companyToken = activeToks.length > 0
          ? activeToks[activeToks.length - 1]
          : companyTokens[companyTokens.length - 1];

        if (!companyToken.contract_address) {
          console.warn(`No contract_address for company token`);
          continue;
        }

        // ✅ PHASE 2 FIX: Use resolveChainConfig
        const chainConfig = resolveChainConfig(company, companyToken);
        const { networkName, rpcUrl, explorerBase } = chainConfig;
        console.log(`🌐 Network: ${networkName}`);

        let privateKey = Deno.env.get('GAS_WALLET_PRIVATE_KEY');
        if (!privateKey) throw new Error('GAS_WALLET_PRIVATE_KEY not configured');
        if (!privateKey.startsWith('0x')) privateKey = `0x${privateKey}`;

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);
        const tokenContract = new ethers.Contract(companyToken.contract_address, ERC20_ABI, wallet);

        const decimals = await tokenContract.decimals();
        const tokensToSend = tx.tokens_actual;
        const amountInWei = ethers.parseUnits(tokensToSend.toString(), decimals);

        const clients = await base44.asServiceRole.entities.Client.filter({
          company_id: tx.company_id,
          phone: tx.client_phone
        });
        if (clients.length === 0) {
          console.warn(`Client not found for transaction ${tx.id}`);
          continue;
        }
        const client = clients[0];

        if (!client.wallet_address) {
          console.warn(`Client ${client.id} has no wallet_address`);
          continue;
        }

        // Send tokens
        const txResponse = await tokenContract.transfer(client.wallet_address, amountInWei);
        console.log(`📤 TX sent: ${txResponse.hash}`);

        const receipt = await txResponse.wait();

        // ✅ Receipt verification
        if (receipt.status !== 1) {
          console.error(`❌ TX reverted: ${txResponse.hash}`);
          await base44.asServiceRole.entities.Transaction.update(tx.id, {
            status: 'failed',
            token_delivery_status: 'failed',
            metadata: { monitor_retry: true, error: 'tx_reverted', tx_hash: txResponse.hash }
          });
          results.push({ tx_id: tx.id, status: 'failed', reason: 'tx_reverted' });
          continue;
        }

        console.log(`✅ TX confirmed: Block ${receipt.blockNumber}`);

        await base44.asServiceRole.entities.Transaction.update(tx.id, {
          status: 'completed',
          blockchain_tx_hash: txResponse.hash,
          blockchain_confirmed_at: new Date().toISOString(),
          token_delivery_status: 'delivered',
          network: networkName
        });

        await base44.asServiceRole.entities.Client.update(client.id, {
          current_balance: (client.current_balance || 0) + tokensToSend,
          total_earned: (client.total_earned || 0) + tokensToSend,
          onchain_balance: (client.onchain_balance || 0) + tokensToSend,
          last_sync: new Date().toISOString()
        });

        results.push({
          tx_id: tx.id,
          status: 'delivered',
          tx_hash: txResponse.hash,
          block: receipt.blockNumber,
          explorer_url: `${explorerBase}/${txResponse.hash}`
        });

      } catch (error) {
        console.error(`Failed to process transaction ${tx.id}:`, error.message);
        results.push({ tx_id: tx.id, status: 'error', error: error.message });
      }
    }

    console.log('✅ Monitoring complete');
    return Response.json({
      success: true,
      stale_count: staleTransactions.length,
      processed: results.length,
      results
    });

  } catch (error) {
    console.error('monitorTokenDelivery error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});