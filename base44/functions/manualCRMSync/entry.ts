import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { company_id } = await req.json();
    if (!company_id) return Response.json({ error: 'Missing company_id' }, { status: 400 });

    // Get CRM config
    const configs = await base44.entities.CRMConfig.filter({ company_id, is_active: true });
    if (!configs.length) {
      return Response.json({ error: 'No active CRM config' }, { status: 400 });
    }

    const config = configs[0];

    // Get all clients
    const clients = await base44.entities.Client.filter({ company_id });

    // Call syncToCRM for each client
    const results = [];
    for (const client of clients) {
      try {
        const syncResult = await base44.functions.invoke('syncToCRM', {
          company_id,
          client_id: client.id,
          client_data: client,
          crm_type: config.crm_type,
          credentials: config.api_credentials,
          sync_direction: config.sync_direction,
          log_events: config.log_events,
        });
        results.push({ client_id: client.id, success: true });
      } catch (e) {
        results.push({ client_id: client.id, success: false, error: e.message });
      }
    }

    // Update CRMConfig with sync status
    const successCount = results.filter(r => r.success).length;
    await base44.entities.CRMConfig.update(config.id, {
      last_sync: new Date().toISOString(),
      last_sync_status: 'success',
      total_synced_clients: successCount,
    });

    return Response.json({
      success: true,
      total: clients.length,
      synced: successCount,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});