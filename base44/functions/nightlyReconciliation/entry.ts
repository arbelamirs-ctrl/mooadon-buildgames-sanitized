import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { createPublicClient, http, formatUnits } from 'npm:viem@2.7.0';
import { avalancheFuji, avalanche } from 'npm:viem@2.7.0/chains';

const BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view'
  }
];

const DRIFT_THRESHOLD = 1;

function getChainConfigViem() {
  const network   = (Deno.env.get('AVAX_NETWORK') || 'fuji') === 'mainnet' ? 'mainnet' : 'fuji';
  const isMainnet = network === 'mainnet';
  const rpcUrl    = isMainnet
    ? (Deno.env.get('MAINNET_RPC_URL') || 'https://api.avax.network/ext/bc/C/rpc')
    : (Deno.env.get('FUJI_RPC_URL')    || 'https://api.avax-test.network/ext/bc/C/rpc');
  return {
    network, rpcUrl, isMainnet,
    chain: isMainnet ? avalanche : avalancheFuji,
  };
}

Deno.serve(async (req) => {
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const db     = base44.asServiceRole;

    try {
      const user = await base44.auth.me().catch(() => null);
      if (user && user.role !== 'admin' && user.role !== 'super_admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch (_) { /* service role — allowed */ }

    console.log('🔍 [reconciliation] Starting nightly reconciliation...');

    const chainCfg = getChainConfigViem();
    const publicClient = createPublicClient({
      chain: chainCfg.chain,
      transport: http(chainCfg.rpcUrl, { timeout: 15_000 })
    });

    const companies = await db.entities.Company.filter({ onchain_enabled: true });
    console.log(`📋 [reconciliation] ${companies.length} onchain-enabled companies`);

    if (companies.length === 0) {
      return Response.json({
        success: true,
        message: 'No onchain-enabled companies — nothing to reconcile',
        elapsed_ms: Date.now() - startTime
      });
    }

    const report = {
      checked:     0,
      matched:     0,
      drifted:     0,
      skipped:     0,
      errors:      0,
      drift_items: [],
    };

    for (const company of companies) {
      const tokens = await db.entities.CompanyToken.filter({ company_id: company.id });
      const activeTokens = tokens.filter(t => t.is_active !== false && t.contract_address);
      const companyToken  = activeTokens.length > 0 ? activeTokens[activeTokens.length - 1] : null;

      if (!companyToken?.contract_address) {
        console.log(`⏭ [reconciliation] ${company.name} — no contract_address, skipping`);
        report.skipped++;
        continue;
      }

      const contractAddress = companyToken.contract_address.includes('$')
        ? companyToken.contract_address.split('$')[1]
        : companyToken.contract_address;

      const clients = await db.entities.Client.filter({ company_id: company.id });
      const clientsWithWallet = clients.filter(c => c.wallet_address);

      console.log(`🏢 [reconciliation] ${company.name}: ${clientsWithWallet.length} clients with wallets`);

      for (const client of clientsWithWallet) {
        report.checked++;

        try {
          const onchainWei = await publicClient.readContract({
            address: contractAddress,
            abi: BALANCE_ABI,
            functionName: 'balanceOf',
            args: [client.wallet_address]
          });

          const onchainBalance = parseFloat(formatUnits(onchainWei, companyToken.decimals || 18));
          const dbBalance      = client.onchain_balance || client.current_balance || 0;
          const delta          = Math.abs(onchainBalance - dbBalance);

          if (delta > DRIFT_THRESHOLD) {
            report.drifted++;
            report.drift_items.push({
              company_id:      company.id,
              company_name:    company.name,
              client_id:       client.id,
              client_phone:    client.phone,
              wallet_address:  client.wallet_address,
              db_balance:      dbBalance,
              onchain_balance: onchainBalance,
              delta,
              direction:       onchainBalance > dbBalance ? 'onchain_higher' : 'db_higher',
            });

            await db.entities.Client.update(client.id, {
              onchain_balance: onchainBalance,
              last_sync: new Date().toISOString()
            });

            console.warn(`⚠️ [reconciliation] DRIFT: ${client.phone} | DB=${dbBalance} | onchain=${onchainBalance} | delta=${delta}`);
          } else {
            report.matched++;
            if (Math.abs(onchainBalance - (client.onchain_balance || 0)) > 0.001) {
              await db.entities.Client.update(client.id, {
                onchain_balance: onchainBalance,
                last_sync: new Date().toISOString()
              });
            }
          }

        } catch (clientErr) {
          report.errors++;
          console.error(`❌ [reconciliation] client ${client.id}:`, clientErr.message);
        }
      }
    }

    const elapsedMs = Date.now() - startTime;

    try {
      await db.entities.ReconciliationReport.create({
        run_at:      new Date().toISOString(),
        network:     chainCfg.network,
        checked:     report.checked,
        matched:     report.matched,
        drifted:     report.drifted,
        skipped:     report.skipped,
        errors:      report.errors,
        elapsed_ms:  elapsedMs,
        drift_items: report.drift_items,
        status:      report.drifted > 0 ? 'drift_detected' : 'clean',
      });
    } catch (saveErr) {
      console.error('⚠️ [reconciliation] Failed to save report (non-critical):', saveErr.message);
    }

    console.log(`✅ [reconciliation] Done: checked=${report.checked} matched=${report.matched} drifted=${report.drifted} errors=${report.errors} (${elapsedMs}ms)`);

    return Response.json({
      success:    true,
      network:    chainCfg.network,
      summary:    report,
      elapsed_ms: elapsedMs,
      status:     report.drifted > 0 ? 'drift_detected' : 'clean',
    });

  } catch (error) {
    console.error('[reconciliation] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});