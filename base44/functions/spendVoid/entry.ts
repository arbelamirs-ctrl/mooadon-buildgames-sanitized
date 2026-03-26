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
    const { session_id, reason } = body;

    if (!session_id) {
      return Response.json({
        success: false,
        error: 'Missing required field: session_id'
      }, { status: 400 });
    }

    // Find session
    const sessions = await base44.asServiceRole.entities.SpendSession.filter({ id: session_id });
    if (sessions.length === 0) {
      return Response.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    const session = sessions[0];

    // Can only void authorized (not yet captured)
    if (session.status !== 'authorized') {
      return Response.json({
        success: false,
        error: `Cannot void session in ${session.status} status. Can only void authorized sessions.`
      }, { status: 400 });
    }

    // Fetch client
    const clients = await base44.asServiceRole.entities.Client.filter({ id: session.client_id });
    if (clients.length === 0) {
      return Response.json({ success: false, error: 'Client not found' }, { status: 404 });
    }
    const client = clients[0];

    const now = new Date();
    const heldAmount = session.hold_amount;

    // Update session to voided
    await base44.asServiceRole.entities.SpendSession.update(session.id, {
      status: 'voided',
      voided_at: now.toISOString(),
      void_reason: reason || null
    });

    // Create VOID ledger entries (double-entry)
    try {
      // Debit: company returns held tokens
      await base44.asServiceRole.entities.LedgerEntry.create({
        company_id: session.company_id,
        client_id: null,
        entry_type: 'VOID',
        debit: heldAmount,
        reference_id: session.id,
        reference_type: 'SpendSession',
        created_at: now.toISOString(),
        note: `Void held tokens: ${reason || 'no reason'}`
      });

      // Credit: client receives held tokens back
      await base44.asServiceRole.entities.LedgerEntry.create({
        company_id: session.company_id,
        client_id: session.client_id,
        entry_type: 'VOID',
        credit: heldAmount,
        balance_after: (client.current_balance || 0) + heldAmount,
        held_balance_after: (client.held_balance || 0) - heldAmount,
        reference_id: session.id,
        reference_type: 'SpendSession',
        created_at: now.toISOString(),
        note: `Void released ${heldAmount} tokens`
      });
    } catch (ledgerError) {
      console.warn('Ledger creation failed (non-blocking):', ledgerError.message);
    }

    // Update client: release held balance back to current balance
    await base44.asServiceRole.entities.Client.update(session.client_id, {
      current_balance: (client.current_balance || 0) + heldAmount,
      held_balance: (client.held_balance || 0) - heldAmount
    });

    // Audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        company_id: session.company_id,
        action: 'spend_voided',
        entity_type: 'SpendSession',
        entity_id: session.id,
        performed_by: 'service_role',
        details: {
          client_phone: session.client_phone,
          voided_amount: heldAmount,
          reason: reason || 'no reason provided',
          timestamp: now.toISOString()
        }
      });
    } catch (auditError) {
      console.warn('Audit log failed:', auditError.message);
    }

    return Response.json({
      success: true,
      session_id,
      voided_amount: heldAmount
    });

  } catch (error) {
    console.error('spendVoid error:', error.message);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
});