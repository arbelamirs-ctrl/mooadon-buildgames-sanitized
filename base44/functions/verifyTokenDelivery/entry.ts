/**
 * verifyTokenDelivery - FIXED VERSION
 * 
 * Changes:
 * ✅ Replaced companyTokens[0] fallback with explicit validation
 * ✅ Better error messages when contract not deployed
 * ✅ Cleaner network detection logic
 * 
 * Check if a client actually received their tokens — DB + on-chain.
 *
 * Call with:
 *   { "client_phone": "+972501234567", "company_id": "xxx" }
 *   OR
 *   { "transaction_id": "xxx" }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { ethers } from 'npm:ethers@6.9.0';

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  try {
    const base44 = createClientFromRequest(req);
    
    const { client_phone, company_id, transaction_id } = await req.json();

    if (!transaction_id && (!client_phone || !company_id)) {
      return Response.json({
        error: 'Provide either transaction_id OR (client_phone + company_id)'
      }, { status: 400 });
    }

    // ── Mode 1: Check specific transaction ────────────────────────────────────
    if (transaction_id) {
      const txs = await base44.asServiceRole.entities.Transaction.filter({ id: transaction_id });
      if (!txs.length) return Response.json({ error: 'Transaction not found' }, { status: 404 });
      const tx = txs[0];

      const hasBlockchainTx = !!(tx.blockchain_tx_hash && tx.blockchain_tx_hash.trim() !== '');
      const isDelivered = tx.token_delivery_status === 'delivered';

      const companies = await base44.asServiceRole.entities.Company.filter({ id: tx.company_id });
      const company = companies[0];
      const isMainnet = company?.onchain_network === 'mainnet';
      const explorerBase = isMainnet ? 'https://snowtrace.io/tx' : 'https://testnet.snowtrace.io/tx';

      return Response.json({
        transaction_id: tx.id,
        status: tx.status,
        tokens_expected: tx.tokens_expected,
        tokens_actual: tx.tokens_actual,
        token_symbol: tx.token_symbol,
        token_delivery_status: tx.token_delivery_status || 'not_set',
        has_blockchain_tx: hasBlockchainTx,
        blockchain_tx_hash: tx.blockchain_tx_hash || null,
        explorer_url: hasBlockchainTx ? `${explorerBase}/${tx.blockchain_tx_hash}` : null,
        network: company?.onchain_network || 'fuji',
        verdict: hasBlockchainTx && isDelivered
          ? '✅ Tokens delivered on-chain'
          : hasBlockchainTx && !isDelivered
            ? '⚠️ TX exists but delivery_status not confirmed'
            : '❌ No blockchain TX — tokens NOT delivered on-chain'
      });
    }

    // ── Mode 2: Check client by phone ─────────────────────────────────────────
    const clients = await base44.asServiceRole.entities.Client.filter({ company_id, phone: client_phone });
    if (!clients.length) {
      return Response.json({ error: `Client not found: ${client_phone}` }, { status: 404 });
    }
    const client = clients[0];

    const allTxs = await base44.asServiceRole.entities.Transaction.filter({ company_id, client_id: client.id });
    const withBlockchain = allTxs.filter(t => t.blockchain_tx_hash && t.blockchain_tx_hash.trim() !== '');
    const withoutBlockchain = allTxs.filter(t => !t.blockchain_tx_hash || t.blockchain_tx_hash.trim() === '');

    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    const company = companies[0];
    const isMainnet = company?.onchain_network === 'mainnet';
    const rpcUrl = isMainnet
      ? (Deno.env.get('MAINNET_RPC_URL') || 'https://api.avax.network/ext/bc/C/rpc')
      : (Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc');
    const explorerBase = isMainnet ? 'https://snowtrace.io' : 'https://testnet.snowtrace.io';

    // ✅ FIX: Prefer active token, validate contract_address explicitly
    const companyTokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id });
    const activeToks = companyTokens.filter(t => t.is_active !== false && t.contract_address);
    const companyToken = activeToks.length > 0 
      ? activeToks[activeToks.length - 1] 
      : companyTokens[companyTokens.length - 1];

    let onchainBalance = null;
    let onchainError = null;

    // ✅ FIX: Explicit validation instead of assuming contract_address exists
    if (client.wallet_address && companyToken?.contract_address) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Clean contract address
        let cleanAddress = companyToken.contract_address;
        if (cleanAddress.includes('$')) {
          cleanAddress = cleanAddress.split('$')[1];
        }

        const tokenContract = new ethers.Contract(cleanAddress, ERC20_ABI, provider);
        const decimals = await tokenContract.decimals();
        const rawBalance = await tokenContract.balanceOf(client.wallet_address);
        onchainBalance = parseFloat(ethers.formatUnits(rawBalance, decimals));
      } catch (err) {
        onchainError = err.message;
      }
    } else if (!companyToken?.contract_address) {
      onchainError = `Company token not deployed. Token symbol: ${companyToken?.token_symbol || 'unknown'}. Please deploy contract before verifying delivery.`;
    }

    const dbBalance = client.current_balance || 0;
    const balanceMatch = onchainBalance !== null && Math.abs(onchainBalance - dbBalance) < 1;

    return Response.json({
      client: {
        id: client.id,
        phone: client.phone,
        wallet_address: client.wallet_address || null,
        wallet_explorer: client.wallet_address ? `${explorerBase}/address/${client.wallet_address}` : null,
        network: company?.onchain_network || 'fuji'
      },
      company_token: {
        symbol: companyToken?.token_symbol || 'unknown',
        contract_deployed: !!companyToken?.contract_address,
        contract_address: companyToken?.contract_address || null
      },
      balances: {
        db_balance: dbBalance,
        onchain_balance: onchainBalance,
        match: balanceMatch,
        discrepancy: onchainBalance !== null ? Math.abs(onchainBalance - dbBalance) : null,
        onchain_error: onchainError
      },
      transactions: {
        total: allTxs.length,
        with_blockchain_tx: withBlockchain.length,
        without_blockchain_tx: withoutBlockchain.length,
        missing_delivery: withoutBlockchain.map(t => ({
          id: t.id,
          tokens_expected: t.tokens_expected,
          token_symbol: t.token_symbol,
          created_date: t.created_date,
          token_delivery_status: t.token_delivery_status || 'not_set'
        }))
      },
      verdict: !client.wallet_address
        ? '❌ Client has no wallet — tokens cannot be delivered on-chain'
        : !companyToken?.contract_address
          ? '❌ Company token contract not deployed — cannot verify on-chain delivery'
          : onchainBalance === 0 && dbBalance > 0
            ? '❌ DB shows balance but on-chain is 0 — tokens NOT delivered'
            : balanceMatch
              ? '✅ DB and on-chain balances match'
              : `⚠️ Discrepancy: DB=${dbBalance}, On-chain=${onchainBalance}`
    });

  } catch (error) {
    console.error('❌ verifyTokenDelivery error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});