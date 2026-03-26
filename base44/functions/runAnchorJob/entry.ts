import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * runAnchorJob
 * Called by schedulerWatchdog — finds all ReceiptBatches with status='ready'
 * and anchors them on-chain via anchorBatchOnchain.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const _svcToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
    const _reqToken = req.headers.get('X-Service-Token');
    const _isSvcCall = !!(_svcToken && _reqToken === _svcToken);

    const user = await base44.auth.me().catch(() => null);
    // Allow: direct service token, admin user, or any authenticated service-role SDK call
    if (!_isSvcCall && !user) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('[runAnchorJob] Starting...');

    const readyBatches = await base44.asServiceRole.entities.ReceiptBatch.filter({ status: 'ready' });
    console.log(`[runAnchorJob] Found ${readyBatches.length} ready batches`);

    let anchored = 0;
    let failed = 0;
    const errors = [];

    for (const batch of readyBatches) {
      try {
        const result = await base44.asServiceRole.functions.invoke('anchorBatchOnchain', {
          batch_id: batch.id
        });

        if (result.data?.success) {
          anchored++;
          console.log(`[runAnchorJob] Anchored batch ${batch.id}: ${result.data.tx_hash}`);
        } else {
          throw new Error(result.data?.error || 'anchorBatchOnchain returned non-success');
        }
      } catch (err) {
        failed++;
        errors.push({ batch_id: batch.id, error: err.message });
        console.error(`[runAnchorJob] Failed batch ${batch.id}:`, err.message);
      }
    }

    return Response.json({
      success: true,
      total: readyBatches.length,
      anchored,
      failed,
      errors
    });

  } catch (error) {
    console.error('[runAnchorJob] Fatal error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});