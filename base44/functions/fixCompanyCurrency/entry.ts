import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole;

  // Auth: service token only
  const serviceToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
  const requestToken = req.headers.get('X-Service-Token');
  if (!serviceToken || requestToken !== serviceToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const companies = await db.entities.Company.list();
  const fixed = [];
  const skipped = [];

  for (const company of companies) {
    if (!company.dashboard_currency && !company.currency) {
      await db.entities.Company.update(company.id, {
        pos_currency: company.pos_currency || 'ILS',
        dashboard_currency: 'ILS',
        currency: 'ILS',
        points_to_currency_ratio: company.points_to_currency_ratio || 10,
      });
      fixed.push(company.name);
    } else {
      skipped.push(company.name);
    }
  }

  return Response.json({
    success: true,
    fixed_count: fixed.length,
    fixed,
    skipped_count: skipped.length,
  });
});