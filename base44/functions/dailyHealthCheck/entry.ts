import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

const THRESHOLDS = {
  GAS_CRITICAL:                 0.05,
  GAS_WARNING:                  0.15,
  STUCK_TX_MINUTES:             30,
  STUCK_QUEUE_MINUTES:          30,
  WEBHOOK_FAIL_LIMIT:           20,
  SCHEDULER_OVERDUE_MULTIPLIER: 2.0,
};

const REQUIRED_SECRETS = [
  'WALLET_ENCRYPTION_KEY',
  'GAS_WALLET_PRIVATE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'INTERNAL_SERVICE_TOKEN',
];

const JOB_INTERVALS_MS = {
  RewardQueueProcessor:  5 * 60 * 1000,
  mintRewardJob:         15 * 60 * 1000,
  tranzilaSync:          5 * 60 * 1000,
  runAnchorJob:          60 * 60 * 1000,
  runAutomationRules:    24 * 60 * 60 * 1000,
  retryWebhookQueue:     5 * 60 * 1000,
  nightlyReconciliation: 24 * 60 * 60 * 1000,
  settlementCalculate:   24 * 60 * 60 * 1000,
  dailyHealthCheck:      24 * 60 * 60 * 1000,
};

function minutesAgo(isoString) {
  return (Date.now() - new Date(isoString).getTime()) / 60_000;
}

function hoursAgo(isoString) {
  return minutesAgo(isoString) / 60;
}

async function checkSecrets() {
  const missing = [];
  const weak = [];

  for (const key of REQUIRED_SECRETS) {
    const val = Deno.env.get(key);
    if (!val) missing.push(key);
    else if (val.length < 16 && key.includes('KEY')) weak.push(key);
  }

  const errors = [];
  const warnings = [];
  if (missing.length > 0) errors.push(`Missing required secrets: ${missing.join(', ')}`);
  if (weak.length > 0) errors.push(`Weak secrets (< 16 chars): ${weak.join(', ')}`);

  return {
    check: 'secrets',
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok',
    errors, warnings, details: { missing, weak }
  };
}

async function checkDBIntegrity(db) {
  const errors = [];
  const warnings = [];
  const details = {};

  try {
    const pendingTxs = await db.entities.BlockchainTransfer.filter({ status: 'pending' });
    const stuckTxs = pendingTxs.filter(tx => tx.created_at && minutesAgo(tx.created_at) > THRESHOLDS.STUCK_TX_MINUTES);
    details.stuck_blockchain_transfers = stuckTxs.length;
    if (stuckTxs.length > 0) errors.push(`${stuckTxs.length} blockchain transfers stuck in 'pending' > ${THRESHOLDS.STUCK_TX_MINUTES} min`);

    const confirmedTxs = await db.entities.BlockchainTransfer.filter({ status: 'confirmed' });
    const noHashTxs = confirmedTxs.filter(tx => !tx.tx_hash);
    details.confirmed_without_tx_hash = noHashTxs.length;
    if (noHashTxs.length > 0) warnings.push(`${noHashTxs.length} confirmed transfers missing tx_hash`);

    const allClients = await db.entities.Client.filter({});
    const negativeBalance = allClients.filter(c => (c.current_balance || 0) < 0);
    details.clients_negative_balance = negativeBalance.length;
    if (negativeBalance.length > 0) errors.push(`${negativeBalance.length} clients have negative token balance`);

  } catch (e) {
    warnings.push(`DB integrity check partial failure: ${e.message}`);
  }

  return {
    check: 'db',
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok',
    errors, warnings, details
  };
}

async function checkOnchainSanity(db) {
  const errors = [];
  const warnings = [];
  const details = {};

  try {
    const companies = await db.entities.Company.filter({ onchain_enabled: true });
    details.onchain_companies = companies.length;

    const missingContract = [];
    const missingWallet = [];

    for (const company of companies) {
      const tokens = await db.entities.CompanyToken.filter({ company_id: company.id, is_active: true });
      if (tokens.length === 0 || !tokens[0].contract_address) missingContract.push(company.name || company.id);
      if (!company.blockchain_wallet_address) missingWallet.push(company.name || company.id);
    }

    details.missing_contract = missingContract;
    details.missing_wallet = missingWallet;

    if (missingContract.length > 0) errors.push(`${missingContract.length} onchain companies have no active token contract: ${missingContract.slice(0, 3).join(', ')}`);
    if (missingWallet.length > 0) errors.push(`${missingWallet.length} onchain companies have no blockchain wallet: ${missingWallet.slice(0, 3).join(', ')}`);

  } catch (e) {
    warnings.push(`Onchain sanity check failed: ${e.message}`);
  }

  return {
    check: 'onchain',
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok',
    errors, warnings, details
  };
}

async function checkGasWallet() {
  const errors = [];
  const warnings = [];
  const details = {};

  const privateKey = Deno.env.get('GAS_WALLET_PRIVATE_KEY');
  if (!privateKey) {
    return { check: 'gas', status: 'error', errors: ['GAS_WALLET_PRIVATE_KEY not set'], warnings: [], details: {} };
  }

  try {
    const network = (Deno.env.get('AVAX_NETWORK') || 'fuji') === 'mainnet' ? 'mainnet' : 'fuji';
    const rpcUrl = network === 'mainnet'
      ? (Deno.env.get('MAINNET_RPC_URL') || 'https://api.avax.network/ext/bc/C/rpc')
      : (Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc');

    const { createPublicClient, http, formatEther } = await import('npm:viem@2.7.0');
    const { avalanche, avalancheFuji } = await import('npm:viem@2.7.0/chains');
    const { privateKeyToAddress } = await import('npm:viem@2.7.0/accounts');

    const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const address = privateKeyToAddress(normalizedKey);

    const client = createPublicClient({ chain: network === 'mainnet' ? avalanche : avalancheFuji, transport: http(rpcUrl) });
    const balanceWei = await client.getBalance({ address });
    const balanceAvax = parseFloat(formatEther(balanceWei));

    details.address = address;
    details.balance_avax = balanceAvax;
    details.network = network;

    if (balanceAvax < THRESHOLDS.GAS_CRITICAL) {
      errors.push(`CRITICAL: Gas wallet has only ${balanceAvax.toFixed(4)} AVAX — fund immediately!`);
    } else if (balanceAvax < THRESHOLDS.GAS_WARNING) {
      warnings.push(`Gas wallet low: ${balanceAvax.toFixed(4)} AVAX. Fund soon.`);
    }

  } catch (e) {
    warnings.push(`Gas wallet check failed: ${e.message}`);
  }

  return {
    check: 'gas',
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok',
    errors, warnings, details
  };
}

async function checkTokenCoverage(db) {
  const errors = [];
  const warnings = [];
  const details = {};

  try {
    const companies = await db.entities.Company.filter({});
    details.total_companies = companies.length;

    const noToken = [];
    const noActiveToken = [];

    for (const company of companies) {
      const tokens = await db.entities.CompanyToken.filter({ company_id: company.id });
      if (tokens.length === 0) {
        noToken.push(company.name || company.id);
      } else {
        const active = tokens.filter(t => t.is_active !== false && t.contract_address);
        if (active.length === 0) noActiveToken.push(company.name || company.id);
      }
    }

    details.companies_no_token = noToken.length;
    details.companies_no_active_token = noActiveToken.length;

    if (noToken.length > 0) warnings.push(`${noToken.length} companies have no CompanyToken: ${noToken.slice(0, 3).join(', ')}`);
    if (noActiveToken.length > 0) warnings.push(`${noActiveToken.length} companies have no active token with contract: ${noActiveToken.slice(0, 3).join(', ')}`);

  } catch (e) {
    warnings.push(`Token coverage check failed: ${e.message}`);
  }

  return {
    check: 'tokens',
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok',
    errors, warnings, details
  };
}

async function checkPermissions(db) {
  const errors = [];
  const warnings = [];
  const details = {};

  try {
    const permissions = await db.entities.UserPermission.filter({ is_active: true });
    const companies = await db.entities.Company.filter({});
    const companyIds = new Set(companies.map(c => c.id));

    const orphaned = permissions.filter(p => !companyIds.has(p.company_id));
    details.orphaned_permissions = orphaned.length;
    if (orphaned.length > 0) warnings.push(`${orphaned.length} UserPermissions point to non-existent companies`);

  } catch (e) {
    warnings.push(`Permission sanity check failed: ${e.message}`);
  }

  return {
    check: 'permissions',
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok',
    errors, warnings, details
  };
}

async function checkWebhookHealth(db) {
  const errors = [];
  const warnings = [];
  const details = {};

  try {
    const failedWebhooks = await db.entities.WebhookRetryQueue.filter({ status: 'failed' });
    const pendingWebhooks = await db.entities.WebhookRetryQueue.filter({ status: 'pending' });

    details.failed_webhooks = failedWebhooks.length;
    details.pending_webhooks = pendingWebhooks.length;

    if (failedWebhooks.length > THRESHOLDS.WEBHOOK_FAIL_LIMIT) {
      warnings.push(`${failedWebhooks.length} webhooks permanently failed`);
    }

    const stuckPending = pendingWebhooks.filter(w => w.created_at && hoursAgo(w.created_at) > 2);
    details.stuck_pending_webhooks = stuckPending.length;
    if (stuckPending.length > 0) warnings.push(`${stuckPending.length} webhooks stuck in pending > 2 hours`);

  } catch (e) {
    warnings.push(`Webhook health check failed: ${e.message}`);
  }

  return {
    check: 'webhooks',
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok',
    errors, warnings, details
  };
}

async function checkRewardQueue(db) {
  const errors = [];
  const warnings = [];
  const details = {};

  try {
    const pendingJobs = await db.entities.RewardQueue.filter({ status: 'pending' });
    const processingJobs = await db.entities.RewardQueue.filter({ status: 'processing' });
    const failedJobs = await db.entities.RewardQueue.filter({ status: 'failed' });

    details.pending_jobs = pendingJobs.length;
    details.processing_jobs = processingJobs.length;
    details.failed_jobs = failedJobs.length;

    const stuckProcessing = processingJobs.filter(j => j.created_at && minutesAgo(j.created_at) > THRESHOLDS.STUCK_QUEUE_MINUTES);
    details.stuck_processing = stuckProcessing.length;
    if (stuckProcessing.length > 0) errors.push(`${stuckProcessing.length} reward queue jobs stuck in 'processing' > ${THRESHOLDS.STUCK_QUEUE_MINUTES} min`);
    if (pendingJobs.length > 500) warnings.push(`Large reward queue backlog: ${pendingJobs.length} pending jobs`);
    if (failedJobs.length > 10) warnings.push(`${failedJobs.length} reward queue jobs permanently failed`);

  } catch (e) {
    warnings.push(`Reward queue check failed: ${e.message}`);
  }

  return {
    check: 'queue',
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok',
    errors, warnings, details
  };
}

async function checkCurrencyConsistency(db) {
  const errors = [];
  const warnings = [];
  const details = {};

  try {
    const companies = await db.entities.Company.filter({});
    const missingCurrency = [];

    for (const company of companies) {
      if (!company.dashboard_currency && !company.currency) {
        missingCurrency.push(company.name || company.id);
      }
    }

    details.missing_currency = missingCurrency.length;
    if (missingCurrency.length > 0) warnings.push(`${missingCurrency.length} companies have no currency configured`);

  } catch (e) {
    warnings.push(`Currency consistency check failed: ${e.message}`);
  }

  return {
    check: 'currency',
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok',
    errors, warnings, details
  };
}

async function checkSchedulerFreshness(db) {
  const errors = [];
  const warnings = [];
  const details = {};

  try {
    const states = await db.entities.SchedulerState.filter({});
    const now = Date.now();

    for (const state of states) {
      const interval = JOB_INTERVALS_MS[state.job_name];
      if (!interval || !state.last_run_at) continue;

      const msSinceLastRun = now - new Date(state.last_run_at).getTime();
      if (msSinceLastRun / interval > THRESHOLDS.SCHEDULER_OVERDUE_MULTIPLIER) {
        const hoursOverdue = (msSinceLastRun - interval) / 3_600_000;
        warnings.push(`Job '${state.job_name}' overdue by ${hoursOverdue.toFixed(1)}h`);
      }
    }

    details.jobs_checked = states.length;

  } catch (e) {
    warnings.push(`Scheduler freshness check failed: ${e.message}`);
  }

  return {
    check: 'scheduler',
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok',
    errors, warnings, details
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole;

  // Auth: service token OR admin
  const serviceToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
  const requestToken = req.headers.get('X-Service-Token');
  let authorized = !!(serviceToken && requestToken === serviceToken);

  if (!authorized) {
    const user = await base44.auth.me().catch(() => null);
    if (user) {
      const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || '').split(',').map(e => e.trim().toLowerCase());
      authorized = user.role === 'admin' || user.role === 'super_admin' || ADMIN_EMAILS.includes(user.email?.toLowerCase());
    }
  }

  if (!authorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body = {};
  try { if (req.method === 'POST') body = await req.json(); } catch (_) {}

  const ALL_CHECKS = ['secrets', 'db', 'onchain', 'gas', 'tokens', 'permissions', 'webhooks', 'queue', 'currency', 'scheduler'];
  const checksToRun = body.checks || ALL_CHECKS;
  const runAt = new Date().toISOString();

  console.log(`[dailyHealthCheck] Starting: ${checksToRun.join(', ')}`);

  const checkMap = {
    secrets:     () => checkSecrets(),
    db:          () => checkDBIntegrity(db),
    onchain:     () => checkOnchainSanity(db),
    gas:         () => checkGasWallet(),
    tokens:      () => checkTokenCoverage(db),
    permissions: () => checkPermissions(db),
    webhooks:    () => checkWebhookHealth(db),
    queue:       () => checkRewardQueue(db),
    currency:    () => checkCurrencyConsistency(db),
    scheduler:   () => checkSchedulerFreshness(db),
  };

  const results = [];
  for (const checkName of checksToRun) {
    const fn = checkMap[checkName];
    if (!fn) continue;
    try {
      const result = await fn();
      results.push(result);
      console.log(`[dailyHealthCheck] ${checkName}: ${result.status} (${result.errors.length}E / ${result.warnings.length}W)`);
    } catch (e) {
      results.push({ check: checkName, status: 'error', errors: [`Unexpected failure: ${e.message}`], warnings: [], details: {} });
    }
  }

  const totalErrors   = results.reduce((n, r) => n + r.errors.length, 0);
  const totalWarnings = results.reduce((n, r) => n + r.warnings.length, 0);
  const overallStatus = totalErrors > 0 ? 'error' : totalWarnings > 0 ? 'warning' : 'ok';

  try {
    await db.entities.HealthCheckReport.create({
      run_at: runAt,
      status: overallStatus,
      issues_count: totalErrors + totalWarnings,
      issues: results.flatMap(r => [
        ...r.errors.map(msg => ({ type: r.check, severity: 'error', message: msg })),
        ...r.warnings.map(msg => ({ type: r.check, severity: 'warning', message: msg })),
      ]),
      severity_summary: { critical: 0, high: totalErrors, medium: totalWarnings, low: 0 },
      elapsed_ms: Date.now() - new Date(runAt).getTime(),
    });
    console.log(`[dailyHealthCheck] Report saved — ${overallStatus} (${totalErrors}E / ${totalWarnings}W)`);
  } catch (e) {
    console.error('[dailyHealthCheck] Failed to save report:', e.message);
  }

  return Response.json({
    ok: overallStatus !== 'error',
    status: overallStatus,
    run_at: runAt,
    errors_count: totalErrors,
    warnings_count: totalWarnings,
    checks: results,
  });
});