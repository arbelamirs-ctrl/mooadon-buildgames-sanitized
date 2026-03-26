import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const base44 = createClientFromRequest(req);
    
    // ── Auth check ──────────────────────────────────────────────────────────
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { session_id, refund_amount } = body;

    if (!session_id || !refund_amount || refund_amount <= 0) {
      return Response.json({
        success: false,
        error: 'Missing or invalid fields: session_id, refund_amount'
      }, { status: 400 });
    }

    // Find session
    const sessions = await base44.asServiceRole.entities.SpendSession.filter({ id: session_id });
    if (sessions.length === 0) {
      return Response.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    const session = sessions[0];

    // Must be captured
    if (session.status !== 'captured') {
      return Response.json({
        success: false,
        error: `Session must be captured, current status: ${session.status}`
      }, { status: 400 });
    }

    // Refund cannot exceed captured amount
    if (refund_amount > session.capture_amount) {
      return Response.json({
        success: false,
        error: `Refund amount (${refund_amount}) exceeds captured amount (${session.capture_amount})`
      }, { status: 400 });
    }

    // Fetch client and company
    const clients = await base44.asServiceRole.entities.Client.filter({ id: session.client_id });
    if (clients.length === 0) {
      return Response.json({ success: false, error: 'Client not found' }, { status: 404 });
    }
    const client = clients[0];

    const companies = await base44.asServiceRole.entities.Company.filter({ id: session.company_id });
    if (companies.length === 0) {
      return Response.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    const now = new Date();

    // Create REFUND ledger entries (double-entry)
    try {
      // Debit: company refunds to customer
      await base44.asServiceRole.entities.LedgerEntry.create({
        company_id: session.company_id,
        client_id: null,
        entry_type: 'REFUND',
        debit: refund_amount,
        reference_id: session.id,
        reference_type: 'SpendSession',
        created_at: now.toISOString(),
        note: `Refund to ${session.client_phone}`
      });

      // Credit: client receives refund
      await base44.asServiceRole.entities.LedgerEntry.create({
        company_id: session.company_id,
        client_id: session.client_id,
        entry_type: 'REFUND',
        credit: refund_amount,
        balance_after: (client.current_balance || 0) + refund_amount,
        reference_id: session.id,
        reference_type: 'SpendSession',
        created_at: now.toISOString(),
        note: `Refunded ${refund_amount} tokens`
      });
    } catch (ledgerError) {
      console.warn('Ledger creation failed (non-blocking):', ledgerError.message);
    }

    // Update client balance
    await base44.asServiceRole.entities.Client.update(session.client_id, {
      current_balance: (client.current_balance || 0) + refund_amount
    });

    // Update session refund_amount
    await base44.asServiceRole.entities.SpendSession.update(session.id, {
      refund_amount: (session.refund_amount || 0) + refund_amount,
      refunded_at: now.toISOString()
    });

    // Audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        company_id: session.company_id,
        action: 'spend_refunded',
        entity_type: 'SpendSession',
        entity_id: session.id,
        performed_by: 'service_role',
        details: {
          client_phone: session.client_phone,
          refund_amount,
          timestamp: now.toISOString()
        }
      });
    } catch (auditError) {
      console.warn('Audit log failed:', auditError.message);
    }

    return Response.json({
      success: true,
      session_id,
      refunded_amount: refund_amount
    });

  } catch (error) {
    console.error('spendRefund error:', error.message);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
});