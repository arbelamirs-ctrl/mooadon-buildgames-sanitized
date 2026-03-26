import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔍 Checking all CompanyTokens for missing contract_address...');

    const [allTokens, allCompanies] = await Promise.all([
      base44.asServiceRole.entities.CompanyToken.list(),
      base44.asServiceRole.entities.Company.list()
    ]);

    const companyMap = new Map(allCompanies.map(c => [c.id, c]));

    const valid = [];
    const missing_contract = [];
    const inactive = [];

    for (const token of allTokens) {
      const company = companyMap.get(token.company_id);
      const companyName = company?.name || 'Unknown';

      if (token.is_active === false) {
        inactive.push({ company_id: token.company_id, company_name: companyName, token_symbol: token.token_symbol, id: token.id });
        continue;
      }

      if (!token.contract_address) {
        missing_contract.push({
          company_id: token.company_id,
          company_name: companyName,
          token_symbol: token.token_symbol,
          token_name: token.token_name,
          id: token.id,
          created_date: token.created_date
        });
        console.log(`❌ MISSING: ${companyName} (${token.token_symbol}) - NO contract_address!`);
      } else {
        valid.push({ company_id: token.company_id, company_name: companyName, token_symbol: token.token_symbol, contract_address: token.contract_address });
        console.log(`✅ OK: ${companyName} (${token.token_symbol}) - ${token.contract_address}`);
      }
    }

    console.log(`\n📊 Summary: total=${allTokens.length} valid=${valid.length} missing=${missing_contract.length} inactive=${inactive.length}`);

    return Response.json({
      success: true,
      summary: {
        total: allTokens.length,
        valid: valid.length,
        missing_contract: missing_contract.length,
        inactive: inactive.length
      },
      missing_contract_tokens: missing_contract,
      valid_tokens: valid,
      message: missing_contract.length > 0
        ? `⚠️ Found ${missing_contract.length} tokens without contract_address! Run deployCompanyToken for each.`
        : '✅ All active tokens have contract_address configured.'
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});