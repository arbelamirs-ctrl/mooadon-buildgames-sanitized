import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * cleanupStuckRewardQueue
 * 
 * Identifies and removes RewardQueue entries where:
 * 1. The referenced transaction_id no longer exists, OR
 * 2. retry_count >= max_retries (permanently stuck)
 * 
 * Modes:
 * - dry_run=true (default): Reports what would be deleted
 * - dry_run=false: Actually deletes the stuck records
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // default true

    console.log(`🔍 cleanupStuckRewardQueue started (dry_run: ${dryRun})`);

    // Get all failed/pending/processing records
    const [failedRecords, pendingRecords] = await Promise.all([
      base44.asServiceRole.entities.RewardQueue.filter({ status: 'failed' }),
      base44.asServiceRole.entities.RewardQueue.filter({ status: 'pending' }),
    ]);

    const allRecords = [...failedRecords, ...pendingRecords];
    console.log(`📋 Checking ${allRecords.length} records...`);

    const stuckByMaxRetries = failedRecords.filter(r => (r.retry_count || 0) >= (r.max_retries || 3));
    const stuckByMissingTx = [];

    // Check pending records for missing transactions
    for (const record of pendingRecords) {
      if (!record.transaction_id) continue;
      const txs = await base44.asServiceRole.entities.Transaction.filter({ id: record.transaction_id });
      if (!txs || txs.length === 0) {
        stuckByMissingTx.push(record);
      }
    }

    const allStuck = [
      ...stuckByMaxRetries.map(r => ({ ...r, reason: 'max_retries_exceeded' })),
      ...stuckByMissingTx.map(r => ({ ...r, reason: 'transaction_not_found' })),
    ];

    // Deduplicate by id
    const uniqueStuck = Object.values(
      allStuck.reduce((acc, r) => { acc[r.id] = r; return acc; }, {})
    );

    console.log(`🚨 Found ${uniqueStuck.length} stuck records`);

    let deletedCount = 0;
    const deletedIds = [];

    if (!dryRun && uniqueStuck.length > 0) {
      for (const record of uniqueStuck) {
        await base44.asServiceRole.entities.RewardQueue.delete(record.id);
        deletedIds.push(record.id);
        deletedCount++;
        console.log(`🗑️ Deleted stuck record ${record.id} (${record.reason})`);
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      total_checked: allRecords.length,
      stuck_found: uniqueStuck.length,
      deleted_count: deletedCount,
      deleted_ids: deletedIds,
      stuck_records: uniqueStuck.map(r => ({
        id: r.id,
        reason: r.reason,
        company_id: r.company_id,
        customer_id: r.customer_id,
        transaction_id: r.transaction_id,
        amount: r.amount,
        retry_count: r.retry_count,
        status: r.status,
        error_message: r.error_message,
      })),
      message: dryRun
        ? `Found ${uniqueStuck.length} stuck records. Set dry_run=false to delete them.`
        : `Deleted ${deletedCount} stuck RewardQueue records.`
    });

  } catch (error) {
    console.error('❌ cleanupStuckRewardQueue error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});