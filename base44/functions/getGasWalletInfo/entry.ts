import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';
import { createPublicClient, http, formatEther } from 'npm:viem@2.7.0';
import { avalancheFuji, avalanche } from 'npm:viem@2.7.0/chains';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Thresholds ────────────────────────────────────────────────────────────────
const THRESHOLD_CRITICAL = 0.05;  // hard block — transactions will fail
const THRESHOLD_WARNING  = 0.15;  // warn — fund soon

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let privateKey = Deno.env.get('GAS_WALLET_PRIVATE_KEY');
    if (!privateKey) {
      return Response.json({ error: 'GAS_WALLET_PRIVATE_KEY not set' }, { status: 500 });
    }
    if (!privateKey.startsWith('0x')) privateKey = `0x${privateKey}`;

    const account = privateKeyToAccount(privateKey);

    const network = Deno.env.get('AVAX_NETWORK') || 'fuji';
    const isMainnet = network === 'mainnet';

    const rpcUrl = isMainnet
      ? (Deno.env.get('MAINNET_RPC_URL') || 'https://api.avax.network/ext/bc/C/rpc')
      : (Deno.env.get('FUJI_RPC_URL')    || 'https://api.avax-test.network/ext/bc/C/rpc');

    const chain = isMainnet ? avalanche : avalancheFuji;

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl, { timeout: 10_000 })
    });

    let balanceWei = 0n;
    let balanceAvax = '0';
    let fetchError = null;

    try {
      balanceWei  = await publicClient.getBalance({ address: account.address });
      balanceAvax = parseFloat(formatEther(balanceWei)).toFixed(6);
    } catch (e) {
      fetchError  = e.message;
      balanceAvax = '0';
    }

    const balanceNum = parseFloat(balanceAvax);

    let health, healthMessage;

    if (fetchError) {
      health        = 'error';
      healthMessage = `Failed to fetch balance: ${fetchError}`;
    } else if (balanceNum < THRESHOLD_CRITICAL) {
      health        = 'critical';
      healthMessage = `CRITICAL: ${balanceAvax} AVAX — transactions will be blocked. Fund immediately.`;
    } else if (balanceNum < THRESHOLD_WARNING) {
      health        = 'warning';
      healthMessage = `WARNING: ${balanceAvax} AVAX — fund soon to avoid disruption.`;
    } else {
      health        = 'ok';
      healthMessage = `OK: ${balanceAvax} AVAX available.`;
    }

    const explorerUrl = isMainnet
      ? `https://snowtrace.io/address/${account.address}`
      : `https://testnet.snowtrace.io/address/${account.address}`;

    return Response.json({
      address:            account.address,
      balance_avax:       balanceAvax,
      balance_wei:        balanceWei.toString(),
      network:            isMainnet ? 'mainnet' : 'fuji',
      health,
      health_message:     healthMessage,
      threshold_warning:  THRESHOLD_WARNING,
      threshold_critical: THRESHOLD_CRITICAL,
      can_transact:       health !== 'critical' && health !== 'error',
      snowtrace_url:      explorerUrl,
      checked_at:         new Date().toISOString(),
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});