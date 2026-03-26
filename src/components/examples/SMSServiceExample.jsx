import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from 'lucide-react';
import { toast } from "sonner";

export default function SMSServiceExample() {
  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('The code has been copied.');
  };

  const twilioExample = `// services/smsService.js
import twilio from 'twilio';

class SMSService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  async sendClaimSMS(transaction, company) {
    const template = company.sms_template || 
      "Hello! You deserve it.{{points}} {{points_name}} from-{{company_name}}. Click to confirm: {{link}}";
    
    const message = template
      .replace('{{points}}', transaction.points_expected)
      .replace('{{points_name}}', company.points_name || 'Points')
      .replace('{{company_name}}', company.name)
      .replace('{{link}}', transaction.claim_url)
      .replace('{{amount}}', transaction.amount);
    
    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: this.normalizePhone(transaction.client_phone),
        statusCallback: \`\${process.env.APP_URL}/webhooks/sms-status\`
      });
      
      return {
        success: true,
        messageId: result.sid,
        status: result.status
      };
    } catch (error) {
      console.error('SMS send failed:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  normalizePhone(phone) {
    // Convert Israeli format to international
    // 050-1234567 -> +972501234567
    let normalized = phone.replace(/[^0-9]/g, '');
    
    if (normalized.startsWith('0')) {
      normalized = '972' + normalized.substring(1);
    }
    
    return '+' + normalized;
  }

  async getMessageStatus(messageId) {
    const message = await this.client.messages(messageId).fetch();
    return {
      status: message.status,  // queued, sent, delivered, failed
      errorCode: message.errorCode,
      errorMessage: message.errorMessage
    };
  }
}

export default new SMSService();`;

  const usageExample = `// Backend Function: createTransaction
import smsService from './services/smsService';

export default async function createTransaction(request, context) {
  const { client_phone, amount, order_id } = request.body;
  const user = context.user;
  
  // ... create transaction logic ...
  
  // Send SMS
  const smsResult = await smsService.sendClaimSMS(transaction, company);
  
  // Update transaction with SMS status
  await context.base44.entities.Transaction.update(transaction.id, {
    sms_status: smsResult.success ? 'sent' : 'failed',
    sms_sent_at: new Date().toISOString(),
    sms_error: smsResult.error || null
  });
  
  return { 
    status: 'success', 
    transaction,
    sms_sent: smsResult.success
  };
}`;

  const retryExample = `// Retry logic with exponential backoff
async function sendWithRetry(transaction, company, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await smsService.sendClaimSMS(transaction, company);
      
      if (result.success) {
        return result;
      }
      
      lastError = result.error;
      
      // Wait before retry: 1s, 2s, 4s
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
      }
    } catch (error) {
      lastError = error.message;
    }
  }
  
  // All retries failed
  throw new Error(\`SMS failed after \${maxRetries} attempts: \${lastError}\`);
}`;

  return (
    <div className="space-y-4" dir="rtl">
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Twilio SMS Service</CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => copyCode(twilioExample)}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto" dir="ltr">
            {twilioExample}
          </pre>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Usage Example</CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => copyCode(usageExample)}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto" dir="ltr">
            {usageExample}
          </pre>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Retry Logic</CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => copyCode(retryExample)}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto" dir="ltr">
            {retryExample}
          </pre>
        </CardContent>
      </Card>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
        <h3 className="font-semibold text-amber-800 mb-2">⚠️ Configuration Required</h3>
        <ul className="text-amber-700 space-y-1">
          <li>1. Create Twilio account at twilio.com/console</li>
          <li>2. Purchase Israeli phone number (+972)</li>
          <li>3. Add secrets to Base44: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER</li>
          <li>4. Install twilio npm package: npm install twilio</li>
          <li>5. Enable Backend Functions in Base44 dashboard</li>
        </ul>
      </div>
    </div>
  );
}