/**
 * Webhook Service
 * Handles webhook delivery with retries and security
 */

import { base44 } from '@/api/base44Client';

class WebhookService {
  /**
   * Trigger webhook for an event
   * @param {string} eventType - Type of event
   * @param {object} payload - Event data
   * @param {string} companyId - Company ID (optional)
   */
  async trigger(eventType, payload, companyId = null) {
    try {
      // Find matching webhook configurations
      const query = companyId 
        ? { company_id: companyId, is_active: true }
        : { company_id: null, is_active: true }; // Super admin webhooks
      
      const webhooks = await base44.entities.WebhookConfig.filter(query);
      
      // Filter webhooks that listen to this event
      const matchingWebhooks = webhooks.filter(wh => 
        wh.events && wh.events.includes(eventType)
      );
      
      if (matchingWebhooks.length === 0) {
        console.log(`[Webhook] No webhooks configured for ${eventType}`);
        return;
      }
      
      // Send to all matching webhooks
      for (const webhook of matchingWebhooks) {
        this.sendWebhook(webhook, eventType, payload);
      }
    } catch (error) {
      console.error('[Webhook] Error triggering webhook:', error);
    }
  }
  
  /**
   * Send webhook to endpoint
   */
  async sendWebhook(webhook, eventType, payload) {
    const logId = await this.createLog(webhook.id, webhook.company_id, eventType, payload);
    
    try {
      const result = await this.attemptSend(webhook, eventType, payload);
      
      if (result.success) {
        await this.updateSuccess(webhook.id, logId, result);
      } else {
        await this.updateFailure(webhook.id, logId, result, webhook.retry_count);
      }
    } catch (error) {
      await this.updateFailure(webhook.id, logId, { 
        error: error.message 
      }, webhook.retry_count);
    }
  }
  
  /**
   * Attempt to send webhook
   */
  async attemptSend(webhook, eventType, payload) {
    const timestamp = Date.now();
    const signature = await this.generateSignature(payload, webhook.secret, timestamp);
    
    const webhookPayload = {
      event: eventType,
      timestamp,
      data: payload
    };
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), webhook.timeout_ms || 5000);
      
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp.toString(),
          'X-Webhook-Event': eventType
        },
        body: JSON.stringify(webhookPayload),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      const responseBody = await response.text();
      
      return {
        success: response.ok,
        statusCode: response.status,
        responseBody
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        statusCode: 0
      };
    }
  }
  
  /**
   * Generate HMAC signature
   */
  async generateSignature(payload, secret, timestamp) {
    if (!secret) return '';
    
    const message = `${timestamp}.${JSON.stringify(payload)}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  }
  
  /**
   * Create webhook log entry
   */
  async createLog(webhookId, companyId, eventType, payload) {
    const log = await base44.entities.WebhookLog.create({
      webhook_id: webhookId,
      company_id: companyId,
      event_type: eventType,
      payload,
      status: 'pending',
      attempts: 1
    });
    
    return log.id;
  }
  
  /**
   * Update log on success
   */
  async updateSuccess(webhookId, logId, result) {
    await base44.entities.WebhookLog.update(logId, {
      status: 'success',
      response_code: result.statusCode,
      response_body: result.responseBody
    });
    
    await base44.entities.WebhookConfig.update(webhookId, {
      last_triggered: new Date().toISOString(),
      success_count: { $increment: 1 }
    });
  }
  
  /**
   * Update log on failure
   */
  async updateFailure(webhookId, logId, result, maxRetries) {
    const log = await base44.entities.WebhookLog.filter({ id: logId });
    const currentLog = log[0];
    const attempts = currentLog.attempts || 1;
    
    const shouldRetry = attempts < maxRetries;
    const nextRetry = shouldRetry 
      ? new Date(Date.now() + Math.pow(2, attempts) * 1000).toISOString() // Exponential backoff
      : null;
    
    await base44.entities.WebhookLog.update(logId, {
      status: shouldRetry ? 'retrying' : 'failed',
      response_code: result.statusCode,
      response_body: result.responseBody,
      error_message: result.error,
      attempts: attempts + 1,
      next_retry: nextRetry
    });
    
    await base44.entities.WebhookConfig.update(webhookId, {
      failure_count: { $increment: 1 }
    });
  }
}

// Export singleton
const webhookService = new WebhookService();
export default webhookService;