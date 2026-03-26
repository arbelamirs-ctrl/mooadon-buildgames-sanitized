/**
 * Webhook Manager
 * Handles outbound webhooks with retry logic and exponential backoff
 */

export class WebhookManager {
  constructor() {
    this.maxRetries = 3;
    this.baseDelay = 1000; // 1 second
  }

  /**
   * Send webhook with retry logic
   */
  async sendWebhook(url, method = 'POST', payload = {}, options = {}) {
    const {
      retryCount = 0,
      timeout = 10000,
      headers = {}
    } = options;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mooadon-Webhook/1.0',
          ...headers
        },
        body: method !== 'GET' ? JSON.stringify(payload) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseData = await response.text();
      let parsedResponse;
      
      try {
        parsedResponse = JSON.parse(responseData);
      } catch (e) {
        parsedResponse = { raw: responseData };
      }

      if (!response.ok && retryCount < this.maxRetries) {
        // Retry on 5xx errors or 429 (rate limit)
        if (response.status >= 500 || response.status === 429) {
          return await this.retryWebhook(url, method, payload, retryCount, options);
        }
      }

      return {
        success: response.ok,
        statusCode: response.status,
        response: parsedResponse,
        retryCount: retryCount
      };

    } catch (error) {
      // Retry on network errors, timeouts
      if (retryCount < this.maxRetries) {
        return await this.retryWebhook(url, method, payload, retryCount, options);
      }

      return {
        success: false,
        statusCode: 0,
        error: error.message,
        retryCount: retryCount
      };
    }
  }

  /**
   * Retry webhook with exponential backoff
   */
  async retryWebhook(url, method, payload, retryCount, options) {
    const delay = this.baseDelay * Math.pow(2, retryCount); // Exponential backoff
    
    console.log(`Retrying webhook after ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return await this.sendWebhook(url, method, payload, {
      ...options,
      retryCount: retryCount + 1
    });
  }

  /**
   * Validate webhook URL
   */
  static validateUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  /**
   * Create webhook payload for different events
   */
  static createPayload(eventType, data) {
    return {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: data
    };
  }
}

export default WebhookManager;