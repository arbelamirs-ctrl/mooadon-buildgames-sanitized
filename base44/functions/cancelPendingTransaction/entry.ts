import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transaction_id } = await req.json();

    if (!transaction_id) {
      return Response.json({ error: 'Missing transaction_id' }, { status: 400 });
    }

    // Fetch the transaction
    const txns = await base44.entities.Transaction.filter({ id: transaction_id });
    if (!txns || txns.length === 0) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const txn = txns[0];

    // Verify user has permission to cancel (company_id must match)
    if (txn.company_id !== user.company_id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow cancelling pending transactions
    if (txn.status !== 'pending') {
      return Response.json({ 
        error: `Cannot cancel transaction with status: ${txn.status}` 
      }, { status: 400 });
    }

    // Update transaction status to cancelled
    await base44.entities.Transaction.update(transaction_id, {
      status: 'cancelled'
    });

    console.log(`✅ Transaction ${transaction_id} cancelled by ${user.email}`);

    return Response.json({ 
      success: true, 
      message: 'Transaction cancelled successfully' 
    });
  } catch (error) {
    console.error('❌ Cancel transaction error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});