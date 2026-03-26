import { base44 } from '@/api/base44Client';

/**
 * API Client - Unified fetch wrapper with error handling and interceptors
 */

const isDev = import.meta.env.DEV;

/**
 * Parse error response and extract meaningful error message
 */
function parseErrorResponse(error, response, data) {
  // Base44 SDK error format
  if (data?.error) {
    return {
      code: data.error.code || 'UNKNOWN_ERROR',
      message: data.error.message || 'An error occurred',
      details: data.error.details,
      status: response?.status || 500
    };
  }

  // Standard error response
  if (data?.message) {
    return {
      code: 'ERROR',
      message: data.message,
      status: response?.status || 500
    };
  }

  // Network or unknown errors
  return {
    code: 'NETWORK_ERROR',
    message: error.message || 'Network request failed',
    status: 0
  };
}

/**
 * Make an API request with automatic error handling and retries
 * @param {Function} apiFn - API function to call (e.g., base44.entities.Client.list)
 * @param {Object} options - Request options
 * @returns {Promise} - API response
 */
export async function apiRequest(apiFn, options = {}) {
  const { 
    retries = 1, 
    retryDelay = 1000,
    skipAuth = false 
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (isDev) {
        console.log(`[API] Request attempt ${attempt + 1}:`, apiFn.name);
      }

      const result = await apiFn();

      if (isDev) {
        console.log(`[API] Success:`, result);
      }

      return result;
    } catch (error) {
      lastError = error;

      if (isDev) {
        console.error(`[API] Error attempt ${attempt + 1}:`, error);
      }

      // Check if error is 401 (unauthorized)
      if (error.response?.status === 401 && !skipAuth) {
        // Trigger re-authentication
        if (isDev) {
          console.log('[API] 401 detected, redirecting to login...');
        }
        base44.auth.redirectToLogin();
        throw error; // Don't retry after redirect
      }

      // Don't retry on client errors (4xx except 401, 408, 429)
      const status = error.response?.status;
      if (status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429) {
        if (isDev) {
          console.log('[API] Client error, not retrying');
        }
        break;
      }

      // Retry after delay
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  // Parse and throw formatted error
  const formattedError = parseErrorResponse(
    lastError,
    lastError.response,
    lastError.response?.data
  );

  throw formattedError;
}

/**
 * Batch multiple API requests
 * @param {Array<Function>} requests - Array of API functions
 * @returns {Promise<Array>} - Array of results
 */
export async function batchRequests(requests) {
  try {
    const results = await Promise.allSettled(
      requests.map(fn => apiRequest(fn))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`Request ${index} failed:`, result.reason);
        return null;
      }
    });
  } catch (error) {
    console.error('Batch request failed:', error);
    throw error;
  }
}

export const ApiClient = {
  request: apiRequest,
  batch: batchRequests
};