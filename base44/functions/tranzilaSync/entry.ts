import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * tranzilaSync
 * Pulls transactions from Tranzila TRAPI for all active company connections,
 * saves new transactions to DB, and triggers reward flow via RewardQueue.
 */

const TRANZILA_TRAPI_URL = 'https://secure5.tranzila.com/cgi-bin/tranzila71u.cgi';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole;

    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const { company_id: filterCompanyId } = body;

    let connections = await db.entities.TranzilaConnection.filter({ is_active: true });

    if (filterCompanyId) {
      connections = connections.filter(c => c.company_id === filterCompanyId);
    }

    if (connections.length === 0) {
      return Response.json({ success: true, message: 'No active Tranzila connections', synced: 0 });
    }

    console.log(`🔄 [tranzilaSync] Processing ${connections.length} connection(s)`);

    const results = [];
    for (const conn of connections) {
      const result = await syncConnection(db, conn);
      results.push(result);
    }

    const totalNew    = results.reduce((s, r) => s + (r.new_transactions || 0), 0);
    const totalErrors = results.filter(r => r.error).length;
    const totalMs     = Date.now() - startTime;

    console.log(`✅ [tranzilaSync] Done: ${totalNew} new transactions, ${totalErrors} errors (${totalMs}ms)`);

    return Response.json({
      success: true,
      summary: { connections: connections.length, new_transactions: totalNew, errors: totalErrors, total_ms: totalMs },
      results,
    });

  } catch (error) {
    console.error('[tranzilaSync] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function syncConnection(db, conn) {
  const { company_id, terminal_name, api_user, api_password, last_sync_at } = conn;
  console.log(`▶ [tranzilaSync] Syncing terminal: ${terminal_name} (company: ${company_id})`);

  try {
    const now = new Date();
    const fromDate = last_sync_at
      ? new Date(last_sync_at)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const formatDateTranzila = (d) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      return `${dd}${mm}${yy}`;
    };

    const params = new URLSearchParams({
      supplier:               terminal_name,
      user:                   api_user,
      password:               api_password,
      TranzilaTK:             '1',
      action:                 '1020',
      transaction_start_date: formatDateTranzila(fromDate),
      transaction_end_date:   formatDateTranzila(now),
      Response:               'json',
    });

    const trapiRes = await fetch(`${TRANZILA_TRAPI_URL}?${params.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!trapiRes.ok) {
      throw new Error(`TRAPI HTTP ${trapiRes.status}: ${await trapiRes.text()}`);
    }

    const trapiData = await trapiRes.json();

    if (trapiData.Response && trapiData.Response !== '000') {
      throw new Error(`TRAPI error code ${trapiData.Response}: ${trapiData.Error || 'Unknown error'}`);
    }

    const rawTransactions = trapiData.transactions || trapiData.Transactions || [];
    console.log(`📋 [tranzilaSync] ${terminal_name}: ${rawTransactions.length} transactions fetched`);

    if (rawTransactions.length === 0) {
      await updateConnectionState(db, conn.id, now.toISOString(), 0, null);
      return { terminal_name, company_id, new_transactions: 0, skipped: 0 };
    }

    const companies = await db.entities.Company.filter({ id: company_id });
    if (!companies.length) throw new Error(`Company ${company_id} not found`);
    const company = companies[0];

    const branches = await db.entities.Branch.filter({ company_id });
    const defaultBranch = branches[0] || null;

    let newCount = 0;
    let skippedCount = 0;

    for (const raw of rawTransactions) {
      try {
        const processed = await processTransaction(db, raw, company, defaultBranch);
        if (processed === 'new')     newCount++;
        if (processed === 'existed') skippedCount++;
      } catch (txErr) {
        console.error(`❌ [tranzilaSync] Error processing tx ${raw.index || raw.Index}:`, txErr.message);
      }
    }

    await updateConnectionState(db, conn.id, now.toISOString(), newCount, null);
    console.log(`✅ [tranzilaSync] ${terminal_name}: ${newCount} new, ${skippedCount} skipped`);
    return { terminal_name, company_id, new_transactions: newCount, skipped: skippedCount };

  } catch (error) {
    console.error(`❌ [tranzilaSync] ${terminal_name} failed:`, error.message);
    await updateConnectionState(db, conn.id, null, 0, error.message).catch(() => {});
    return { terminal_name, company_id, error: error.message };
  }
}

async function processTransaction(db, raw, company, defaultBranch) {
  const tranzilaIndex = String(raw.index   || raw.Index   || raw.transaction_id || '');
  const amount        = parseFloat(raw.sum  || raw.Sum    || raw.amount || '0');
  const phoneRaw      = raw.phone || raw.Phone || raw.cust_phone || raw.user_phone || '';
  const cardLast4     = raw.last4 || raw.Last4 || raw.card_number_last4 || '';
  const authCode      = raw.authcode || raw.AuthCode || raw.auth_code || '';
  const cardType      = raw.cardtype || raw.CardType || raw.card_type || '';
  const dateStr       = String(raw.date || raw.Date || raw.transaction_date || '');
  const timeStr       = String(raw.time || raw.Time || raw.transaction_time || '');
  const txDate        = parseTranzilaDate(dateStr, timeStr);

  if (!tranzilaIndex || amount <= 0) return 'skipped';

  const existing = await db.entities.Transaction.filter({
    external_transaction_id: tranzilaIndex,
    company_id: company.id,
  });
  if (existing.length > 0) return 'existed';

  let phone = phoneRaw.replace(/\D/g, '');
  if (phone.startsWith('972')) phone = '0' + phone.slice(3);
  if (phone.length < 9) phone = null;

  let client = null;
  if (phone) {
    const clients = await db.entities.Client.filter({ company_id: company.id, phone });
    client = clients[0] || null;
    if (!client) {
      try {
        client = await db.entities.Client.create({
          company_id: company.id,
          phone,
          source: 'tranzila_sync',
        });
      } catch (_) {}
    }
  }

  const rewardRate   = company.reward_rate || company.points_to_currency_ratio || 10;
  const tokensEarned = Math.floor(amount / rewardRate);

  const transaction = await db.entities.Transaction.create({
    company_id:              company.id,
    branch_id:               defaultBranch?.id || null,
    client_id:               client?.id || null,
    phone:                   phone || '',
    amount,
    currency:                company.pos_currency || 'ILS',
    tokens_earned:           tokensEarned,
    transaction_type:        'purchase',
    status:                  'completed',
    source:                  'tranzila_sync',
    external_transaction_id: tranzilaIndex,
    transaction_date:        txDate || new Date().toISOString(),
    metadata: { card_last4: cardLast4, auth_code: authCode, card_type: cardType },
  });

  if (client && tokensEarned > 0) {
    await db.entities.RewardQueue.create({
      company_id:     company.id,
      client_id:      client.id,
      transaction_id: transaction.id,
      tokens_amount:  tokensEarned,
      status:         'pending',
      source:         'tranzila_sync',
      created_at:     new Date().toISOString(),
    });
    db.functions.invoke('RewardQueueProcessor', {}).catch(() => {});
  }

  return 'new';
}

function parseTranzilaDate(dateStr, timeStr) {
  try {
    if (!dateStr || dateStr.length < 6) return null;
    const dd   = dateStr.slice(0, 2);
    const mm   = dateStr.slice(2, 4);
    const yy   = dateStr.slice(4, 6);
    const year = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`;
    let hh = '00', min = '00', ss = '00';
    if (timeStr && timeStr.length >= 6) {
      hh  = timeStr.slice(0, 2);
      min = timeStr.slice(2, 4);
      ss  = timeStr.slice(4, 6);
    }
    return new Date(`${year}-${mm}-${dd}T${hh}:${min}:${ss}`).toISOString();
  } catch (_) { return null; }
}

async function updateConnectionState(db, connectionId, lastSyncAt, count, error) {
  try {
    const update = { last_sync_count: count, last_error: error };
    if (lastSyncAt) update.last_sync_at = lastSyncAt;
    await db.entities.TranzilaConnection.update(connectionId, update);
  } catch (_) {}
}