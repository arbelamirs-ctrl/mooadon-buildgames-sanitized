import { base44 } from '@/api/base44Client';

class SMSService {
  // שליחת SMS עם לוגים
  async sendSMS({ companyId, clientId, clientPhone, transactionId, messageType, template, variables }) {
    try {
      // החלפת משתנים בתבנית
      let message = template;
      Object.keys(variables).forEach(key => {
        message = message.replace(new RegExp(`{${key}}`, 'g'), variables[key]);
      });

      // רישום ב-log
      const smsLog = await base44.entities.SMSLog.create({
        company_id: companyId,
        client_id: clientId,
        client_phone: clientPhone,
        transaction_id: transactionId,
        message_type: messageType,
        message_content: message,
        status: 'pending'
      });

      // Send via backend function (credentials stay server-side)
      await this.sendViaWhatsApp(smsLog.id, message, clientPhone, companyId);

      return { success: true, smsLogId: smsLog.id, message };
    } catch (error) {
      console.error('Error sending SMS:', error);
      return { success: false, error: error.message };
    }
  }

  // Send WhatsApp message via backend function (keeps credentials server-side)
  async sendViaWhatsApp(logId, message, phone, companyId) {
    try {
      if (!companyId) {
        throw new Error('companyId required for WhatsApp sending');
      }

      const result = await base44.functions.invoke('sendWhatsAppMessage', {
        phone,
        message,
        company_id: companyId
      });

      if (result?.data?.success) {
        await base44.entities.SMSLog.update(logId, {
          status: 'sent',
          sent_at: new Date().toISOString()
        });
      } else {
        throw new Error(result?.data?.error || 'sendWhatsAppMessage returned failure');
      }
    } catch (err) {
      console.error('WhatsApp send error:', err);
      await base44.entities.SMSLog.update(logId, {
        status: 'failed',
        error_message: err.message
      });
    }
  }

  // שליחת SMS עבור צבירת נקודות
  async sendPointsEarnedSMS(companyId, transaction, client, company) {
    const template = company.sms_template || 'הי {client_name}! זכית ב-{points} נקודות. יתרתך: {balance} {points_name}. {link}';
    
    return this.sendSMS({
      companyId,
      clientId: client.id,
      clientPhone: transaction.client_phone,
      transactionId: transaction.id,
      messageType: 'points_earned',
      template,
      variables: {
        client_name: client.full_name || 'לקוח יקר',
        points: transaction.points_expected,
        balance: client.current_balance,
        points_name: company.points_name || 'נקודות',
        link: transaction.claim_url || ''
      }
    });
  }

  // שליחת SMS עבור מימוש נקודות
  async sendPointsRedeemedSMS(companyId, redemption, client, company) {
    const template = company.sms_template_redeem || 'הי {client_name}! מימשת {points} {points_name}. יתרתך החדשה: {balance}. תודה שבחרת בנו!';
    
    return this.sendSMS({
      companyId,
      clientId: client.id,
      clientPhone: client.phone,
      transactionId: null,
      messageType: 'points_redeemed',
      template,
      variables: {
        client_name: client.full_name || 'לקוח יקר',
        points: Math.abs(redemption.points),
        balance: client.current_balance,
        points_name: company.points_name || 'נקודות'
      }
    });
  }

  // שליחת SMS מבצע
  async sendPromotionSMS(companyId, client, company, promotionText) {
    const template = company.sms_template_promotion || 'הי {client_name}! {promotion_text}';
    
    return this.sendSMS({
      companyId,
      clientId: client.id,
      clientPhone: client.phone,
      transactionId: null,
      messageType: 'promotion',
      template,
      variables: {
        client_name: client.full_name || 'לקוח יקר',
        promotion_text: promotionText,
        points_name: company.points_name || 'נקודות'
      }
    });
  }

  // שליחת SMS מותאם אישית
  async sendCustomSMS(companyId, clientPhone, message) {
    return this.sendSMS({
      companyId,
      clientId: null,
      clientPhone,
      transactionId: null,
      messageType: 'custom',
      template: message,
      variables: {}
    });
  }
}

export default new SMSService();