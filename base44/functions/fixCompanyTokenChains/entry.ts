import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const tokens = await base44.asServiceRole.entities.CompanyToken.filter({});
  const results = [];
  for (const token of tokens) {
    if (!token.chain || token.chain === '') {
      await base44.asServiceRole.entities.CompanyToken.update(token.id, {
        chain: 'avalanche_fuji'
      });
      results.push({ symbol: token.token_symbol, updated: true });
    } else {
      results.push({ symbol: token.token_symbol, chain: token.chain, skipped: true });
    }
  }
  return Response.json({ total: tokens.length, results });
});