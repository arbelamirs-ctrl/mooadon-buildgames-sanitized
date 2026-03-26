import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { benefit_id, benefit_type, client_ids, channel, company_id } = await req.json();
    
    if (!benefit_id || !benefit_type || !channel) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const company = await base44.asServiceRole.entities.Company.get(company_id);
    
    // FIX: Resolve Twilio credentials with proper fallback (same pattern as rest of codebase)
    const twilioSid = (company?.twilio_account_sid || '').trim() || Deno.env.get('TWILIO_ACCOUNT_SID') || null;
    const twilioToken = (company?.twilio_auth_token || '').trim() || Deno.env.get('TWILIO_AUTH_TOKEN') || null;
    const twilioWhatsApp = (company?.whatsapp_phone_number || '').trim() 
      || Deno.env.get('TWILIO_WHATSAPP_NUMBER') 
      || '+14155238886';
    
    // Generate unique code
    const generateCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

    // Helper: send WhatsApp via Twilio REST API
    const sendWhatsApp = async (toPhone, message) => {
      if (!twilioSid || !twilioToken) {
        console.warn('⚠️ Twilio credentials not configured - skipping WhatsApp');
        return false;
      }
      const formattedTo = toPhone.startsWith('+') ? toPhone : `+${toPhone}`;
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To:   `whatsapp:${formattedTo}`,
            From: `whatsapp:${twilioWhatsApp}`,
            Body: message,
          }),
        }
      );
      if (!resp.ok) {
        const err = await resp.text();
        console.error('❌ Twilio WhatsApp error:', err);
        return false;
      }
      return true;
    };
    
    const distributions = [];
    
    // If specific clients, send to them
    if (client_ids && client_ids.length > 0) {
      for (const client_id of client_ids) {
        const client = await base44.asServiceRole.entities.Client.get(client_id);
        const code = generateCode();
        const qrCode = `MOOADON-${benefit_type.toUpperCase()}-${code}`;
        
        const distribution = await base44.asServiceRole.entities.BenefitDistribution.create({
          benefit_id,
          benefit_type,
          company_id,
          client_id,
          distribution_channel: channel,
          qr_code: qrCode,
          redemption_code: code,
          status: 'pending',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });
        
        // Send via chosen channel
        if ((channel === 'sms' || channel === 'whatsapp') && client?.phone) {
          const message = `${company?.name || 'A store'} sent you a reward!\nType: ${benefit_type}\nCode: ${code}\nShow this at checkout to redeem.`;
          
          const sent = await sendWhatsApp(client.phone, message);
          
          await base44.asServiceRole.entities.BenefitDistribution.update(distribution.id, {
            status: sent ? 'sent' : 'pending',
            sent_at: sent ? new Date().toISOString() : null
          });
        }
        
        distributions.push(distribution);
      }
    }

    return Response.json({
      success: true,
      distributions,
      count: distributions.length
    });

  } catch (error) {
    console.error('Distribution error:', error);
    return Response.json({ 
      error: error.message || 'Distribution failed',
      details: error.toString()
    }, { status: 500 });
  }
});