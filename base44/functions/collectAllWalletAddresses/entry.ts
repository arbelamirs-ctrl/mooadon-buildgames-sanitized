/**
 * collectAllWalletAddresses
 * 
 * Returns all wallet addresses in the system that need gas funding
 * Includes: Client wallets, Company treasury wallets, Gas wallet
 * 
 * Call: base44.functions.invoke('collectAllWalletAddresses', {})
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { ethers } from 'npm:ethers@6.9.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const fujiProvider = new ethers.JsonRpcProvider(
      Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc'
    );
    
    const mainnetProvider = new ethers.JsonRpcProvider(
      Deno.env.get('MAINNET_RPC_URL') || 'https://api.avax.network/ext/bc/C/rpc'
    );

    // Collect all client wallets
    const allClients = await base44.asServiceRole.entities.Client.list('-created_date', 1000);
    const clientWallets = allClients
      .filter(c => c.wallet_address && c.wallet_address.match(/^0x[a-fA-F0-9]{40}$/))
      .map(c => ({
        type: 'client',
        address: c.wallet_address,
        owner: `${c.full_name || 'Unknown'} (${c.phone})`,
        company_id: c.company_id,
        balance_avax: null
      }));

    // Collect all company treasury wallets
    const allCompanies = await base44.asServiceRole.entities.Company.list('-created_date', 1000);
    const companyWallets = allCompanies
      .filter(c => c.blockchain_wallet_address && c.blockchain_wallet_address.match(/^0x[a-fA-F0-9]{40}$/))
      .map(c => ({
        type: 'company_treasury',
        address: c.blockchain_wallet_address,
        owner: c.name,
        company_id: c.id,
        network: c.onchain_network || 'fuji',
        balance_avax: null
      }));

    // Get gas wallet
    const gasPrivateKey = Deno.env.get('GAS_WALLET_PRIVATE_KEY');
    const gasWallet = gasPrivateKey ? new ethers.Wallet(gasPrivateKey).address : null;

    const gasWalletObj = gasWallet ? [{
      type: 'gas_wallet',
      address: gasWallet,
      owner: 'Gas Wallet (pays for transactions)',
      balance_avax: null
    }] : [];

    // Get owner wallet
    const ownerAddress = Deno.env.get('OWNER_WALLET_ADDRESS');
    const ownerWalletObj = ownerAddress ? [{
      type: 'owner_wallet',
      address: ownerAddress,
      owner: 'Owner Wallet',
      balance_avax: null
    }] : [];

    // Combine all and deduplicate
    const allWallets = [...clientWallets, ...companyWallets, ...gasWalletObj, ...ownerWalletObj];
    const uniqueWallets = Array.from(new Map(allWallets.map(w => [w.address.toLowerCase(), w])).values());

    // Fetch AVAX balances in parallel
    const withBalances = await Promise.all(
      uniqueWallets.map(async (wallet) => {
        try {
          // Try Fuji first
          const balance = await fujiProvider.getBalance(wallet.address);
          const avaxAmount = parseFloat(ethers.formatUnits(balance, 18));
          return { ...wallet, balance_avax: avaxAmount, network: 'fuji' };
        } catch {
          try {
            // Try mainnet
            const balance = await mainnetProvider.getBalance(wallet.address);
            const avaxAmount = parseFloat(ethers.formatUnits(balance, 18));
            return { ...wallet, balance_avax: avaxAmount, network: 'mainnet' };
          } catch {
            return { ...wallet, balance_avax: 0, network: 'unknown', error: 'Could not fetch balance' };
          }
        }
      })
    );

    // Sort by balance (lowest first — needs funding first)
    withBalances.sort((a, b) => (a.balance_avax || 0) - (b.balance_avax || 0));

    // Statistics
    const needsFunding = withBalances.filter(w => (w.balance_avax || 0) < 0.5);
    const totalBalance = withBalances.reduce((sum, w) => sum + (w.balance_avax || 0), 0);

    return Response.json({
      summary: {
        total_unique_wallets: uniqueWallets.length,
        wallets_needing_funding: needsFunding.length,
        total_avax_balance: totalBalance.toFixed(4),
        client_wallets: clientWallets.length,
        company_wallets: companyWallets.length,
        gas_wallet_configured: !!gasWallet,
        owner_wallet_configured: !!ownerAddress
      },
      wallets_by_balance: withBalances.map(w => ({
        address: w.address,
        type: w.type,
        owner: w.owner,
        company_id: w.company_id,
        balance_avax: w.balance_avax,
        network: w.network,
        needs_funding: (w.balance_avax || 0) < 0.5,
        error: w.error
      })),
      funding_instructions: {
        step1: 'Copy addresses with balance_avax < 0.5',
        step2: 'Use any AVAX faucet or send from your main wallet',
        step3: 'Recommended minimum: 2-5 AVAX per address',
        step4: 'Verify with: https://testnet.snowtrace.io/ (Fuji) or https://snowtrace.io/ (mainnet)'
      },
      csv_export: withBalances
        .map(w => `${w.address},${w.type},${w.owner || 'N/A'},${w.balance_avax || 0},${w.network}`)
        .join('\n')
    });

  } catch (error) {
    console.error('collectAllWalletAddresses error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});