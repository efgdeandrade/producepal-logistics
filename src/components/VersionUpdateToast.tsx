import { useEffect } from 'react';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import { toast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const VersionUpdateToast = () => {
  const { isUpdateAvailable, dismiss, refresh } = useVersionCheck();

  useEffect(() => {
    if (isUpdateAvailable) {
      const { dismiss: dismissToast } = toast({
        title: "New version available",
        description: "Refresh to get the latest features and improvements.",
        duration: Infinity, // Don't auto-dismiss
        action: (
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => {
              refresh();
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        ),
      });

      return () => {
        dismissToast();
      };
    }
  }, [isUpdateAvailable, refresh]);

  return null;
};
