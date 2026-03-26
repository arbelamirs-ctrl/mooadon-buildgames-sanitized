/**
 * adminDeployToken.js
 * Admin wrapper to redeploy dead contracts for specific companies
 * Uses INTERNAL_SERVICE_TOKEN to call generateCompanyTokens
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { company_ids } = body;

  const results = [];

  for (const company_id of company_ids) {
    try {
      console.log(`Deploying token for company ${company_id}...`);
      const data = await base44.asServiceRole.functions.invoke('generateCompanyTokens', {
        company_id,
        force_redeploy: true,
      });
      console.log(`Result for ${company_id}:`, JSON.stringify(data));
      results.push({ company_id, ...(data?.data || data) });
    } catch (err) {
      results.push({ company_id, error: err.message });
    }
  }

  return Response.json({ results });
});