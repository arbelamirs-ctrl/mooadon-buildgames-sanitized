import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { createPublicClient, http, formatUnits } from 'npm:viem@2.7.0';
import { avalancheFuji, avalanche } from 'npm:viem@2.7.0/chains';

function getChainConfigViem() {
  const network   = (Deno.env.get('AVAX_NETWORK') || 'fuji') === 'mainnet' ? 'mainnet' : 'fuji';
  const isMainnet = network === 'mainnet';
  const rpcUrl    = isMainnet
    ? (Deno.env.get('MAINNET_RPC_URL') || 'https://api.avax.network/ext/bc/C/rpc')
    : (Deno.env.get('FUJI_RPC_URL')    || 'https://api.avax-test.network/ext/bc/C/rpc');
  return { network, rpcUrl, isMainnet, chain: isMainnet ? avalanche : avalancheFuji };
}

const BALANCE_ABI = [{
  type: 'function', name: 'balanceOf',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ type: 'uint256' }],
  stateMutability: 'view'
}];

const DRIFT_THRESHOLD = 1;

const JOB_SCHEDULE = {
  RewardQueueProcessor:  { intervalMs: 5 * 60 * 1000,       description: 'Process pending reward tokens' },
  mintRewardJob:         { intervalMs: 15 * 60 * 1000,      description: 'Retry failed token mints' },
  tranzilaSync:          { intervalMs: 5 * 60 * 1000,       description: 'Pull transactions from Tranzila TRAPI' },
  runAnchorJob:          { intervalMs: 60 * 60 * 1000,      description: 'Anchor batches to Avalanche' },
  runAutomationRules:    { intervalMs: 24 * 60 * 60 * 1000, description: 'Birthday/inactivity campaigns' },
  retryWebhookQueue:     { intervalMs: 5 * 60 * 1000,       description: 'Retry failed webhooks' },
  squareTokenRefresh:    { intervalMs: 24 * 60 * 60 * 1000, description: 'Refresh Square OAuth tokens' },
  settlementCalculate:   { intervalMs: 24 * 60 * 60 * 1000, description: 'Daily settlement calculation' },
  nightlyReconciliation:  { intervalMs: 24 * 60 * 60 * 1000, description: 'DB vs onchain balance reconciliation' },
  dailyHealthCheck:       { intervalMs: 24 * 60 * 60 * 1000, description: 'Platform health + security sanity checks' },
  monitorTokenDelivery:   { intervalMs: 5 * 60 * 1000,       description: 'Monitor & retry failed token delivery' },
};

const JOB_GROUPS = {
  all:            Object.keys(JOB_SCHEDULE),
  rewards:        ['RewardQueueProcessor', 'mintRewardJob'],
  tranzila:       ['tranzilaSync'],
  anchor:         ['runAnchorJob'],
  automation:     ['runAutomationRules'],
  webhooks:       ['retryWebhookQueue'],
  square:         ['squareTokenRefresh'],
  settlement:     ['settlementCalculate'],
  reconciliation: ['nightlyReconciliation'],
  health:         ['dailyHealthCheck'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  const startTime = Date.now();
  const url = new URL(req.url);

  let bodyData = {};
  try {
    if (req.method === 'POST') {
      const text = await req.text();
      if (text) bodyData = JSON.parse(text);
    }
  } catch (_) {}

  const jobParam   = url.searchParams.get('job') || bodyData.job || 'all';
  const forceParam = url.searchParams.get('force') === 'true' || bodyData.force === true;

  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole;

    const serviceToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
    const requestToken = req.headers.get('X-Service-Token');

    let callerRole = 'service';
    let authorized = false;

    if (serviceToken && requestToken && requestToken === serviceToken) {
      authorized = true;
      callerRole = 'service_token';
    }

    if (!authorized) {
      try {
        const user = await base44.auth.me().catch(() => null);
        if (user) {
          callerRole = user.role || 'unknown';
          const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || '').split(',').map(e => e.trim().toLowerCase());
          const isAdmin = user.role === 'admin' || user.role === 'super_admin' || ADMIN_EMAILS.includes(user.email?.toLowerCase());
          if (isAdmin) authorized = true;
        }
      } catch (_) {}
    }

    if (!authorized) {
      console.warn('[schedulerWatchdog] Unauthorized access attempt');
      return Response.json({ error: 'Unauthorized: admin role or X-Service-Token required' }, { status: 401 });
    }

    const ALLOWED_JOBS = new Set([...Object.keys(JOB_SCHEDULE), ...Object.keys(JOB_GROUPS)]);
    if (!ALLOWED_JOBS.has(jobParam)) {
      console.warn(`[schedulerWatchdog] Unknown job requested: ${jobParam}`);
      return Response.json({ error: `Unknown job: ${jobParam}. Allowed: ${[...ALLOWED_JOBS].join(', ')}` }, { status: 400 });
    }

    const jobsToRun = JOB_GROUPS[jobParam] || JOB_GROUPS.all;
    console.log(`🕐 [schedulerWatchdog] caller=${callerRole} jobs=${jobsToRun.join(',')} force=${forceParam}`);

    let stateRecords = [];
    try { stateRecords = await db.entities.SchedulerState.list(); } catch (_) {}
    const stateMap = {};
    for (const rec of stateRecords) stateMap[rec.job_name] = rec.last_run_at;

    const results = {};
    const now = Date.now();

    for (const jobName of jobsToRun) {
      const config = JOB_SCHEDULE[jobName];
      if (!config) continue;

      if (!forceParam) {
        const lastRun = stateMap[jobName] ? new Date(stateMap[jobName]).getTime() : 0;
        const elapsed = now - lastRun;
        if (elapsed < config.intervalMs) {
          const nextIn = Math.ceil((config.intervalMs - elapsed) / 1000 / 60);
          results[jobName] = { skipped: true, reason: 'too_soon', next_in_minutes: nextIn };
          console.log(`⏭ [schedulerWatchdog] ${jobName} skipped (next in ${nextIn}m)`);
          continue;
        }
      }

      if (jobName === 'RewardQueueProcessor' && !forceParam) {
        try {
          const pending   = await db.entities.RewardQueue.filter({ status: 'pending' });
          const failedDue = await db.entities.RewardQueue.filter({ status: 'failed' });
          const retryable = failedDue.filter((r) => {
            if ((r.retry_count || 0) >= (r.max_retries || 3)) return false;
            if (!r.next_retry_at) return true;
            return new Date(r.next_retry_at).getTime() <= now;
          });
          if (pending.length === 0 && retryable.length === 0) {
            results[jobName] = { skipped: true, reason: 'no_work', pending: 0, retryable: 0 };
            console.log(`⏭ [schedulerWatchdog] ${jobName} skipped (queue empty)`);
            continue;
          }
          console.log(`📋 [schedulerWatchdog] ${jobName}: ${pending.length} pending, ${retryable.length} retryable`);
        } catch (_) {}
      }

      try {
        console.log(`▶ [schedulerWatchdog] invoking ${jobName}...`);
        const invokeStart = Date.now();

        let result;
        if (jobName === 'nightlyReconciliation') {
          result = await runNightlyReconciliation(db);
        } else {
          result = await db.functions.invoke(jobName, {});
        }

        const elapsed = Date.now() - invokeStart;
        let safeResult = null;
        try { safeResult = JSON.parse(JSON.stringify(result ?? null)); } catch (_) { safeResult = { note: 'non-serializable' }; }
        results[jobName] = { success: true, elapsed_ms: elapsed, result: safeResult };
        console.log(`✅ [schedulerWatchdog] ${jobName} OK (${elapsed}ms)`);
        await upsertState(db, jobName, new Date().toISOString());

      } catch (err) {
        results[jobName] = { success: false, error: err.message };
        console.error(`❌ [schedulerWatchdog] ${jobName} FAILED:`, err.message);
      }
    }

    const ran     = Object.values(results).filter((r) => r.success === true).length;
    const failed  = Object.values(results).filter((r) => r.success === false).length;
    const skipped = Object.values(results).filter((r) => r.skipped).length;
    const totalMs = Date.now() - startTime;

    console.log(`🏁 [schedulerWatchdog] done: ${ran} ran, ${failed} failed, ${skipped} skipped (${totalMs}ms)`);

    return Response.json({
      success: true,
      summary: { ran, failed, skipped, total_ms: totalMs },
      jobs: results,
    });

  } catch (error) {
    console.error('[schedulerWatchdog] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ── Nightly Reconciliation (inline) ─────────────────────────────────────────
async function runNightlyReconciliation(db) {
  const chainCfg = getChainConfigViem();
  const publicClient = createPublicClient({
    chain: chainCfg.chain,
    transport: http(chainCfg.rpcUrl, { timeout: 15_000 })
  });

  const companies = await db.entities.Company.filter({ onchain_enabled: true });
  if (companies.length === 0) {
    return { message: 'No onchain-enabled companies', checked: 0, matched: 0, drifted: 0, status: 'clean' };
  }

  const report = { checked: 0, matched: 0, drifted: 0, skipped: 0, errors: 0, drift_items: [] };

  for (const company of companies) {
    const tokens = await db.entities.CompanyToken.filter({ company_id: company.id });
    const active  = tokens.filter((t) => t.is_active !== false && t.contract_address);
    const cToken  = active.length > 0 ? active[active.length - 1] : null;
    if (!cToken?.contract_address) { report.skipped++; continue; }

    const contractAddress = cToken.contract_address.includes('$')
      ? cToken.contract_address.split('$')[1] : cToken.contract_address;

    const clients    = await db.entities.Client.filter({ company_id: company.id });
    const withWallet = clients.filter((c) => c.wallet_address);

    for (const client of withWallet) {
      report.checked++;
      try {
        const wei = await publicClient.readContract({
          address: contractAddress,
          abi: BALANCE_ABI, functionName: 'balanceOf',
          args: [client.wallet_address]
        });

        const onchain = parseFloat(formatUnits(wei, cToken.decimals || 18));
        const dbBal   = client.onchain_balance || client.current_balance || 0;
        const delta   = Math.abs(onchain - dbBal);

        if (delta > DRIFT_THRESHOLD) {
          report.drifted++;
          report.drift_items.push({
            company_id: company.id, company_name: company.name,
            client_id: client.id, client_phone: client.phone,
            db_balance: dbBal, onchain_balance: onchain, delta,
            direction: onchain > dbBal ? 'onchain_higher' : 'db_higher',
          });
          await db.entities.Client.update(client.id, { onchain_balance: onchain, last_sync: new Date().toISOString() });
        } else {
          report.matched++;
          if (Math.abs(onchain - (client.onchain_balance || 0)) > 0.001) {
            await db.entities.Client.update(client.id, { onchain_balance: onchain, last_sync: new Date().toISOString() });
          }
        }
      } catch (e) {
        report.errors++;
        console.error(`❌ [reconciliation] client ${client.id}:`, e.message);
      }
    }
  }

  try {
    await db.entities.ReconciliationReport.create({
      run_at: new Date().toISOString(), network: chainCfg.network,
      ...report, status: report.drifted > 0 ? 'drift_detected' : 'clean',
    });
  } catch (_) {}

  return { ...report, network: chainCfg.network, status: report.drifted > 0 ? 'drift_detected' : 'clean' };
}

// ── Helper: upsert SchedulerState row ────────────────────────────────────────
async function upsertState(db, jobName, lastRunAt) {
  try {
    const existing = await db.entities.SchedulerState.filter({ job_name: jobName });
    if (existing.length > 0) {
      await db.entities.SchedulerState.update(existing[0].id, { last_run_at: lastRunAt });
    } else {
      await db.entities.SchedulerState.create({ job_name: jobName, last_run_at: lastRunAt });
    }
  } catch (_) {}
}