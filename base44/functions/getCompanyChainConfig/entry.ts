/**
 * getCompanyChainConfig
 * Single source of truth for resolving a company's blockchain network config.
 * This is a standalone diagnostic HTTP endpoint.
 *
 * NOTE: The resolveChainConfig logic is INLINED into each consumer function
 * because Deno deploy functions cannot import from sibling files.
 * Keep this file and the inlined copies in sync.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { createPublicClient, http } from 'npm:viem@2.7.0';
import { avalancheFuji, avalanche } from 'npm:viem@2.7.0/chains';

/**
 * Normalize various network string representations to canonical form.
 * "fuji" | "avalanche_fuji" | "avax_fuji" | "testnet" → "fuji"
 * "mainnet" | "avalanche" | "avax" | "avax_mainnet"   → "mainnet"
 */
function normalizeNetwork(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s === 'fuji' || s === 'avalanche_fuji' || s === 'avax_fuji' || s === 'testnet') return 'fuji';
  if (s === 'mainnet' || s === 'avalanche' || s === 'avax' || s === 'avax_mainnet') return 'mainnet';
  return s;
}

/**
 * Resolves chain config from company + companyToken records.
 * Throws if the network cannot be determined or is invalid.
 */
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
    throw new Error(
      `Invalid network "${raw}" for company "${company?.name || company?.id}". ` +
      `Must be "fuji" or "mainnet".`
    );
  }

  const isMainnet = normalized === 'mainnet';
  const rpcUrl = isMainnet
    ? (Deno.env.get('MAINNET_RPC_URL') || 'https://api.avax.network/ext/bc/C/rpc')
    : (Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc');

  return {
    chain: isMainnet ? avalanche : avalancheFuji,
    rpcUrl,
    walletChain: isMainnet ? 'avalanche' : 'avalanche_fuji',
    isMainnet,
    networkName: normalized,
    explorerBase: isMainnet
      ? 'https://snowtrace.io/tx'
      : 'https://testnet.snowtrace.io/tx',
  };
}

// ── Diagnostic HTTP endpoint ──────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { company_id } = body;

    if (!company_id) {
      return Response.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    const company = companies[0];
    if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });

    const tokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id });
    const companyToken = tokens[0] || null;

    let config;
    try {
      config = resolveChainConfig(company, companyToken);
    } catch (err) {
      return Response.json({
        error: err.message,
        raw: { onchain_network: company.onchain_network, chain: companyToken?.chain }
      }, { status: 422 });
    }

    return Response.json({
      success: true,
      company_name: company.name,
      raw_onchain_network: company.onchain_network,
      raw_token_chain: companyToken?.chain,
      resolved: {
        networkName: config.networkName,
        isMainnet: config.isMainnet,
        walletChain: config.walletChain,
        rpcUrl: config.rpcUrl,
        explorerBase: config.explorerBase,
      }
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});