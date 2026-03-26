/**
 * diagnozeDMDPending.js
 * 
 * Diagnostic function to identify why DMD pending transactions remain stuck.
 * 
 * Returns detailed state for each pending/failed RewardQueue job:
 * - RewardQueue details (status, retry_count, error)
 * - Transaction details (amount, tokens, hash)
 * - Company/Token config
 * - Blockchain state (balances, contract)
 * - Exact blocker for each job
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { ethers } from 'npm:ethers@6.13.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('🔍 Starting DMD pending diagnostics...');

    // Find DMD company
    const companies = await base44.asServiceRole.entities.Company.list();
    const dmdCompany = companies.find(c => c.name?.toLowerCase().includes('dmd'));

    if (!dmdCompany) {
      return Response.json({
        error: 'DMD company not found',
        companies_found: companies.map(c => ({ id: c.id, name: c.name }))
      }, { status: 404 });
    }

    const dmdCompanyId = dmdCompany.id;
    console.log(`✅ Found DMD company: ${dmdCompany.name} (${dmdCompanyId})`);

    // Get all pending/failed RewardQueue jobs for DMD
    const allQueues = await base44.asServiceRole.entities.RewardQueue.list('-created_date', 100);
    const dmdQueues = allQueues.filter(q => 
      q.company_id === dmdCompanyId && 
      (q.status === 'pending' || q.status === 'processing' || q.status === 'failed')
    );

    console.log(`📋 Found ${dmdQueues.length} pending/processing/failed DMD jobs`);

    if (dmdQueues.length === 0) {
      return Response.json({
        success: true,
        message: 'No pending DMD jobs found',
        company_id: dmdCompanyId,
        company_name: dmdCompany.name
      });
    }

    // Get CompanyToken for DMD
    const tokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id: dmdCompanyId });
    const activeToken = tokens.find(t => t.is_primary) || tokens[0];

    if (!activeToken) {
      return Response.json({
        error: 'No active CompanyToken found for DMD',
        company_id: dmdCompanyId
      }, { status: 500 });
    }

    console.log(`🔑 Active token: ${activeToken.token_symbol} at ${activeToken.contract_address}`);

    // Setup blockchain
    const rpcUrl = dmdCompany.onchain_network === 'mainnet' 
      ? Deno.env.get('MAINNET_RPC_URL') || 'https://api.avax.network/ext/bc/C/rpc'
      : Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc';

    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Determine sender wallet
    const senderKey = Deno.env.get('GAS_WALLET_PRIVATE_KEY') || Deno.env.get('OWNER_PRIVATE_KEY');
    const senderWallet = senderKey ? new ethers.Wallet(senderKey, provider) : null;
    const senderAddress = senderWallet?.address;

    console.log(`👛 Sender wallet: ${senderAddress}`);

    // Diagnose each job
    const diagnostics = [];

    for (const queue of dmdQueues) {
      console.log(`\n🔍 Analyzing job ${queue.id}...`);

      try {
        // Fetch transaction
        const txns = await base44.asServiceRole.entities.Transaction.filter({ id: queue.transaction_id });
        const transaction = txns[0];

        if (!transaction) {
          diagnostics.push({
            rewardqueue_id: queue.id,
            transaction_id: queue.transaction_id,
            blocker: 'TRANSACTION_NOT_FOUND',
            details: 'Referenced transaction does not exist',
            status: queue.status,
            retry_count: queue.retry_count,
            error: queue.error_message
          });
          continue;
        }

        // Check sender balance
        let senderAvaxBalance = 'unknown';
        let senderTokenBalance = 'unknown';
        let senderBalanceBlocker = null;

        if (senderWallet) {
          try {
            const balance = await provider.getBalance(senderAddress);
            senderAvaxBalance = ethers.formatEther(balance);
            
            if (parseFloat(senderAvaxBalance) < 0.01) {
              senderBalanceBlocker = `INSUFFICIENT_AVAX: ${senderAvaxBalance} (need ≥0.01)`;
            }
          } catch (e) {
            senderBalanceBlocker = `BALANCE_CHECK_FAILED: ${e.message}`;
          }

          // Check token balance
          try {
            const tokenContract = new ethers.Contract(
              activeToken.contract_address,
              ['function balanceOf(address) view returns (uint256)'],
              provider
            );
            const tokenBal = await tokenContract.balanceOf(senderAddress);
            senderTokenBalance = ethers.formatUnits(tokenBal, 18);
          } catch (e) {
            senderTokenBalance = `ERROR: ${e.message}`;
          }
        }

        // Determine blocker
        let blocker = 'UNKNOWN';
        let details = {};

        if (!senderWallet) {
          blocker = 'NO_SENDER_KEY';
          details = { reason: 'GAS_WALLET_PRIVATE_KEY or OWNER_PRIVATE_KEY not set' };
        } else if (senderBalanceBlocker) {
          blocker = senderBalanceBlocker;
          details = { 
            sender_avax_balance: senderAvaxBalance,
            sender_token_balance: senderTokenBalance
          };
        } else if (queue.status === 'failed' && queue.retry_count >= queue.max_retries) {
          blocker = 'MAX_RETRIES_EXCEEDED';
          details = {
            retry_count: queue.retry_count,
            max_retries: queue.max_retries,
            last_error: queue.error_message
          };
        } else if (queue.status === 'failed') {
          blocker = 'LAST_ATTEMPT_FAILED';
          details = {
            error: queue.error_message,
            retry_count: queue.retry_count,
            max_retries: queue.max_retries
          };
        } else if (queue.status === 'processing') {
          blocker = 'PROCESSING_TIMEOUT';
          details = {
            message: 'Job stuck in processing state',
            created_date: queue.created_date,
            last_retry_at: queue.next_retry_at
          };
        } else if (queue.status === 'pending') {
          blocker = 'PENDING_NOT_PICKED_UP';
          details = {
            message: 'RewardQueueProcessor may not be running',
            created_date: queue.created_date,
            next_retry_at: queue.next_retry_at
          };
        }

        diagnostics.push({
          rewardqueue_id: queue.id,
          transaction_id: queue.transaction_id,
          client_id: transaction.client_id,
          client_phone: transaction.client_phone,
          amount: transaction.amount,
          tokens_expected: transaction.tokens_expected,
          blockchain_tx_hash: transaction.blockchain_tx_hash || 'none',
          status: queue.status,
          retry_count: `${queue.retry_count}/${queue.max_retries}`,
          last_error: queue.error_message || 'none',
          company_id: dmdCompanyId,
          company_network: dmdCompany.onchain_network,
          token_symbol: activeToken.token_symbol,
          contract_address: activeToken.contract_address,
          treasury_wallet: activeToken.treasury_wallet,
          sender_wallet: senderAddress,
          sender_avax_balance: senderAvaxBalance,
          sender_token_balance: senderTokenBalance,
          blocker: blocker,
          blocker_details: details,
          created_date: queue.created_date,
          updated_date: queue.updated_date
        });

      } catch (error) {
        diagnostics.push({
          rewardqueue_id: queue.id,
          transaction_id: queue.transaction_id,
          blocker: 'DIAGNOSTIC_ERROR',
          error: error.message
        });
      }
    }

    // Summary
    const blockerCounts = {};
    diagnostics.forEach(d => {
      blockerCounts[d.blocker] = (blockerCounts[d.blocker] || 0) + 1;
    });

    console.log('\n📊 Blocker Summary:');
    Object.entries(blockerCounts).forEach(([blocker, count]) => {
      console.log(`  ${blocker}: ${count}`);
    });

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      company_id: dmdCompanyId,
      company_name: dmdCompany.name,
      total_jobs: dmdQueues.length,
      blocker_summary: blockerCounts,
      jobs: diagnostics
    });

  } catch (error) {
    console.error('❌ Diagnostic error:', error.message);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});