/**
 * getChainConfig.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for Avalanche network configuration.
 * Import this in any backend function instead of duplicating RPC/chain logic.
 *
 * Usage (viem style — createPOSTransaction etc.):
 *   import { getChainConfigViem, requireGasWalletKey, toReferenceId } from './getChainConfig.js';
 *   const { chain, rpcUrl, explorerUrl, network } = getChainConfigViem();
 *
 * Usage (ethers.js / generic):
 *   import { getChainConfig } from './getChainConfig.js';
 *   const { rpcUrl, chainId, explorerUrl, network } = getChainConfig();
 */

import { avalancheFuji, avalanche } from 'npm:viem@2.7.0/chains';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Shared resolution ─────────────────────────────────────────────────────────

function resolveNetwork() {
  const env = Deno.env.get('AVAX_NETWORK') || 'fuji';
  return env === 'mainnet' ? 'mainnet' : 'fuji';
}

function resolveRpcUrl(network) {
  if (network === 'mainnet') {
    return Deno.env.get('MAINNET_RPC_URL') || 'https://api.avax.network/ext/bc/C/rpc';
  }
  return Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc';
}

// ── ethers.js compatible config ───────────────────────────────────────────────

export function getChainConfig(overrideNetwork) {
  const network   = overrideNetwork ? (overrideNetwork === 'mainnet' || overrideNetwork === 'avalanche' ? 'mainnet' : 'fuji') : resolveNetwork();
  const rpcUrl    = resolveRpcUrl(network);
  const isMainnet = network === 'mainnet';

  return {
    network,
    rpcUrl,
    isMainnet,
    chainId:      isMainnet ? 43114 : 43113,
    walletChain:  isMainnet ? 'avalanche' : 'avalanche_fuji',
    explorerUrl:  isMainnet ? 'https://snowtrace.io'       : 'https://testnet.snowtrace.io',
    explorerTx:   isMainnet ? 'https://snowtrace.io/tx/'   : 'https://testnet.snowtrace.io/tx/',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
  };
}

// ── viem compatible config ────────────────────────────────────────────────────

export function getChainConfigViem(overrideNetwork) {
  const base  = getChainConfig(overrideNetwork);
  const chain = base.isMainnet ? avalanche : avalancheFuji;
  return { ...base, chain };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build explorer URL for a tx hash */
export function txExplorerUrl(hash) {
  return `${getChainConfig().explorerTx}${hash}`;
}

/** Build explorer URL for an address */
export function addressExplorerUrl(address) {
  return `${getChainConfig().explorerUrl}/address/${address}`;
}

/** Hard-fail if gas wallet private key is missing */
export function requireGasWalletKey() {
  let key = Deno.env.get('GAS_WALLET_PRIVATE_KEY');
  if (!key) throw new Error('Missing GAS_WALLET_PRIVATE_KEY — set this secret in Base44 Settings.');
  if (!key.startsWith('0x')) key = `0x${key}`;
  return key;
}

/** SHA-256 of a string → bytes32 hex — for referenceId in smart contract calls */
export async function toReferenceId(value) {
  const encoded    = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  const hex        = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `0x${hex}`;
}

// ── HTTP endpoint (callable from frontend via base44.functions.invoke) ────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user   = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const config = getChainConfig();
    return Response.json({
      network:     config.network,
      chainId:     config.chainId,
      explorerUrl: config.explorerUrl,
      isMainnet:   config.isMainnet,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});