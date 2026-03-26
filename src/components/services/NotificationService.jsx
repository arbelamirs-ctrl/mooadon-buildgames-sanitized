/**
 * Notification Service
 * Handles SMS (Twilio), Email (SendGrid), and Push notifications
 */

export class NotificationService {
  constructor(config = {}) {
    this.twilioAccountSid = config.twilioAccountSid || Deno.env.get('TWILIO_ACCOUNT_SID');
    this.twilioAuthToken = config.twilioAuthToken || Deno.env.get('TWILIO_AUTH_TOKEN');
    this.twilioPhoneNumber = config.twilioPhoneNumber || Deno.env.get('TWILIO_PHONE_NUMBER');
    this.sendgridApiKey = config.sendgridApiKey || Deno.env.get('SENDGRID_API_KEY');
    this.sendgridFromEmail = config.sendgridFromEmail || Deno.env.get('SENDGRID_FROM_EMAIL') || 'noreply@mooadon.com';
  }

  /**
   * Send SMS via Twilio
   */
  async sendSMS(to, message) {
    if (!this.twilioAccountSid || !this.twilioAuthToken || !this.twilioPhoneNumber) {
      throw new Error('Twilio credentials not configured');
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`;
    const auth = btoa(`${this.twilioAccountSid}:${this.twilioAuthToken}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: to,
        From: this.twilioPhoneNumber,
        Body: message
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Twilio error: ${data.message || 'Unknown error'}`);
    }

    return {
      success: true,
      messageId: data.sid,
      status: data.status,
      to: data.to,
      from: data.from
    };
  }

  /**
   * Send Email via SendGrid
   */
  async sendEmail(to, subject, htmlContent, textContent = null) {
    if (!this.sendgridApiKey) {
      throw new Error('SendGrid API key not configured');
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.sendgridApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }]
        }],
        from: { email: this.sendgridFromEmail, name: 'Mooadon' },
        subject: subject,
        content: [
          {
            type: 'text/html',
            value: htmlContent
          },
          ...(textContent ? [{
            type: 'text/plain',
            value: textContent
          }] : [])
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SendGrid error: ${errorText}`);
    }

    return {
      success: true,
      to: to,
      subject: subject
    };
  }

  /**
   * Send Push Notification (Placeholder for future implementation)
   */
  async sendPushNotification(deviceToken, title, body, data = {}) {
    // TODO: Implement FCM or APNs integration
    console.log('Push notification not yet implemented', { deviceToken, title, body, data });
    return {
      success: false,
      error: 'Push notifications not yet implemented'
    };
  }

  /**
   * Replace template variables
   */
  static replaceVariables(template, variables) {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value || '');
    }
    return result;
  }
}

export default NotificationService;