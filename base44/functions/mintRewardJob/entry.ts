import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const RETRY_BACKOFF = [
  1 * 60 * 1000,
  5 * 60 * 1000,
  30 * 60 * 1000,
  2 * 60 * 60 * 1000
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const base44 = createClientFromRequest(req);

    const _svcToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
    const _reqToken = req.headers.get('X-Service-Token');
    const _isSvcCall = !!(_svcToken && _reqToken === _svcToken);

    let user = null;
    try {
      user = await base44.auth.me();
      if (!_isSvcCall && user?.role !== 'admin' && user?.role !== 'super_admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch (e) {
      // Service role call
    }

    console.log('🔄 [mintRewardJob] Starting retry job...');

    const failedRewards = await base44.asServiceRole.entities.PendingReward.filter({ status: 'failed' });
    console.log(`📊 Found ${failedRewards.length} failed rewards to retry`);

    let successCount = 0;
    let permanentFailCount = 0;

    for (const reward of failedRewards) {
      if (reward.retry_count >= 4) {
        await base44.asServiceRole.entities.PendingReward.update(reward.id, {
          status: 'failed_permanent',
          error_message: 'Max retries exceeded (4)'
        });
        permanentFailCount++;
        console.warn(`⚠️ Reward ${reward.id} failed permanently after 4 retries`);
        continue;
      }

      const nextRetryTime = new Date(reward.last_retry_at || reward.created_date).getTime() + RETRY_BACKOFF[reward.retry_count || 0];
      if (Date.now() < nextRetryTime) {
        console.log(`⏳ Reward ${reward.id} not ready for retry yet`);
        continue;
      }

      try {
        console.log(`🔄 Retrying reward ${reward.id} (attempt ${(reward.retry_count || 0) + 1}/4)...`);

        await base44.asServiceRole.entities.PendingReward.update(reward.id, { status: 'processing' });

        const claimResult = await base44.asServiceRole.functions.invoke('claimRewardIntent', {
          intent_id: reward.id,
          user_wallet: reward.user_wallet,
          company_id: reward.company_id,
          points: reward.points,
          client_id: reward.client_id
        });

        if (!claimResult.data?.success) {
          throw new Error(claimResult.data?.error || 'Claim failed');
        }

        await base44.asServiceRole.entities.PendingReward.update(reward.id, {
          status: 'claimed',
          tx_hash: claimResult.data.tx_hash
        });

        successCount++;
        console.log(`✅ Reward ${reward.id} claimed: ${claimResult.data.tx_hash}`);

      } catch (error) {
        console.error(`❌ Retry failed for reward ${reward.id}:`, error.message);
        await base44.asServiceRole.entities.PendingReward.update(reward.id, {
          status: 'failed',
          retry_count: (reward.retry_count || 0) + 1,
          error_message: error.message,
          last_retry_at: new Date().toISOString()
        });
      }
    }

    console.log(`📊 Job complete: ${successCount} succeeded, ${permanentFailCount} permanent failures`);

    return Response.json({
      success: true,
      processed: failedRewards.length,
      succeeded: successCount,
      permanent_failures: permanentFailCount
    });

  } catch (error) {
    console.error('mintRewardJob error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});