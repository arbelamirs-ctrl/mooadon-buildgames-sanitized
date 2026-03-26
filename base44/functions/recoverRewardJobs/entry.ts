/**
 * recoverRewardJobs.js
 * Deletes 11 exhausted failed RewardQueue jobs and creates 3 clean deduplicated recovery jobs.
 * Uses service role to bypass RLS.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const OLD_JOB_IDS = [
  '69bfcb8b9dd8c814cb58f7c4',
  '69bfcb8a95980dcdcecab168',
  '69bfcb83d3a7518cc1fc6b6e',
  '69bfcb82ee574508a49b996a',
  '69bfcb7f6cb197f057eaa6cb',
  '69bfc764ab1c070d28495dd8',
  '69bfc763fb45b8fd259b1d96',
  '69bfc740e3574ad4756f665c',
  '69bfc58273a259f5a73d090c',
  '69bfc58169aaa13370380b1b',
  '69bfc581fc076416f12916aa',
];

const NEW_JOBS = [
  {
    customer_id: '699ea5acc692429203d28a08',
    company_id: '699ea5709de7911baf78c822',
    branch_id: '699eb32cc4f81abd21a540bc',
    reward_type: 'tokens',
    amount: 40,
    status: 'pending',
    retry_count: 0,
    max_retries: 3,
    transaction_id: 'recovery-ryl-' + Date.now(),
    metadata: { note: 'Deduplicated recovery - 2 failed Mar-22 jobs (40 RYL)' }
  },
  {
    customer_id: '699c105f039afa8812f58897',
    company_id: '699c0fcc39be6fed84f0bfe3',
    branch_id: '699c0fcff21b08b02f3118a3',
    reward_type: 'tokens',
    amount: 60,
    status: 'pending',
    retry_count: 0,
    max_retries: 3,
    transaction_id: 'recovery-dmd-' + Date.now(),
    metadata: { note: 'Deduplicated recovery - 3 failed Mar-22 jobs (60 DMD)' }
  },
  {
    customer_id: '69a151bd3d221564aea9a9bd',
    company_id: '699c3f84f1834f4fe65cd16c',
    branch_id: '69a151a6070d806a37e7819e',
    reward_type: 'tokens',
    amount: 60,
    status: 'pending',
    retry_count: 0,
    max_retries: 3,
    transaction_id: 'recovery-myb-' + Date.now(),
    metadata: { note: 'Deduplicated recovery - 6 failed Mar-22 jobs (1x10 + 1x50 = 60 MYB)' }
  },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || (user.role !== 'admin' && user.collaborator_role !== 'editor' && user.collaborator_role !== 'owner')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const deleted = [];
    const deleteErrors = [];
    for (const id of OLD_JOB_IDS) {
      try {
        await base44.asServiceRole.entities.RewardQueue.delete(id);
        deleted.push(id);
        console.log(`✅ Deleted job ${id}`);
      } catch (e) {
        deleteErrors.push({ id, error: e.message });
        console.warn(`⚠️ Could not delete ${id}: ${e.message}`);
      }
    }

    const created = [];
    for (const job of NEW_JOBS) {
      const record = await base44.asServiceRole.entities.RewardQueue.create(job);
      created.push({ id: record.id, customer_id: job.customer_id, amount: job.amount, company_id: job.company_id });
      console.log(`✅ Created recovery job ${record.id} — ${job.amount} tokens for customer ${job.customer_id}`);
    }

    return Response.json({
      success: true,
      deleted_count: deleted.length,
      delete_errors: deleteErrors,
      created_jobs: created,
    });

  } catch (error) {
    console.error('recoverRewardJobs error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});