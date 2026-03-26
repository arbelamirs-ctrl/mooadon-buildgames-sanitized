import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { company_id, crm_type, credentials } = await req.json();
    if (!company_id || !crm_type || !credentials) {
      return Response.json({ error: 'Missing company_id, crm_type, or credentials' }, { status: 400 });
    }

    let testResult = { success: false, error: '' };

    if (crm_type === 'hubspot') {
      const resp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
        headers: { Authorization: `Bearer ${credentials.access_token}` }
      });
      testResult.success = resp.ok;
      if (!resp.ok) testResult.error = `HubSpot: ${resp.statusText}`;
    }

    if (crm_type === 'salesforce') {
      const { client_id, client_secret, username, password } = credentials;
      const authResp = await fetch('https://login.salesforce.com/services/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'password',
          client_id,
          client_secret,
          username,
          password,
        }),
      });
      testResult.success = authResp.ok;
      if (!authResp.ok) testResult.error = `Salesforce auth failed`;
    }

    if (crm_type === 'pipedrive') {
      const resp = await fetch(`https://api.pipedrive.com/v1/users/me?api_token=${credentials.api_token}`);
      testResult.success = resp.ok;
      if (!resp.ok) testResult.error = `Pipedrive: ${resp.statusText}`;
    }

    if (crm_type === 'zoho') {
      const resp = await fetch('https://www.zohoapis.com/crm/v6/users', {
        headers: { Authorization: `Bearer ${credentials.refresh_token}` }
      });
      testResult.success = resp.ok;
      if (!resp.ok) testResult.error = `Zoho: ${resp.statusText}`;
    }

    if (crm_type === 'monday') {
      const resp = await fetch('https://api.monday.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': credentials.api_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: '{ me { id } }' }),
      });
      testResult.success = resp.ok;
      if (!resp.ok) testResult.error = `Monday.com: ${resp.statusText}`;
    }

    if (crm_type === 'freshsales') {
      const resp = await fetch(`https://${credentials.domain}/api/contacts`, {
        headers: { Authorization: `Token token=${credentials.api_key}` }
      });
      testResult.success = resp.ok;
      if (!resp.ok) testResult.error = `Freshsales: ${resp.statusText}`;
    }

    if (crm_type === 'dynamics') {
      const { client_id, client_secret, tenant_id } = credentials;
      const authResp = await fetch(`https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/token`, {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id,
          client_secret,
          scope: 'https://org.crm.dynamics.com/.default',
        }),
      });
      testResult.success = authResp.ok;
      if (!authResp.ok) testResult.error = `Dynamics auth failed`;
    }

    return Response.json(testResult);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});