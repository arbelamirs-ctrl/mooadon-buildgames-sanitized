/**
 * Twilio SMS Service
 * Sends SMS notifications using Twilio REST API
 */

class TwilioService {
  /**
   * Send SMS using Twilio API
   * @param {string} accountSid - Twilio Account SID
   * @param {string} authToken - Twilio Auth Token
   * @param {string} fromPhone - Twilio phone number
   * @param {string} toPhone - Recipient phone number
   * @param {string} message - SMS message content
   * @returns {Promise<object>} - Response from Twilio API
   */
  static async sendSMS(accountSid, authToken, fromPhone, toPhone, message) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      
      // Format for WhatsApp - use the provided fromPhone (company's WhatsApp Business number)
      const from = `whatsapp:${fromPhone}`;
      const to = `whatsapp:${toPhone}`;
      
      const formData = new URLSearchParams();
      formData.append('From', from);
      formData.append('To', to);
      formData.append('Body', message);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send SMS');
      }

      return {
        success: true,
        messageId: data.sid,
        status: data.status,
        data: data
      };
    } catch (error) {
      console.error('Twilio SMS Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send transaction notification SMS
   * @param {object} company - Company object with Twilio credentials
   * @param {string} phoneNumber - Customer phone number
   * @param {string} companyName - Company name
   * @param {number} points - Points earned
   * @param {string} claimURL - URL to claim rewards
   * @returns {Promise<object>}
   */
  static async sendTransactionSMS(company, phoneNumber, companyName, points, claimURL) {
    if (!company.twilio_account_sid || !company.twilio_auth_token || !company.twilio_phone_number) {
      return {
        success: false,
        error: 'Twilio credentials not configured for this company'
      };
    }

    const message = `Thank you for your purchase at ${companyName}! You earned ${points} points. Claim your reward: ${claimURL}`;

    return this.sendSMS(
      company.twilio_account_sid,
      company.twilio_auth_token,
      company.twilio_phone_number,
      phoneNumber,
      message
    );
  }

  /**
   * Test SMS - sends a test message
   */
  static async sendTestSMS(accountSid, authToken, fromPhone, toPhone) {
    const message = 'This is a test message from your Loyalty Platform. Twilio integration is working!';
    return this.sendSMS(accountSid, authToken, fromPhone, toPhone, message);
  }
}

export default TwilioService;