import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const supabase = base44.supabase;

    // Add the UNIQUE constraint
    const { error: constraintError } = await supabase.rpc('exec_sql', {
      query: `ALTER TABLE "Client" ADD CONSTRAINT unique_company_phone UNIQUE (company_id, phone)`
    });

    if (constraintError) {
      if (constraintError.message && constraintError.message.includes('already exists')) {
        return Response.json({
          success: true,
          message: 'Constraint already exists',
          constraint_name: 'unique_company_phone'
        });
      }
      throw constraintError;
    }

    return Response.json({
      success: true,
      message: 'Unique constraint added successfully!',
      constraint_name: 'unique_company_phone',
      table: 'Client',
      columns: ['company_id', 'phone']
    });

  } catch (error) {
    console.error('addPhoneConstraint error:', error);
    return Response.json({
      error: error.message,
      manual_sql: `ALTER TABLE "Client" ADD CONSTRAINT unique_company_phone UNIQUE (company_id, phone);`
    }, { status: 500 });
  }
});