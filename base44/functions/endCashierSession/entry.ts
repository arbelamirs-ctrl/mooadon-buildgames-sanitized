import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { cashier_session_id } = body;

    if (!cashier_session_id) {
      return Response.json({ error: 'Missing cashier_session_id' }, { status: 400 });
    }

    // Get session
    const sessions = await base44.entities.CashierSession.filter({ id: cashier_session_id });
    if (!sessions || sessions.length === 0) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const session = sessions[0];

    // ── Verify caller has access to this session's company ──────────────────
    const permissions = await base44.entities.UserPermission.filter({
      user_id: user.id,
      company_id: session.company_id,
      is_active: true
    });
    if (user.role !== 'admin' && user.role !== 'super_admin' && permissions.length === 0) {
      return Response.json({ error: 'Forbidden: No access to this session' }, { status: 403 });
    }

    // End the session
    await base44.entities.CashierSession.update(cashier_session_id, {
      status: 'ended',
      ended_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      message: `Session ended for ${session.cashier_name}`,
      total_transactions: session.total_transactions || 0
    });
  } catch (error) {
    console.error('Error in endCashierSession:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});