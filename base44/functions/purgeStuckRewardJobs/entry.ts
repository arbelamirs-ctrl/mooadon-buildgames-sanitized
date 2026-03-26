import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const STUCK_JOB_IDS = [
  '69bfc581477d571ca29ed7fa',
  '69bfc58131109e93c2978fc5',
  '69bfc580ab1c070d28495c4f',
  '69bfc34ccc20ba6b580ca541',
  '69bfc25b309b8098d49f6ea9',
  '69bfc25938b6bbf7483a5d1d',
  '69bfc22b6b4ef02a024e37e9',
  '69bfa3043fbd3bf311a2ebbc',
  '69bfa18b2d7940129068520d',
  '69bf8f5354630bf7ef6d868d',
  '69bf8e4c2ccd1b445856d83a',
  '69bf86c517bdc5b13b647c99',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin' && user.collaborator_role !== 'editor' && user.collaborator_role !== 'owner') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Also fetch any remaining failed jobs with retry_count >= max_retries
    const failedJobs = await base44.asServiceRole.entities.RewardQueue.filter({ status: 'failed' });
    const stuckIds = new Set(STUCK_JOB_IDS);
    failedJobs.forEach(j => {
      if ((j.retry_count || 0) >= (j.max_retries || 3)) stuckIds.add(j.id);
    });

    const deleted = [];
    const errors = [];
    for (const id of stuckIds) {
      try {
        await base44.asServiceRole.entities.RewardQueue.delete(id);
        deleted.push(id);
        console.log(`✅ Deleted stuck job: ${id}`);
      } catch (e) {
        errors.push({ id, error: e.message });
        console.warn(`⚠️ Could not delete ${id}: ${e.message}`);
      }
    }

    return Response.json({ success: true, deleted_count: deleted.length, deleted, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});