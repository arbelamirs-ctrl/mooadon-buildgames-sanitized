import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const terminalId = Deno.env.get('TRANZILA_TERMINAL_ID');
    const tranzilaSecretKey = Deno.env.get('TRANZILA_SECRET_KEY');

    if (!terminalId || !tranzilaSecretKey) {
      return Response.json({ error: 'Tranzila not configured' }, { status: 500 });
    }

    // ✅ FIX: Read raw body for HMAC verification
    const rawBody = await req.text();
    
    // ✅ FIX: Verify HMAC-SHA256 signature from Tranzila
    const signature = req.headers.get('x-tranzila-signature');
    if (!signature) {
      console.warn('❌ Missing HMAC signature from Tranzila');
      return Response.json({ error: 'Missing signature' }, { status: 401 });
    }

    const isValid = await verifyTranzilaSignature(rawBody, signature, tranzilaSecretKey);
    if (!isValid) {
      console.warn('❌ Invalid HMAC signature from Tranzila');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const formData = await new Response(rawBody).formData();
    const params = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value;
    }

    console.log('✅ Tranzila callback verified & received:', params);

    const transaction_id = params.custom_data || params.transaction_id;
    const responseCode = params.Response || params.response;
    const tranzilaTransactionId = params.index || params.transaction_id;

    if (!transaction_id) {
      return Response.json({ error: 'Missing transaction_id' }, { status: 400 });
    }

    const transactions = await base44.asServiceRole.entities.PaymentTransaction.filter({ transaction_id });

    if (!transactions || transactions.length === 0) {
      console.error('PaymentTransaction not found:', transaction_id);
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const paymentTransaction = transactions[0];
    const isSuccess = responseCode === '000';

    if (isSuccess) {
      await base44.asServiceRole.entities.PaymentTransaction.update(paymentTransaction.id, {
        payment_status: 'completed',
        tranzila_transaction_id: tranzilaTransactionId,
        metadata: {
          ...paymentTransaction.metadata,
          tranzila_response: params,
          completed_at: new Date().toISOString()
        }
      });

      console.log('Tranzila payment succeeded:', transaction_id);

      await base44.asServiceRole.entities.AuditLog.create({
        company_id: paymentTransaction.company_id,
        action: 'tranzila_payment_completed',
        entity_type: 'PaymentTransaction',
        entity_id: paymentTransaction.id,
        performed_by: 'system',
        details: {
          transaction_id,
          tranzila_transaction_id: tranzilaTransactionId,
          amount: paymentTransaction.amount,
          currency: paymentTransaction.currency
        }
      });
    } else {
      await base44.asServiceRole.entities.PaymentTransaction.update(paymentTransaction.id, {
        payment_status: 'failed',
        tranzila_transaction_id: tranzilaTransactionId,
        metadata: {
          ...paymentTransaction.metadata,
          tranzila_response: params,
          failed_at: new Date().toISOString(),
          failure_reason: params.error_message || `Tranzila error code: ${responseCode}`
        }
      });

      console.log('Tranzila payment failed:', transaction_id, responseCode);

      await base44.asServiceRole.entities.AuditLog.create({
        company_id: paymentTransaction.company_id,
        action: 'tranzila_payment_failed',
        entity_type: 'PaymentTransaction',
        entity_id: paymentTransaction.id,
        performed_by: 'system',
        details: {
          transaction_id,
          tranzila_transaction_id: tranzilaTransactionId,
          response_code: responseCode,
          error_message: params.error_message
        }
      });
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error('Tranzila webhook error:', error);
    return Response.json({ error: error.message || 'Webhook processing failed' }, { status: 500 });
  }
});

// ✅ FIX: HMAC-SHA256 verification helper
async function verifyTranzilaSignature(body, signature, secret) {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expected = Array.from(new Uint8Array(sigBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return signature.toLowerCase() === expected.toLowerCase();
  } catch (err) {
    console.error('HMAC verification error:', err.message);
    return false;
  }
}