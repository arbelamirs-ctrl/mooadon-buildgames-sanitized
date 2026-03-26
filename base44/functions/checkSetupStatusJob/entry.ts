import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only check
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all companies
    const companies = await base44.asServiceRole.entities.Company.list();
    const updates = [];

    for (const company of companies) {
      // Check setup requirements
      const hasWallet = !!company.blockchain_wallet_address;
      const hasToken = !!company.token_contract;
      const hasFunding = company.gas_wallet_funded === true;
      const isComplete = company.blockchain_setup_complete === true;

      // Determine setup_status
      let newStatus = 'active'; // Default to active

      if (!hasWallet || !hasToken || !hasFunding || !isComplete) {
        // Check if already marked as needing repair
        if (company.setup_status === 'needs_repair') {
          newStatus = 'needs_repair';
        } else if (!hasWallet || !hasToken || !hasFunding) {
          // Missing required setup
          newStatus = 'ready_partial';
        } else {
          newStatus = 'needs_repair';
        }
      }

      // Update if status changed
      if (newStatus !== company.setup_status) {
        await base44.asServiceRole.entities.Company.update(company.id, { setup_status: newStatus });
        updates.push({
          company_id: company.id,
          company_name: company.name,
          old_status: company.setup_status,
          new_status: newStatus,
          missing: {
            wallet: !hasWallet,
            token: !hasToken,
            funding: !hasFunding,
            complete: !isComplete
          }
        });
      }
    }

    return Response.json({ 
      success: true,
      companies_checked: companies.length,
      companies_updated: updates.length,
      updates 
    });
  } catch (error) {
    console.error('Setup status check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});