import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * sendNewClientWelcome
 *
 * Sends a WhatsApp welcome message to a newly created client.
 * Called automatically via entity automation on Client.create
 *
 * Flow:
 *   1. New client created in POS
 *   2. Automation triggers this function
 *   3. WhatsApp sent with profiling link
 *   4. Client completes profile → gets free gift coupon on next visit
 */

const PROFILE_BASE_URL = 'https://mooadon.base44.app/ClientOnboarding';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'POST only' }, { status: 405 });
    }

    const body = await req.json();

    // Support both direct call and entity automation payload
    let client_id, company_id, phone;

    let force = false;
    if (body.event) {
      // Called from entity automation
      const data = body.data;
      if (!data) return Response.json({ success: true, skipped: true, reason: 'no_data' });
      client_id  = data.id;
      company_id = data.company_id;
      phone      = data.phone;
    } else {
      // Direct call
      client_id  = body.client_id;
      company_id = body.company_id;
      phone      = body.phone;
      force      = !!body.force;
    }

    if (!client_id || !company_id || !phone) {
      return Response.json({ error: 'client_id, company_id, phone are required' }, { status: 400 });
    }

    // Fetch company details
    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    if (!companies.length) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }
    const company = companies[0];
    const companyName = company.name || 'our store';

    // Guard: only send once per client
    const existingLogs = await base44.asServiceRole.entities.SMSLog.filter({
      company_id,
      client_id,
      message_type: 'welcome',
    });

    if (existingLogs.length > 0 && !force) {
      console.log(`[sendNewClientWelcome] Already sent to client:${client_id} — skipping`);
      return Response.json({ success: true, skipped: true, reason: 'already_sent' });
    }

    // Build profile link
    const profileUrl = `${PROFILE_BASE_URL}?client_id=${client_id}&company_id=${company_id}&ref=welcome`;

    // Build message
    const message = buildWelcomeMessage(companyName, profileUrl);

    console.log(`[sendNewClientWelcome] Sending to ${phone} for company:${companyName}`);

    // Send WhatsApp
    const waResult = await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
      phone,
      message,
      company_id,
    });

    const waData = waResult.data;
    const success = waData?.success === true;

    // Log the send
    await base44.asServiceRole.entities.SMSLog.create({
      company_id,
      client_id,
      client_phone: phone,
      message_type: 'welcome',
      message_content: message,
      status: success ? 'sent' : 'failed',
      sent_at: success ? new Date().toISOString() : null,
      error_message: success ? null : (waData?.error || 'Unknown error'),
    }).catch(() => {});

    if (!success) {
      console.warn(`[sendNewClientWelcome] WhatsApp failed for ${phone}:`, waData?.error);
      return Response.json({ success: false, error: waData?.error || 'WhatsApp send failed' });
    }

    console.log(`[sendNewClientWelcome] ✅ Sent to ${phone}`);

    return Response.json({
      success: true,
      skipped: false,
      phone,
      company_name: companyName,
      profile_url: profileUrl,
    });

  } catch (error) {
    console.error('[sendNewClientWelcome] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function buildWelcomeMessage(companyName, profileUrl) {
  return `👋 ברוכים הבאים ל-${companyName}!

נרשמת לתוכנית הנאמנות שלנו. שמחים שהצטרפת! 🎉

להשלמת הפרופיל שלך ולקבלת *מתנה בחינם בביקור הבא*, לחץ על הקישור:
${profileUrl}

לוקח פחות מדקה. נתראה בקרוב! 😊`;
}