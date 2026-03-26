import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function generateOrderId() {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `ORD-${digits}`;
}

async function sendSMS(twilioSid, twilioToken, twilioPhone, toPhone, message) {
  const formattedTo = toPhone.startsWith('+') ? toPhone : `+${toPhone}`;
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioToken}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ To: formattedTo, From: twilioPhone, Body: message })
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'SMS failed');
  return data.sid;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { product_id, client_id, company_id } = await req.json();
    if (!product_id || !client_id || !company_id) {
      return Response.json({ error: 'product_id, client_id and company_id are required' }, { status: 400 });
    }

    // Fetch product, client, company in parallel
    const [products, clients, companies] = await Promise.all([
      base44.asServiceRole.entities.Product.filter({ id: product_id }),
      base44.asServiceRole.entities.Client.filter({ id: client_id }),
      base44.asServiceRole.entities.Company.filter({ id: company_id })
    ]);

    if (!products.length) return Response.json({ error: 'Product not found' }, { status: 404 });
    if (!clients.length) return Response.json({ error: 'Client not found' }, { status: 404 });
    if (!companies.length) return Response.json({ error: 'Company not found' }, { status: 404 });

    const product = products[0];
    const client = clients[0];
    const company = companies[0];

    // ── Cross-company validation ────────────────────────────────────────────
    if (product.company_id !== company_id) {
      return Response.json({ error: 'Product does not belong to this company' }, { status: 403 });
    }
    if (client.company_id !== company_id) {
      return Response.json({ error: 'Client does not belong to this company' }, { status: 403 });
    }

    // ── PLAN GATING ────────────────────────────────────────────────────────────
    const planTier = company.plan_tier || 'basic';
    const planStatus = company.plan_status || 'active';
    const effectiveTier = (planStatus === 'past_due' || planStatus === 'canceled') ? 'basic' : planTier;
    if (effectiveTier === 'basic') {
      return Response.json({
        error: 'Store purchases require an Advanced or Pro plan. Please upgrade.',
        upgrade_required: true,
        required_tier: 'advanced',
        current_tier: effectiveTier
      }, { status: 403 });
    }

    if ((client.current_balance || 0) < product.price_tokens) {
      return Response.json({ error: 'Insufficient token balance' }, { status: 400 });
    }
    if (product.stock_quantity <= 0) {
      return Response.json({ error: 'Out of stock' }, { status: 400 });
    }

    const orderId = generateOrderId();
    const now = new Date().toISOString();

    // 1. Create WalletStoreOrder
    const order = await base44.asServiceRole.entities.WalletStoreOrder.create({
      order_id: orderId,
      customer_id: client.id,
      customer_phone: client.phone,
      company_id: company.id,
      product_id: product.id,
      product_name: product.name,
      price_tokens: product.price_tokens,
      status: 'pending',
      created_at: now
    });

    // 2. Deduct tokens from client + reduce stock
    await Promise.all([
      base44.asServiceRole.entities.Client.update(client.id, {
        current_balance: client.current_balance - product.price_tokens,
        total_redeemed: (client.total_redeemed || 0) + product.price_tokens
      }),
      base44.asServiceRole.entities.Product.update(product.id, {
        stock_quantity: product.stock_quantity - 1
      })
    ]);

    // 3. Audit log
    await base44.asServiceRole.entities.AuditLog.create({
      company_id: company.id,
      action: 'wallet_store_purchase',
      entity_type: 'Order',
      entity_id: orderId,
      performed_by: user.id || 'system',
      details: {
        product_name: product.name,
        tokens: product.price_tokens,
        customer_phone: client.phone,
        order_id: orderId
      }
    });

    // 4. Send SMS (fire-and-forget — non-blocking)
    const twilioSid = company.twilio_account_sid || Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioToken = company.twilio_auth_token || Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhone = company.twilio_phone_number || Deno.env.get('TWILIO_PHONE_NUMBER') || '+16812498172';
    const businessPhone = company.phone_number || company.phone;

    if (twilioSid && twilioToken) {
      // SMS to customer
      sendSMS(
        twilioSid, twilioToken, twilioPhone, client.phone,
        `Your order #${orderId} is confirmed! You redeemed ${product.price_tokens} tokens for ${product.name} from ${company.name}. We'll contact you shortly to arrange delivery. - Mooadon`
      ).catch(e => console.warn('Customer SMS failed (non-critical):', e.message));

      // SMS to business
      if (businessPhone) {
        sendSMS(
          twilioSid, twilioToken, twilioPhone, businessPhone,
          `New store order! Customer ${client.phone} purchased ${product.name} for ${product.price_tokens} tokens. Order #${orderId}. Please contact the customer to arrange delivery. - Mooadon`
        ).catch(e => console.warn('Business SMS failed (non-critical):', e.message));
      }
    } else {
      console.warn('Twilio not configured — SMS skipped');
    }

    return Response.json({
      success: true,
      order_id: orderId,
      order: order,
      message: `Order ${orderId} created successfully`
    });

  } catch (error) {
    console.error('walletStorePurchase error:', error.message);
    return Response.json({ error: error.message || 'Purchase failed' }, { status: 500 });
  }
});