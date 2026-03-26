/**
 * enableOnchainForAllCompanies
 * ONE-TIME script — sets onchain_enabled=true + onchain_network=fuji on all companies
 * Skips companies already on mainnet or already configured correctly.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  try {
    const base44 = createClientFromRequest(req);

    const companies = await base44.asServiceRole.entities.Company.filter({});
    console.log(`Found ${companies.length} companies`);

    const results = [];

    for (const company of companies) {
      if (company.onchain_network === 'mainnet') {
        results.push({ name: company.name, action: 'skipped', reason: 'already mainnet' });
        continue;
      }

      if (company.onchain_enabled === true && company.onchain_network === 'fuji') {
        results.push({ name: company.name, action: 'skipped', reason: 'already fuji+enabled' });
        continue;
      }

      await base44.asServiceRole.entities.Company.update(company.id, {
        onchain_enabled: true,
        onchain_network: 'fuji'
      });

      results.push({ name: company.name, action: 'updated', onchain_enabled: true, onchain_network: 'fuji' });
      console.log(`✅ Updated: ${company.name}`);
    }

    const updated = results.filter(r => r.action === 'updated').length;
    const skipped = results.filter(r => r.action === 'skipped').length;

    return Response.json({ success: true, total: companies.length, updated, skipped, results });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});