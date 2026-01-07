import { toast } from '@/hooks/use-toast';

type ToastVariant = 'default' | 'destructive';

interface NotificationOptions {
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Standard durations
const DURATION = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
} as const;

export const notify = {
  success: (message: string, options?: NotificationOptions) => {
    toast({
      title: '✓ Success',
      description: message,
      duration: options?.duration ?? DURATION.success,
    });
  },

  error: (message: string, options?: NotificationOptions) => {
    toast({
      title: 'Error',
      description: message,
      variant: 'destructive' as ToastVariant,
      duration: options?.duration ?? DURATION.error,
    });
  },

  warning: (message: string, options?: NotificationOptions) => {
    toast({
      title: '⚠ Warning',
      description: message,
      duration: options?.duration ?? DURATION.warning,
    });
  },

  info: (message: string, options?: NotificationOptions) => {
    toast({
      title: 'Info',
      description: message,
      duration: options?.duration ?? DURATION.info,
    });
  },

  // For operations that can be undone
  withUndo: (message: string, onUndo: () => void) => {
    toast({
      title: '✓ Success',
      description: message,
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: onUndo,
      } as any, // Toast component handles action rendering
    });
  },

  // For async operations
  promise: async <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ): Promise<T> => {
    const toastId = toast({
      title: 'Loading',
      description: messages.loading,
    });

    try {
      const result = await promise;
      toast({
        title: '✓ Success',
        description: messages.success,
        duration: DURATION.success,
      });
      return result;
    } catch (error) {
      toast({
        title: 'Error',
        description: messages.error,
        variant: 'destructive',
        duration: DURATION.error,
      });
      throw error;
    }
  },
};
