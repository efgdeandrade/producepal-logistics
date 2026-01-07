import { useCallback, useState } from 'react';
import { toast } from './use-toast';

interface ErrorHandlerOptions {
  showToast?: boolean;
  retryCount?: number;
  retryDelay?: number;
}

interface UseErrorHandlerReturn<T> {
  execute: (fn: () => Promise<T>) => Promise<T | null>;
  error: Error | null;
  isLoading: boolean;
  reset: () => void;
}

export function useErrorHandler<T>(
  options: ErrorHandlerOptions = {}
): UseErrorHandlerReturn<T> {
  const { showToast = true, retryCount = 0, retryDelay = 1000 } = options;
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(
    async (fn: () => Promise<T>): Promise<T | null> => {
      setIsLoading(true);
      setError(null);

      let lastError: Error | null = null;
      let attempts = 0;

      while (attempts <= retryCount) {
        try {
          const result = await fn();
          setIsLoading(false);
          return result;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          attempts++;

          if (attempts <= retryCount) {
            // Exponential backoff
            await new Promise((resolve) =>
              setTimeout(resolve, retryDelay * Math.pow(2, attempts - 1))
            );
          }
        }
      }

      setError(lastError);
      setIsLoading(false);

      if (showToast && lastError) {
        toast({
          title: 'Error',
          description: lastError.message || 'An unexpected error occurred',
          variant: 'destructive',
        });
      }

      return null;
    },
    [showToast, retryCount, retryDelay]
  );

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);

  return { execute, error, isLoading, reset };
}

// Utility function for formatting API errors
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unexpected error occurred';
}
