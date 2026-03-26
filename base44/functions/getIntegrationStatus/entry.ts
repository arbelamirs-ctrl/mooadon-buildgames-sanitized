import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { company_id } = body;
    if (!company_id) return Response.json({ error: 'Missing company_id' }, { status: 400 });

    const [companies, tokens, branches, priorityConns, tranzilaConns, crmConfigs, shopifyConns, wooConns, stripeConns] = await Promise.all([
      base44.asServiceRole.entities.Company.filter({ id: company_id }).catch(() => []),
      base44.asServiceRole.entities.CompanyToken.filter({ company_id }).catch(() => []),
      base44.asServiceRole.entities.Branch.filter({ company_id }).catch(() => []),
      base44.asServiceRole.entities.IntegrationConnection.filter({ company_id, integration_type: 'priority' }).catch(() => []),
      base44.asServiceRole.entities.TranzilaConnection.filter({ company_id }).catch(() => []),
      base44.asServiceRole.entities.CRMConfig.filter({ company_id }).catch(() => []),
      base44.asServiceRole.entities.IntegrationConnection.filter({ company_id, integration_type: 'shopify' }).catch(() => []),
      base44.asServiceRole.entities.IntegrationConnection.filter({ company_id, integration_type: 'woocommerce' }).catch(() => []),
      base44.asServiceRole.entities.IntegrationConnection.filter({ company_id, integration_type: 'stripe' }).catch(() => []),
    ]);

    const company = companies[0];
    if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });

    const activeTokens = tokens.filter(t => t.is_active !== false && t.contract_address);
    const companyToken = activeTokens[0] || tokens[0] || null;
    const activeBranches = branches.filter(b => b.status === 'active');

    // POS integrations
    const priorityConn = priorityConns[0];
    const tranzilaConn = tranzilaConns[0];
    const hasWebhookPOS = !!(company.pos_type === 'webhook' || company.pos_api_key);

    // CRM
    const crmConfig = crmConfigs[0];
    const hasTwilio = !!(company.twilio_account_sid && company.twilio_phone_number);

    // Store
    const shopifyConn = shopifyConns[0];
    const wooConn = wooConns[0];
    const hasShopify = !!(shopifyConn?.is_active || company.shopify_shop_domain);
    const hasWoo = !!(wooConn?.is_active || company.woocommerce_url);

    // Payment
    const stripeConn = stripeConns[0];
    const hasStripe = !!(stripeConn?.is_active || company.stripe_customer_id);
    const hasTranzila = !!(tranzilaConn?.is_active);

    // Health score
    let healthScore = 0;
    if (priorityConn?.is_active || tranzilaConn?.is_active || hasWebhookPOS) healthScore += 25;
    if (hasTwilio || crmConfig?.is_active) healthScore += 25;
    if (companyToken?.contract_address) healthScore += 25;
    if (hasShopify || hasWoo) healthScore += 25;

    // Recommendations
    const recommendations = [];
    const next_steps = [];

    if (!priorityConn?.is_active && !tranzilaConn?.is_active && !hasWebhookPOS) {
      recommendations.push({ title: 'Connect your POS', description: 'Link Priority, Tranzila or use a webhook to sync sales.' });
      next_steps.push({ order: 1, title: 'Set up POS integration', description: 'Go to the POS tab to connect your system.', complete: false });
    } else {
      next_steps.push({ order: 1, title: 'POS connected', description: '', complete: true });
    }

    if (!hasTwilio && !crmConfig?.is_active) {
      recommendations.push({ title: 'Connect CRM / SMS', description: 'Add Twilio to send customers reward notifications.' });
      next_steps.push({ order: 2, title: 'Configure CRM / SMS', description: 'Go to the CRM tab to add credentials.', complete: false });
    } else {
      next_steps.push({ order: 2, title: 'CRM configured', description: '', complete: true });
    }

    if (!companyToken?.contract_address) {
      recommendations.push({ title: 'Deploy loyalty token', description: 'Deploy your smart contract on Avalanche to enable on-chain rewards.' });
      next_steps.push({ order: 3, title: 'Deploy token contract', description: 'Go to Token Management to deploy.', complete: false });
    } else {
      next_steps.push({ order: 3, title: 'Token deployed', description: '', complete: true });
    }

    return Response.json({
      health_score: healthScore,
      integrations: {
        pos: {
          priority: {
            connected: !!(priorityConn?.is_active),
            company_id: priorityConn?.external_id || null,
            branch_count: activeBranches.length,
          },
          tranzila: {
            connected: !!(tranzilaConn?.is_active),
            terminal: tranzilaConn?.terminal_name || null,
          },
          generic_pos: {
            configured: hasWebhookPOS,
            pos_type: company.pos_type || null,
          },
        },
        crm: {
          connected: hasTwilio || !!(crmConfig?.is_active),
          name: crmConfig?.crm_type || (hasTwilio ? 'Twilio' : null),
          last_sync: crmConfig?.last_sync_at || null,
        },
        online_store: {
          shopify: {
            connected: hasShopify,
            shop_domain: shopifyConn?.shop_domain || company.shopify_shop_domain || null,
          },
          woocommerce: {
            connected: hasWoo,
            url: wooConn?.shop_url || company.woocommerce_url || null,
          },
        },
        payment: {
          stripe: {
            connected: hasStripe,
            customer_id: company.stripe_customer_id || null,
          },
          tranzila: {
            connected: hasTranzila,
          },
          blockchain: {
            connected: !!(companyToken?.contract_address),
            network: company.onchain_network || null,
            contract_address: companyToken?.contract_address || null,
            token_symbol: companyToken?.token_symbol || null,
          },
        },
      },
      recommendations,
      next_steps,
    });

  } catch (error) {
    console.error('getIntegrationStatus error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});