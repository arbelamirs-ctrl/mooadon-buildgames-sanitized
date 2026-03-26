import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const SALT = Deno.env.get('INTERNAL_SERVICE_TOKEN') || 'default-salt';

async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSessionToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  
  try {

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('BODY:', JSON.stringify(body));
    const { company_id, branch_id, terminal_id, cashier_name, pin } = body;

    if (!company_id || !branch_id || !terminal_id || !cashier_name || !pin) {
      return Response.json(
        { error: 'Missing required fields: company_id, branch_id, terminal_id, cashier_name, pin' },
        { status: 400 }
      );
    }

    // Validate PIN is 4-8 digits
    if (!/^\d{4,8}$/.test(pin)) {
      return Response.json({ error: 'PIN must be 4-8 digits' }, { status: 400 });
    }

    // End any active sessions for this terminal first
    const activeSessions = await base44.asServiceRole.entities.CashierSession.filter({
      terminal_id,
      status: 'active'
    });

    for (const session of activeSessions) {
      await base44.asServiceRole.entities.CashierSession.update(session.id, {
        status: 'ended',
        ended_at: new Date().toISOString()
      });
    }

    // Hash the PIN
    const pin_hash = await hashPin(pin);
    const session_token = generateSessionToken();

    // Create new session
    const session = await base44.asServiceRole.entities.CashierSession.create({
      company_id,
      branch_id,
      terminal_id,
      cashier_name,
      pin_hash,
      session_token,
      started_at: new Date().toISOString(),
      status: 'active',
      total_transactions: 0,
      last_activity_at: new Date().toISOString(),
      idle_timeout_minutes: 30
    });

    return Response.json({
      success: true,
      cashier_session_id: session.id,
      session_token,
      cashier_name,
      message: `Session started for ${cashier_name}`
    });
  } catch (error) {
    console.error('Error in startCashierSession:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});