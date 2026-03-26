import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all companies sorted by creation date (oldest first)
    const allCompanies = await base44.asServiceRole.entities.Company.list('created_date', 1000);

    // Find the highest existing CUST- number
    const existingNumbers = allCompanies
      .map(c => c.client_number)
      .filter(n => n && n.startsWith('CUST-'))
      .map(n => parseInt(n.replace('CUST-', ''), 10))
      .filter(n => !isNaN(n));

    let nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

    // Assign numbers only to companies that don't have one yet
    const companiesWithoutNumber = allCompanies.filter(c => !c.client_number);

    for (const company of companiesWithoutNumber) {
      const clientNumber = `CUST-${String(nextNumber).padStart(6, '0')}`;
      await base44.asServiceRole.entities.Company.update(company.id, { client_number: clientNumber });
      console.log(`Assigned ${clientNumber} to ${company.name}`);
      nextNumber++;
    }

    return Response.json({
      success: true,
      assigned: companiesWithoutNumber.length,
      message: `Assigned client numbers to ${companiesWithoutNumber.length} companies`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});