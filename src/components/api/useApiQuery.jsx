import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiRequest } from './apiClient';

/**
 * Enhanced useQuery with centralized error handling
 * 
 * Features:
 * - Automatic error toast notifications
 * - 401 handling with auto re-auth
 * - Typed error objects
 * - Request retries
 * 
 * @param {Object} options - React Query options
 * @param {boolean} options.showErrorToast - Show toast on error (default: true)
 * @param {boolean} options.retryOnError - Retry failed requests (default: true)
 * @param {string} options.errorMessage - Custom error message
 */
export function useApiQuery(options) {
  const {
    queryKey,
    queryFn,
    showErrorToast = true,
    retryOnError = true,
    errorMessage,
    ...restOptions
  } = options;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await apiRequest(queryFn, {
          retries: retryOnError ? 1 : 0
        });
      } catch (error) {
        // Show error toast if enabled
        if (showErrorToast) {
          const message = errorMessage || error.message || 'Failed to fetch data';
          toast.error(message);
        }
        throw error;
      }
    },
    retry: retryOnError ? 1 : false,
    staleTime: 30000, // 30 seconds
    ...restOptions
  });

  return {
    ...query,
    // Typed error object
    error: query.error ? {
      code: query.error.code || 'UNKNOWN_ERROR',
      message: query.error.message || 'An error occurred',
      details: query.error.details,
      status: query.error.status
    } : null
  };
}