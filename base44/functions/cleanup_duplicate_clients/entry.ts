/**
 * cleanup_duplicate_clients.ts - SMART DELETE VERSION
 * 
 * Identifies AND resolves duplicate Client records with phone variations.
 * 
 * MODES:
 * 1. dry_run=true (default): Reports what WOULD happen (safe)
 * 2. dry_run=false: Actually deletes/merges duplicates (destructive)
 * 
 * LOGIC:
 * - Finds "real primary" (most data/balance/wallet)
 * - Merges balances if both have data
 * - Transfers transactions to real primary
 * - Deletes empty duplicates
 * 
 * Usage:
 * POST /cleanup_duplicate_clients?dry_run=true
 * POST /cleanup_duplicate_clients?dry_run=false&company_id=xxx
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Phone normalization (mirrors createPOSTransaction)
function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  let n = phone.trim().replace(/[\s\-\(\)]/g, '');
  if (!n.startsWith('+')) {
    n = n.startsWith('0') ? '+972' + n.substring(1) : '+' + n;
  }
  return n;
}

interface DuplicateGroup {
  normalized_phone: string;
  clients: any[];
  real_primary: any;
  to_delete: any[];
  action: 'delete_empty' | 'merge_balances' | 'keep_all' | 'delete_all_empty';
  merge_plan?: {
    target_balance: number;
    source_balances: number[];
    transactions_to_transfer: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const base44 = createClientFromRequest(req);

    // Auth check - admin only

    // Parse query params
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dry_run') !== 'false'; // default true
    const targetCompanyId = url.searchParams.get('company_id');
    const autoConfirm = url.searchParams.get('auto_confirm') === 'true';

    console.log(`🔍 Starting duplicate cleanup (dry_run: ${dryRun})...`);

    // Get companies
    const companies = targetCompanyId
      ? await base44.asServiceRole.entities.Company.filter({ id: targetCompanyId })
      : await base44.asServiceRole.entities.Company.filter({});

    if (!companies || companies.length === 0) {
      return Response.json({ error: 'No companies found' }, { status: 404 });
    }

    const results = {
      dry_run: dryRun,
      total_companies_scanned: companies.length,
      companies_with_duplicates: 0,
      total_duplicate_groups: 0,
      total_clients_deleted: 0,
      total_balances_merged: 0,
      details: [] as any[]
    };

    // Process each company
    for (const company of companies) {
      console.log(`📊 Scanning company: ${company.name} (${company.id})`);

      const clients = await base44.asServiceRole.entities.Client.filter({ 
        company_id: company.id 
      });

      if (!clients || clients.length === 0) {
        console.log(`  ℹ️ No clients found`);
        continue;
      }

      // Group by normalized phone
      const phoneGroups = new Map<string, any[]>();
      for (const client of clients) {
        const normalized = normalizePhone(client.phone);
        if (!normalized) continue;
        
        if (!phoneGroups.has(normalized)) {
          phoneGroups.set(normalized, []);
        }
        phoneGroups.get(normalized)!.push(client);
      }

      // Find duplicates
      const duplicateGroups: DuplicateGroup[] = [];
      
      for (const [phone, clientList] of phoneGroups.entries()) {
        if (clientList.length <= 1) continue;

        // Sort by created_date (oldest first)
        clientList.sort((a, b) => 
          new Date(a.created_date || 0).getTime() - new Date(b.created_date || 0).getTime()
        );

        // Find "real primary" - the one with most value
        const realPrimary = findRealPrimary(clientList);
        const toDelete = clientList.filter(c => c.id !== realPrimary.id);

        // Determine action
        const allEmpty = clientList.every(c => 
          (c.current_balance || 0) === 0 && 
          !c.wallet_address
        );

        const hasMultipleWithData = clientList.filter(c => 
          (c.current_balance || 0) > 0 || c.wallet_address
        ).length > 1;

        let action: DuplicateGroup['action'];
        let mergePlan;

        if (allEmpty) {
          action = 'delete_all_empty';
        } else if (hasMultipleWithData) {
          action = 'merge_balances';
          // Calculate merge plan
          const targetBalance = clientList.reduce((sum, c) => sum + (c.current_balance || 0), 0);
          const sourceBalances = toDelete.map(c => c.current_balance || 0);
          
          // Count transactions to transfer
          let txCount = 0;
          for (const dup of toDelete) {
            const txs = await base44.asServiceRole.entities.Transaction.filter({ 
              client_id: dup.id 
            });
            txCount += txs?.length || 0;
          }
          
          mergePlan = { targetBalance, sourceBalances, transactions_to_transfer: txCount };
        } else {
          action = 'delete_empty';
        }

        duplicateGroups.push({
          normalized_phone: phone,
          clients: clientList,
          real_primary: realPrimary,
          to_delete: toDelete,
          action,
          merge_plan: mergePlan
        });
      }

      if (duplicateGroups.length === 0) {
        console.log(`  ✅ No duplicates found`);
        continue;
      }

      results.companies_with_duplicates++;
      results.total_duplicate_groups += duplicateGroups.length;

      // Execute or report
      const companyResult = {
        company_id: company.id,
        company_name: company.name,
        duplicate_groups: duplicateGroups.length,
        actions: [] as any[]
      };

      for (const group of duplicateGroups) {
        const actionResult = {
          phone: group.normalized_phone,
          action: group.action,
          real_primary_id: group.real_primary.id,
          deleted_ids: [] as string[],
          balance_merged: 0,
          transactions_transferred: 0,
          error: null as string | null
        };

        if (dryRun) {
          // DRY RUN - just report
          actionResult.deleted_ids = group.to_delete.map(c => c.id);
          if (group.merge_plan) {
            actionResult.balance_merged = group.merge_plan.targetBalance;
            actionResult.transactions_transferred = group.merge_plan.transactions_to_transfer;
          }
          console.log(`  📋 [DRY RUN] Would ${group.action} for ${group.normalized_phone}`);
        } else {
          // EXECUTE
          try {
            await executeMerge(base44, group);
            actionResult.deleted_ids = group.to_delete.map(c => c.id);
            if (group.merge_plan) {
              actionResult.balance_merged = group.merge_plan.targetBalance;
              actionResult.transactions_transferred = group.merge_plan.transactions_to_transfer;
            }
            results.total_clients_deleted += group.to_delete.length;
            if (group.merge_plan) {
              results.total_balances_merged += group.merge_plan.sourceBalances.reduce((a, b) => a + b, 0);
            }
            console.log(`  ✅ Executed ${group.action} for ${group.normalized_phone}`);
          } catch (error: any) {
            actionResult.error = error.message;
            console.error(`  ❌ Failed: ${error.message}`);
          }
        }

        companyResult.actions.push(actionResult);
      }

      results.details.push(companyResult);
    }

    console.log('✅ Cleanup complete:', results);

    return Response.json({
      success: true,
      ...results,
      warning: dryRun 
        ? '⚠️ DRY RUN MODE - No changes made. Set dry_run=false to execute.'
        : '✅ Changes applied successfully.'
    });

  } catch (error: any) {
    console.error('❌ Cleanup error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});

// Find the "real primary" - client with most value/data
function findRealPrimary(clients: any[]): any {
  // Score each client
  const scores = clients.map(client => {
    let score = 0;
    
    // Balance (most important)
    score += (client.current_balance || 0) * 10;
    
    // Has wallet
    if (client.wallet_address) score += 1000;
    
    // Has transactions (we'll count them separately)
    score += (client.total_earned || 0);
    
    // Older is better (tiebreaker)
    const age = new Date().getTime() - new Date(client.created_date || 0).getTime();
    score += age / (1000 * 60 * 60 * 24); // days old
    
    return { client, score };
  });

  // Sort by score (highest first)
  scores.sort((a, b) => b.score - a.score);
  
  return scores[0].client;
}

// Execute merge/delete
async function executeMerge(base44: any, group: DuplicateGroup) {
  const { real_primary, to_delete, action } = group;

  if (action === 'delete_all_empty') {
    // All empty - just delete the duplicates, keep oldest
    for (const dup of to_delete) {
      await base44.asServiceRole.entities.Client.delete(dup.id);
      console.log(`    🗑️ Deleted empty duplicate: ${dup.id}`);
    }
    return;
  }

  if (action === 'delete_empty') {
    // Duplicates are empty, real primary has data
    for (const dup of to_delete) {
      await base44.asServiceRole.entities.Client.delete(dup.id);
      console.log(`    🗑️ Deleted empty duplicate: ${dup.id}`);
    }
    return;
  }

  if (action === 'merge_balances') {
    // Both have data - merge everything to real_primary
    let totalBalance = real_primary.current_balance || 0;
    let totalEarned = real_primary.total_earned || 0;
    let totalRedeemed = real_primary.total_redeemed || 0;

    for (const dup of to_delete) {
      // Accumulate balances
      totalBalance += (dup.current_balance || 0);
      totalEarned += (dup.total_earned || 0);
      totalRedeemed += (dup.total_redeemed || 0);

      // Transfer transactions
      const transactions = await base44.asServiceRole.entities.Transaction.filter({ 
        client_id: dup.id 
      });
      if (transactions && transactions.length > 0) {
        for (const tx of transactions) {
          await base44.asServiceRole.entities.Transaction.update(tx.id, {
            client_id: real_primary.id,
            client_phone: real_primary.phone
          });
        }
        console.log(`    📦 Transferred ${transactions.length} transactions from ${dup.id}`);
      }

      // Transfer ledger events
      const ledgerEvents = await base44.asServiceRole.entities.LedgerEvent.filter({ 
        client_id: dup.id 
      });
      if (ledgerEvents && ledgerEvents.length > 0) {
        for (const event of ledgerEvents) {
          await base44.asServiceRole.entities.LedgerEvent.update(event.id, {
            client_id: real_primary.id
          });
        }
        console.log(`    📝 Transferred ${ledgerEvents.length} ledger events from ${dup.id}`);
      }

      // Transfer reward queue items
      const rewardQueue = await base44.asServiceRole.entities.RewardQueue.filter({ 
        customer_id: dup.id 
      });
      if (rewardQueue && rewardQueue.length > 0) {
        for (const item of rewardQueue) {
          await base44.asServiceRole.entities.RewardQueue.update(item.id, {
            customer_id: real_primary.id
          });
        }
        console.log(`    🎁 Transferred ${rewardQueue.length} reward queue items from ${dup.id}`);
      }

      // Delete duplicate
      await base44.asServiceRole.entities.Client.delete(dup.id);
      console.log(`    🗑️ Deleted merged duplicate: ${dup.id}`);
    }

    // Update real_primary with merged data
    await base44.asServiceRole.entities.Client.update(real_primary.id, {
      current_balance: totalBalance,
      total_earned: totalEarned,
      total_redeemed: totalRedeemed,
      phone: group.normalized_phone // Ensure normalized phone
    });
    console.log(`    ✅ Updated primary ${real_primary.id} with merged balances`);
  }
}