import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Fix Companies: set onchain_network = 'fuji' where not already fuji
  const allCompanies = await base44.asServiceRole.entities.Company.list();
  const companiesToFix = allCompanies.filter(c => c.onchain_network !== 'fuji');
  console.log(`Companies to fix: ${companiesToFix.length}`);

  for (const c of companiesToFix) {
    await base44.asServiceRole.entities.Company.update(c.id, { onchain_network: 'fuji' });
    console.log(`Updated company ${c.name} (${c.id}): ${c.onchain_network || 'null'} → fuji`);
  }

  // Fix CompanyTokens: set chain = 'avalanche_fuji' where not already
  const allTokens = await base44.asServiceRole.entities.CompanyToken.list();
  const tokensToFix = allTokens.filter(t => t.chain !== 'avalanche_fuji');
  console.log(`Tokens to fix: ${tokensToFix.length}`);

  for (const t of tokensToFix) {
    await base44.asServiceRole.entities.CompanyToken.update(t.id, { chain: 'avalanche_fuji' });
    console.log(`Updated token ${t.token_symbol} (${t.id}): ${t.chain || 'null'} → avalanche_fuji`);
  }

  // Verify
  const verifyCompanies = await base44.asServiceRole.entities.Company.list();
  const verifyTokens = await base44.asServiceRole.entities.CompanyToken.list();

  const notFujiCompanies = verifyCompanies.filter(c => c.onchain_network !== 'fuji');
  const notFujiTokens = verifyTokens.filter(t => t.chain !== 'avalanche_fuji');

  return Response.json({
    success: true,
    companies_fixed: companiesToFix.length,
    tokens_fixed: tokensToFix.length,
    verification: {
      companies_not_fuji_remaining: notFujiCompanies.map(c => ({ id: c.id, name: c.name, onchain_network: c.onchain_network })),
      tokens_not_fuji_remaining: notFujiTokens.map(t => ({ id: t.id, symbol: t.token_symbol, chain: t.chain })),
      all_companies_on_fuji: notFujiCompanies.length === 0,
      all_tokens_on_fuji: notFujiTokens.length === 0,
    }
  });
});