import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiRequest } from './apiClient';

/**
 * Enhanced useMutation with centralized error handling
 * 
 * Features:
 * - Automatic error toast notifications
 * - Success toast notifications
 * - 401 handling with auto re-auth
 * - Typed error objects
 * - Auto query invalidation
 * 
 * @param {Object} options - React Query mutation options
 * @param {boolean} options.showErrorToast - Show toast on error (default: true)
 * @param {boolean} options.showSuccessToast - Show toast on success (default: false)
 * @param {string} options.successMessage - Custom success message
 * @param {string} options.errorMessage - Custom error message
 * @param {Array<string>} options.invalidateQueries - Query keys to invalidate on success
 */
export function useApiMutation(options) {
  const {
    mutationFn,
    showErrorToast = true,
    showSuccessToast = false,
    successMessage,
    errorMessage,
    invalidateQueries = [],
    onSuccess,
    onError,
    ...restOptions
  } = options;

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (variables) => {
      return await apiRequest(
        () => mutationFn(variables),
        { retries: 0 }
      );
    },
    onSuccess: (data, variables, context) => {
      // Show success toast if enabled
      if (showSuccessToast) {
        const message = successMessage || 'Operation completed successfully';
        toast.success(message);
      }

      // Invalidate queries
      if (invalidateQueries.length > 0) {
        invalidateQueries.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey: Array.isArray(queryKey) ? queryKey : [queryKey] });
        });
      }

      // Call custom onSuccess
      if (onSuccess) {
        onSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      // Show error toast if enabled
      if (showErrorToast) {
        const message = errorMessage || error.message || 'Operation failed';
        toast.error(message);
      }

      // Call custom onError
      if (onError) {
        onError(error, variables, context);
      }
    },
    ...restOptions
  });

  return {
    ...mutation,
    // Typed error object
    error: mutation.error ? {
      code: mutation.error.code || 'UNKNOWN_ERROR',
      message: mutation.error.message || 'An error occurred',
      details: mutation.error.details,
      status: mutation.error.status
    } : null
  };
}