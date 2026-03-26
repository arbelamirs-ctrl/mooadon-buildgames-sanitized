/**
 * syncToCRM.js
 * Real API integration for 7 CRMs:
 * HubSpot, Salesforce, Pipedrive, Zoho CRM, Monday.com, Freshsales, Dynamics 365
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { company_id, client_id, force_sync = false, event_type, event_data } = await req.json();

    const configs = await base44.entities.CRMConfig.filter({ company_id, is_active: true });
    const config = configs[0];
    if (!config) return Response.json({ success: false, error: 'No active CRM integration' });
    if (config.sync_direction === 'from_crm' && !force_sync) {
      return Response.json({ success: false, error: 'Sync direction is from_crm only' });
    }

    const clients = await base44.entities.Client.filter({ id: client_id, company_id });
    const client = clients[0];
    if (!client) return Response.json({ success: false, error: 'Client not found' });

    const existingSyncs = await base44.entities.CRMSync.filter({ client_id, company_id });
    const existingSync = existingSyncs[0];

    const tiers = await base44.entities.TierConfig.filter({ company_id });
    const clientTier = tiers
      .sort((a, b) => b.min_points - a.min_points)
      .find(t => (client.total_earned || 0) >= t.min_points);
    const achievements = await base44.entities.Achievement.filter({ client_id, company_id });

    const crmData = {
      email:               client.email,
      phone:               client.phone,
      full_name:           client.full_name,
      loyalty_points:      client.current_balance || 0,
      total_points_earned: client.total_earned    || 0,
      loyalty_tier:        clientTier?.tier_name  || 'Bronze',
      tier_level:          clientTier?.tier_level || 1,
      achievements_count:  achievements.length,
      last_activity:       client.last_activity,
      wallet_address:      client.wallet_address,
      custom_fields: {
        loyalty_app_id:    client.id,
        points_multiplier: clientTier?.points_multiplier || 1,
      },
    };

    const mappedData = applyFieldMappings(crmData, config.field_mappings);
    const creds = config.api_credentials || {};

    const handlers = { hubspot, salesforce, pipedrive, zoho, monday, freshsales, dynamics };
    const handler = handlers[config.crm_type];
    if (!handler) return Response.json({ success: false, error: `Unknown CRM type: ${config.crm_type}` });

    const result = await handler(mappedData, existingSync?.crm_contact_id, creds, event_type, event_data);

    const syncPayload = {
      crm_contact_id: result.contact_id,
      last_sync:      new Date().toISOString(),
      sync_status:    'success',
      sync_data:      mappedData,
    };

    if (existingSync) {
      await base44.entities.CRMSync.update(existingSync.id, syncPayload);
    } else {
      await base44.entities.CRMSync.create({
        company_id, client_id,
        crm_type:       config.crm_type,
        sync_direction: 'to_crm',
        ...syncPayload,
      });
    }

    if (config.sync_direction === 'bidirectional' && result.from_crm_data) {
      await mergeFromCRM(base44, client_id, result.from_crm_data);
    }

    await base44.entities.CRMConfig.update(config.id, {
      total_synced: (config.total_synced || 0) + 1,
    });

    return Response.json({
      success:        true,
      crm_contact_id: result.contact_id,
      synced_fields:  Object.keys(mappedData).length,
      crm_type:       config.crm_type,
    });

  } catch (error) {
    console.error('syncToCRM error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function mergeFromCRM(base44, client_id, data) {
  const update = {};
  if (data.full_name) update.full_name = data.full_name;
  if (data.email)     update.email     = data.email;
  if (data.phone)     update.phone     = data.phone;
  if (Object.keys(update).length > 0) {
    await base44.entities.Client.update(client_id, update);
  }
}

function applyFieldMappings(data, mappings) {
  if (!mappings) return { ...data };
  const mapped = { ...data };
  for (const [appField, crmField] of Object.entries(mappings)) {
    if (data[appField] !== undefined) {
      mapped[crmField] = data[appField];
      delete mapped[appField];
    }
  }
  return mapped;
}

async function fetchOrThrow(url, options = {}) {
  const res  = await fetch(url, options);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${url} → ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

function splitName(full) {
  const parts = (full || '').trim().split(' ');
  return { first: parts[0] || '', last: parts.slice(1).join(' ') || 'Unknown' };
}

// ════════════════════════════════════════════════════════════════════════════════
// 1. HubSpot
// ════════════════════════════════════════════════════════════════════════════════

async function hubspot(data, existingId, creds, eventType, eventData) {
  const token   = creds.access_token || Deno.env.get('HUBSPOT_ACCESS_TOKEN');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const { first, last } = splitName(data.full_name);

  const properties = {
    firstname:           first,
    lastname:            last,
    email:               data.email        || '',
    phone:               data.phone        || '',
    loyalty_points:      String(data.loyalty_points      || 0),
    total_points_earned: String(data.total_points_earned || 0),
    loyalty_tier:        data.loyalty_tier || 'Bronze',
    loyalty_app_id:      data.custom_fields?.loyalty_app_id || '',
    last_loyalty_activity: data.last_activity || '',
  };

  let contact_id = existingId;

  if (existingId) {
    await fetchOrThrow(`https://api.hubapi.com/crm/v3/objects/contacts/${existingId}`, {
      method: 'PATCH', headers, body: JSON.stringify({ properties }),
    });
  } else {
    if (data.email) {
      const res = await fetchOrThrow('https://api.hubapi.com/crm/v3/objects/contacts/search', {
        method: 'POST', headers,
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: data.email }] }],
        }),
      });
      contact_id = res.results?.[0]?.id || null;
    }
    if (contact_id) {
      await fetchOrThrow(`https://api.hubapi.com/crm/v3/objects/contacts/${contact_id}`, {
        method: 'PATCH', headers, body: JSON.stringify({ properties }),
      });
    } else {
      const res = await fetchOrThrow('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST', headers, body: JSON.stringify({ properties }),
      });
      contact_id = res.id;
    }
  }

  if (eventType && contact_id) {
    await fetchOrThrow('https://api.hubapi.com/crm/v3/objects/notes', {
      method: 'POST', headers,
      body: JSON.stringify({
        properties: {
          hs_note_body: `Mooadon — ${eventType}: ${JSON.stringify(eventData || {})}`,
          hs_timestamp: new Date().toISOString(),
        },
        associations: [{
          to: { id: contact_id },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }],
        }],
      }),
    });
  }

  const latest = await fetchOrThrow(
    `https://api.hubapi.com/crm/v3/objects/contacts/${contact_id}?properties=firstname,lastname,email,phone`,
    { headers }
  );
  const p = latest.properties || {};
  return {
    contact_id,
    from_crm_data: { full_name: `${p.firstname || ''} ${p.lastname || ''}`.trim(), email: p.email, phone: p.phone },
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// 2. Salesforce
// ════════════════════════════════════════════════════════════════════════════════

async function salesforce(data, existingId, creds, eventType, eventData) {
  const clientId     = creds.client_id     || Deno.env.get('SALESFORCE_CLIENT_ID');
  const clientSecret = creds.client_secret || Deno.env.get('SALESFORCE_CLIENT_SECRET');
  const username     = creds.username      || Deno.env.get('SALESFORCE_USERNAME');
  const password     = creds.password      || Deno.env.get('SALESFORCE_PASSWORD');

  const tokenRes = await fetchOrThrow('https://login.salesforce.com/services/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: clientId, client_secret: clientSecret, username, password }).toString(),
  });

  const { access_token, instance_url } = tokenRes;
  const headers = { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' };
  const apiBase = `${instance_url}/services/data/v59.0`;
  const { first, last } = splitName(data.full_name);

  const sfData = {
    FirstName:              first,
    LastName:               last,
    Email:                  data.email  || '',
    Phone:                  data.phone  || '',
    Loyalty_Points__c:      data.loyalty_points      || 0,
    Total_Points_Earned__c: data.total_points_earned || 0,
    Loyalty_Tier__c:        data.loyalty_tier        || 'Bronze',
    Loyalty_App_ID__c:      data.custom_fields?.loyalty_app_id || '',
  };

  let contact_id = existingId;

  if (existingId) {
    await fetchOrThrow(`${apiBase}/sobjects/Contact/${existingId}`, { method: 'PATCH', headers, body: JSON.stringify(sfData) });
  } else {
    if (data.email) {
      const q   = encodeURIComponent(`SELECT Id FROM Contact WHERE Email = '${data.email}' LIMIT 1`);
      const res = await fetchOrThrow(`${apiBase}/query?q=${q}`, { headers });
      contact_id = res.records?.[0]?.Id || null;
    }
    if (contact_id) {
      await fetchOrThrow(`${apiBase}/sobjects/Contact/${contact_id}`, { method: 'PATCH', headers, body: JSON.stringify(sfData) });
    } else {
      const res  = await fetchOrThrow(`${apiBase}/sobjects/Contact`, { method: 'POST', headers, body: JSON.stringify(sfData) });
      contact_id = res.id;
    }
  }

  if (eventType && contact_id) {
    await fetchOrThrow(`${apiBase}/sobjects/Task`, {
      method: 'POST', headers,
      body: JSON.stringify({
        WhoId: contact_id, Subject: `Mooadon: ${eventType}`,
        Description: JSON.stringify(eventData || {}), Status: 'Completed',
        ActivityDate: new Date().toISOString().split('T')[0],
      }),
    });
  }

  const latest = await fetchOrThrow(`${apiBase}/sobjects/Contact/${contact_id}?fields=FirstName,LastName,Email,Phone`, { headers });
  return {
    contact_id,
    from_crm_data: { full_name: `${latest.FirstName || ''} ${latest.LastName || ''}`.trim(), email: latest.Email, phone: latest.Phone },
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// 3. Pipedrive
// ════════════════════════════════════════════════════════════════════════════════

async function pipedrive(data, existingId, creds, eventType, eventData) {
  const token  = creds.api_token || Deno.env.get('PIPEDRIVE_API_TOKEN');
  const qs     = `api_token=${token}`;
  const base   = `https://api.pipedrive.com/v1`;
  const json   = { 'Content-Type': 'application/json' };

  const pdData = {
    name:  data.full_name || 'Mooadon Customer',
    email: data.email ? [{ value: data.email, primary: true }] : undefined,
    phone: data.phone ? [{ value: data.phone, primary: true }] : undefined,
  };

  let contact_id = existingId;

  if (existingId) {
    await fetchOrThrow(`${base}/persons/${existingId}?${qs}`, { method: 'PUT', headers: json, body: JSON.stringify(pdData) });
  } else {
    if (data.email) {
      const res = await fetchOrThrow(`${base}/persons/search?term=${encodeURIComponent(data.email)}&fields=email&${qs}`, {});
      contact_id = res.data?.items?.[0]?.item?.id ? String(res.data.items[0].item.id) : null;
    }
    if (contact_id) {
      await fetchOrThrow(`${base}/persons/${contact_id}?${qs}`, { method: 'PUT', headers: json, body: JSON.stringify(pdData) });
    } else {
      const res  = await fetchOrThrow(`${base}/persons?${qs}`, { method: 'POST', headers: json, body: JSON.stringify(pdData) });
      contact_id = String(res.data.id);
    }
  }

  await fetchOrThrow(`${base}/notes?${qs}`, {
    method: 'POST', headers: json,
    body: JSON.stringify({
      content:   `Loyalty — Tier: ${data.loyalty_tier} | Points: ${data.loyalty_points} | Total earned: ${data.total_points_earned}`,
      person_id: Number(contact_id),
    }),
  });

  if (eventType) {
    await fetchOrThrow(`${base}/notes?${qs}`, {
      method: 'POST', headers: json,
      body: JSON.stringify({ content: `Mooadon Event: ${eventType} — ${JSON.stringify(eventData || {})}`, person_id: Number(contact_id) }),
    });
  }

  const latest = await fetchOrThrow(`${base}/persons/${contact_id}?${qs}`, {});
  const p = latest.data || {};
  return {
    contact_id,
    from_crm_data: { full_name: p.name, email: p.email?.[0]?.value, phone: p.phone?.[0]?.value },
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// 4. Zoho CRM
// ════════════════════════════════════════════════════════════════════════════════

async function zoho(data, existingId, creds, eventType, eventData) {
  const clientId     = creds.client_id     || Deno.env.get('ZOHO_CLIENT_ID');
  const clientSecret = creds.client_secret || Deno.env.get('ZOHO_CLIENT_SECRET');
  const refreshToken = creds.refresh_token || Deno.env.get('ZOHO_REFRESH_TOKEN');

  const tokenRes = await fetchOrThrow(
    `https://accounts.zoho.com/oauth/v2/token?grant_type=refresh_token&client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}`,
    { method: 'POST' }
  );
  const headers = { 'Authorization': `Zoho-oauthtoken ${tokenRes.access_token}`, 'Content-Type': 'application/json' };
  const base = 'https://www.zohoapis.com/crm/v6';
  const { first, last } = splitName(data.full_name);

  const record = {
    First_Name: first, Last_Name: last, Email: data.email || '', Phone: data.phone || '',
    Loyalty_Points: data.loyalty_points || 0, Total_Points_Earned: data.total_points_earned || 0,
    Loyalty_Tier: data.loyalty_tier || 'Bronze', Loyalty_App_ID: data.custom_fields?.loyalty_app_id || '',
  };

  let contact_id = existingId;

  if (existingId) {
    await fetchOrThrow(`${base}/Contacts/${existingId}`, { method: 'PUT', headers, body: JSON.stringify({ data: [record] }) });
  } else {
    if (data.email) {
      const res = await fetchOrThrow(`${base}/Contacts/search?criteria=(Email:equals:${encodeURIComponent(data.email)})`, { headers });
      contact_id = res.data?.[0]?.id || null;
    }
    if (contact_id) {
      await fetchOrThrow(`${base}/Contacts/${contact_id}`, { method: 'PUT', headers, body: JSON.stringify({ data: [record] }) });
    } else {
      const res  = await fetchOrThrow(`${base}/Contacts`, { method: 'POST', headers, body: JSON.stringify({ data: [record] }) });
      contact_id = res.data[0].details.id;
    }
  }

  if (eventType && contact_id) {
    await fetchOrThrow(`${base}/Activities`, {
      method: 'POST', headers,
      body: JSON.stringify({
        data: [{
          Activity_Type: 'Others', Subject: `Mooadon: ${eventType}`,
          Description: JSON.stringify(eventData || {}), Due_Date: new Date().toISOString().split('T')[0],
          $se_module: 'Contacts', Who_Id: { id: contact_id },
        }],
      }),
    });
  }

  const latest = await fetchOrThrow(`${base}/Contacts/${contact_id}`, { headers });
  const p = latest.data?.[0] || {};
  return {
    contact_id,
    from_crm_data: { full_name: `${p.First_Name || ''} ${p.Last_Name || ''}`.trim(), email: p.Email, phone: p.Phone },
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// 5. Monday.com
// ════════════════════════════════════════════════════════════════════════════════

async function monday(data, existingId, creds, eventType, eventData) {
  const token   = creds.api_token || Deno.env.get('MONDAY_API_TOKEN');
  const boardId = creds.board_id;
  if (!boardId) throw new Error('Monday.com: board_id missing from api_credentials');

  const headers = { 'Authorization': token, 'Content-Type': 'application/json', 'API-Version': '2024-01' };
  const gql = async (query) => fetchOrThrow('https://api.monday.com/v2', { method: 'POST', headers, body: JSON.stringify({ query }) });

  const colVals = JSON.stringify({
    email:   { email: data.email || '', text: data.email || '' },
    phone:   { phone: data.phone || '', countryShortName: 'IL' },
    status:  { label: data.loyalty_tier || 'Bronze' },
    numbers: String(data.loyalty_points || 0),
    text:    String(data.total_points_earned || 0),
    text0:   data.custom_fields?.loyalty_app_id || '',
  }).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  let item_id = existingId;

  if (existingId) {
    await gql(`mutation { change_multiple_column_values(board_id:${boardId}, item_id:${existingId}, column_values:"${colVals}") { id } }`);
  } else {
    if (data.email) {
      const res = await gql(`query { items_page_by_column_values(board_id:${boardId}, columns:[{column_id:"email",column_values:["${data.email}"]}]) { items { id } } }`);
      item_id = res.data?.items_page_by_column_values?.items?.[0]?.id || null;
    }
    if (item_id) {
      await gql(`mutation { change_multiple_column_values(board_id:${boardId}, item_id:${item_id}, column_values:"${colVals}") { id } }`);
    } else {
      const name = (data.full_name || 'Mooadon Customer').replace(/"/g, '');
      const res  = await gql(`mutation { create_item(board_id:${boardId}, item_name:"${name}", column_values:"${colVals}") { id } }`);
      item_id    = res.data?.create_item?.id;
    }
  }

  if (eventType && item_id) {
    const body = `Mooadon: ${eventType} — ${JSON.stringify(eventData || {})}`.replace(/"/g, '\\"');
    await gql(`mutation { create_update(item_id:${item_id}, body:"${body}") { id } }`);
  }

  return { contact_id: String(item_id), from_crm_data: undefined };
}

// ════════════════════════════════════════════════════════════════════════════════
// 6. Freshsales
// ════════════════════════════════════════════════════════════════════════════════

async function freshsales(data, existingId, creds, eventType, eventData) {
  const apiKey  = creds.api_key || Deno.env.get('FRESHSALES_API_KEY');
  const domain  = creds.domain  || Deno.env.get('FRESHSALES_DOMAIN');
  const base    = `https://${domain}/api`;
  const headers = { 'Authorization': `Token token=${apiKey}`, 'Content-Type': 'application/json' };
  const { first, last } = splitName(data.full_name);

  const payload = {
    contact: {
      first_name: first, last_name: last, email: data.email || '', mobile_number: data.phone || '',
      custom_field: {
        loyalty_points: data.loyalty_points || 0, total_points_earned: data.total_points_earned || 0,
        loyalty_tier: data.loyalty_tier || 'Bronze', loyalty_app_id: data.custom_fields?.loyalty_app_id || '',
      },
    },
  };

  let contact_id = existingId;

  if (existingId) {
    await fetchOrThrow(`${base}/contacts/${existingId}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
  } else {
    if (data.email) {
      const res = await fetchOrThrow(`${base}/contacts/autocomplete?q=${encodeURIComponent(data.email)}`, { headers });
      contact_id = res.contacts?.[0]?.id ? String(res.contacts[0].id) : null;
    }
    if (contact_id) {
      await fetchOrThrow(`${base}/contacts/${contact_id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
    } else {
      const res  = await fetchOrThrow(`${base}/contacts`, { method: 'POST', headers, body: JSON.stringify(payload) });
      contact_id = String(res.contact.id);
    }
  }

  if (eventType && contact_id) {
    await fetchOrThrow(`${base}/notes`, {
      method: 'POST', headers,
      body: JSON.stringify({
        note: { description: `Mooadon: ${eventType} — ${JSON.stringify(eventData || {})}`, targetable_type: 'Contact', targetable_id: Number(contact_id) },
      }),
    });
  }

  const latest = await fetchOrThrow(`${base}/contacts/${contact_id}`, { headers });
  const p = latest.contact || {};
  return {
    contact_id,
    from_crm_data: { full_name: `${p.first_name || ''} ${p.last_name || ''}`.trim(), email: p.email, phone: p.mobile_number },
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// 7. Microsoft Dynamics 365
// ════════════════════════════════════════════════════════════════════════════════

async function dynamics(data, existingId, creds, eventType, eventData) {
  const clientId     = creds.client_id     || Deno.env.get('DYNAMICS_CLIENT_ID');
  const clientSecret = creds.client_secret || Deno.env.get('DYNAMICS_CLIENT_SECRET');
  const tenantId     = creds.tenant_id     || Deno.env.get('DYNAMICS_TENANT_ID');
  const orgUrl       = creds.org_url       || Deno.env.get('DYNAMICS_ORG_URL');

  const tokenRes = await fetchOrThrow(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: `${orgUrl}/.default` }).toString(),
  });

  const headers = {
    'Authorization': `Bearer ${tokenRes.access_token}`, 'Content-Type': 'application/json',
    'OData-MaxVersion': '4.0', 'OData-Version': '4.0', 'Prefer': 'return=representation',
  };
  const base = `${orgUrl}/api/data/v9.2`;
  const { first, last } = splitName(data.full_name);

  const dynData = {
    firstname: first, lastname: last,
    emailaddress1: data.email || '', mobilephone: data.phone || '',
    description: `Loyalty — Tier: ${data.loyalty_tier} | Points: ${data.loyalty_points} | Total: ${data.total_points_earned}`,
  };

  let contact_id = existingId;

  if (existingId) {
    await fetchOrThrow(`${base}/contacts(${existingId})`, { method: 'PATCH', headers, body: JSON.stringify(dynData) });
  } else {
    if (data.email) {
      const res = await fetchOrThrow(`${base}/contacts?$filter=emailaddress1 eq '${data.email}'&$top=1&$select=contactid`, { headers });
      contact_id = res.value?.[0]?.contactid || null;
    }
    if (contact_id) {
      await fetchOrThrow(`${base}/contacts(${contact_id})`, { method: 'PATCH', headers, body: JSON.stringify(dynData) });
    } else {
      const res  = await fetchOrThrow(`${base}/contacts`, { method: 'POST', headers, body: JSON.stringify(dynData) });
      contact_id = res.contactid;
    }
  }

  if (eventType && contact_id) {
    await fetchOrThrow(`${base}/phonecalls`, {
      method: 'POST', headers,
      body: JSON.stringify({
        subject: `Mooadon: ${eventType}`, description: JSON.stringify(eventData || {}),
        actualdurationminutes: 0, directioncode: false,
        'regardingobjectid_contact@odata.bind': `/contacts(${contact_id})`,
      }),
    });
  }

  const latest = await fetchOrThrow(`${base}/contacts(${contact_id})?$select=firstname,lastname,emailaddress1,mobilephone`, { headers });
  return {
    contact_id,
    from_crm_data: { full_name: `${latest.firstname || ''} ${latest.lastname || ''}`.trim(), email: latest.emailaddress1, phone: latest.mobilephone },
  };
}