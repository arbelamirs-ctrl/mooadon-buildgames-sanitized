import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { session_id, capture_amount } = body;

    if (!session_id || !capture_amount || capture_amount <= 0) {
      return Response.json({
        success: false,
        error: 'Missing or invalid fields: session_id, capture_amount'
      }, { status: 400 });
    }

    // Find session
    const sessions = await base44.asServiceRole.entities.SpendSession.filter({ id: session_id });
    if (sessions.length === 0) {
      return Response.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    const session = sessions[0];

    // Must be authorized
    if (session.status !== 'authorized') {
      return Response.json({
        success: false,
        error: `Session must be authorized, current status: ${session.status}`
      }, { status: 400 });
    }

    // Capture amount must not exceed hold amount
    if (capture_amount > session.hold_amount) {
      return Response.json({
        success: false,
        error: `Capture amount (${capture_amount}) exceeds hold amount (${session.hold_amount})`
      }, { status: 400 });
    }

    // Fetch client and company token
    const clients = await base44.asServiceRole.entities.Client.filter({ id: session.client_id });
    if (clients.length === 0) {
      return Response.json({ success: false, error: 'Client not found' }, { status: 404 });
    }
    const client = clients[0];

    const companies = await base44.asServiceRole.entities.Company.filter({ id: session.company_id });
    if (companies.length === 0) {
      return Response.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    const tokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id: session.company_id });
    const companyToken = tokens.length > 0 ? tokens[0] : null;

    const now = new Date();
    const releasedAmount = session.hold_amount - capture_amount;

    // Update session to captured
    await base44.asServiceRole.entities.SpendSession.update(session.id, {
      status: 'captured',
      capture_amount,
      captured_at: now.toISOString()
    });

    // Create CAPTURE ledger entries (double-entry)
    try {
      await base44.asServiceRole.entities.LedgerEntry.create({
        company_id: session.company_id,
        client_id: session.client_id,
        entry_type: 'CAPTURE',
        debit: capture_amount,
        balance_after: client.current_balance || 0,
        held_balance_after: (client.held_balance || 0) - capture_amount,
        reference_id: session.id,
        reference_type: 'SpendSession',
        created_at: now.toISOString(),
        note: `Captured ${capture_amount} tokens`
      });

      await base44.asServiceRole.entities.LedgerEntry.create({
        company_id: session.company_id,
        client_id: null,
        entry_type: 'CAPTURE',
        credit: capture_amount,
        reference_id: session.id,
        reference_type: 'SpendSession',
        created_at: now.toISOString(),
        note: `Capture from ${session.client_phone}`
      });

      if (releasedAmount > 0) {
        const newBalance = (client.current_balance || 0) + releasedAmount;

        await base44.asServiceRole.entities.LedgerEntry.create({
          company_id: session.company_id,
          client_id: null,
          entry_type: 'VOID',
          debit: releasedAmount,
          reference_id: session.id,
          reference_type: 'SpendSession',
          created_at: now.toISOString(),
          note: `Release ${releasedAmount} tokens from hold`
        });

        await base44.asServiceRole.entities.LedgerEntry.create({
          company_id: session.company_id,
          client_id: session.client_id,
          entry_type: 'VOID',
          credit: releasedAmount,
          balance_after: newBalance,
          held_balance_after: (client.held_balance || 0) - session.hold_amount,
          reference_id: session.id,
          reference_type: 'SpendSession',
          created_at: now.toISOString(),
          note: `Release ${releasedAmount} tokens`
        });
      }
    } catch (ledgerError) {
      console.warn('Ledger creation failed (non-blocking):', ledgerError.message);
    }

    // Update client: reduce held balance, add back released amount
    const newCurrentBalance = (client.current_balance || 0) + releasedAmount;
    await base44.asServiceRole.entities.Client.update(session.client_id, {
      current_balance: newCurrentBalance,
      held_balance: (client.held_balance || 0) - session.hold_amount
    });

    // Update CompanyToken.distributed_tokens
    if (companyToken) {
      await base44.asServiceRole.entities.CompanyToken.update(companyToken.id, {
        distributed_tokens: (companyToken.distributed_tokens || 0) + capture_amount
      });
    }

    // Audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        company_id: session.company_id,
        action: 'spend_captured',
        entity_type: 'SpendSession',
        entity_id: session.id,
        performed_by: 'service_role',
        details: {
          client_phone: session.client_phone,
          capture_amount,
          released_amount: releasedAmount,
          timestamp: now.toISOString()
        }
      });
    } catch (auditError) {
      console.warn('Audit log failed:', auditError.message);
    }

    return Response.json({
      success: true,
      session_id,
      captured_amount: capture_amount,
      released_amount: releasedAmount,
      tx_reference: session.pos_reference
    });

  } catch (error) {
    console.error('spendCapture error:', error.message);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
});