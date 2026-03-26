import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * createRecoveryRewardQueue
 * Creates RewardQueue entries for transactions that completed in DB
 * but never had tokens sent on-chain (blockchain_tx_hash = null).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body2 = await req.clone().json().catch(() => ({}));

    const entries = [
      // My Business (MYB) - 699c3f84f1834f4fe65cd16c
      { transaction_id: '69a56b5c3dbd0612d83a95b6', customer_id: '69a151bd3d221564aea9a9bd', company_id: '699c3f84f1834f4fe65cd16c', amount: 500 },
      { transaction_id: '69a556907ce363a0f818486d', customer_id: '69a151bd3d221564aea9a9bd', company_id: '699c3f84f1834f4fe65cd16c', amount: 500 },
      { transaction_id: '69a19a04f25b92a8d281fa65', customer_id: '69a151bd3d221564aea9a9bd', company_id: '699c3f84f1834f4fe65cd16c', amount: 850 },
      // Royal Time (RYL) - 699ea5709de7911baf78c822
      { transaction_id: '69a5491a19cb027c60a86b80', customer_id: '699ea5acc692429203d28a08', company_id: '699ea5709de7911baf78c822', amount: 555 },
      { transaction_id: '69a546a6602580343b06c23e', customer_id: '699ea5acc692429203d28a08', company_id: '699ea5709de7911baf78c822', amount: 500 },
      { transaction_id: '699f915d93d994ff1b5bb034', customer_id: '699ea5acc692429203d28a08', company_id: '699ea5709de7911baf78c822', amount: 8200 },
      // Diamond Bourse (DMD) - 699c0fcc39be6fed84f0bfe3
      { transaction_id: '699dc6f943b101e37eb6d056', customer_id: '699c105f039afa8812f58897', company_id: '699c0fcc39be6fed84f0bfe3', amount: 50000 },
      { transaction_id: '699d7c6dc5837cfbcf3ad4dd', customer_id: '699c105f039afa8812f58897', company_id: '699c0fcc39be6fed84f0bfe3', amount: 100 },
      { transaction_id: '699c1d206d17417e8a44d554', customer_id: '699c1d1d72c8f4f3b5caf72d', company_id: '699c0fcc39be6fed84f0bfe3', amount: 50 },
      { transaction_id: '699c106139f793723920c532', customer_id: '699c105f039afa8812f58897', company_id: '699c0fcc39be6fed84f0bfe3', amount: 50 },
    ];

    const body = body2;
    const dryRun = body.dry_run === true;

    const created = [];
    const skipped = [];

    for (const entry of entries) {
      // Check if a RewardQueue entry already exists for this transaction to avoid duplicates
      const existing = await base44.asServiceRole.entities.RewardQueue.filter({
        transaction_id: entry.transaction_id
      });

      if (existing && existing.length > 0) {
        skipped.push({ transaction_id: entry.transaction_id, reason: 'already_exists', existing_status: existing[0].status });
        console.log(`⏭️ Skipping ${entry.transaction_id} — already has ${existing.length} RewardQueue entry/entries`);
        continue;
      }

      if (!dryRun) {
        const record = await base44.asServiceRole.entities.RewardQueue.create({
          transaction_id: entry.transaction_id,
          customer_id: entry.customer_id,
          company_id: entry.company_id,
          reward_type: 'tokens',
          amount: entry.amount,
          status: 'pending',
          retry_count: 0,
          max_retries: 3,
          metadata: {
            recovery: true,
            original_tx_id: entry.transaction_id,
            note: 'manual recovery - completed tx with no blockchain_tx_hash'
          }
        });
        created.push({ transaction_id: entry.transaction_id, queue_id: record.id, amount: entry.amount, company_id: entry.company_id });
        console.log(`✅ Created RewardQueue entry ${record.id} for tx ${entry.transaction_id} (${entry.amount} tokens)`);
      } else {
        created.push({ transaction_id: entry.transaction_id, amount: entry.amount, company_id: entry.company_id, dry_run: true });
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      total_entries: entries.length,
      created_count: created.length,
      skipped_count: skipped.length,
      created,
      skipped,
      message: dryRun
        ? `Dry run: would create ${created.length} RewardQueue entries, skip ${skipped.length}`
        : `Created ${created.length} RewardQueue entries, skipped ${skipped.length} duplicates`
    });

  } catch (error) {
    console.error('❌ createRecoveryRewardQueue error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});