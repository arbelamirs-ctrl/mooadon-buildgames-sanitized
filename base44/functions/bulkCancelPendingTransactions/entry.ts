import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch ALL pending transactions across all companies
    const pendingTransactions = await base44.asServiceRole.entities.Transaction.filter(
      { status: 'pending' }
    );

    console.log(`🔄 Found ${pendingTransactions.length} pending transactions to cancel`);

    if (pendingTransactions.length === 0) {
      return Response.json({ 
        success: true,
        cancelled_count: 0,
        message: 'No pending transactions to cancel'
      });
    }

    // Delete all stalled pending transactions
    const deletePromises = pendingTransactions.map(tx =>
      base44.asServiceRole.entities.Transaction.delete(tx.id).catch(err => {
        console.error(`Failed to delete ${tx.id}:`, err);
        return null;
      })
    );

    await Promise.all(deletePromises);

    console.log(`✅ Successfully deleted ${pendingTransactions.length} stalled transactions`);

    return Response.json({ 
      success: true,
      deleted_count: pendingTransactions.length,
      message: `Deleted ${pendingTransactions.length} stalled pending transactions across all companies`
    });
  } catch (error) {
    console.error('❌ Bulk cancel error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});