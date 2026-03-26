import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const companies = await base44.asServiceRole.entities.Company.filter({});
    const tokens = await base44.asServiceRole.entities.CompanyToken.filter({});

    const result = companies.map(c => {
      const token = tokens.find(t => t.company_id === c.id);
      return {
        name: c.name,
        id: c.id,
        onchain_enabled: c.onchain_enabled ?? false,
        onchain_network: c.onchain_network ?? 'not set',
        token_symbol: token?.token_symbol ?? 'none',
        contract_address: token?.contract_address ?? 'none',
        token_chain: token?.chain ?? 'not set',
      };
    });

    const mainnet = result.filter(c => c.onchain_network === 'mainnet' || c.onchain_network === 'avalanche');
    const testnet = result.filter(c => c.onchain_network !== 'mainnet' && c.onchain_network !== 'avalanche');

    return Response.json({
      total: result.length,
      on_mainnet: mainnet.length,
      on_testnet_or_unset: testnet.length,
      mainnet_companies: mainnet,
      testnet_companies: testnet,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});