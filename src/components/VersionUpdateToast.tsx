import { useEffect } from 'react';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import { toast } from '@/hooks/use-toast';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const VersionUpdateToast = () => {
  const { isUpdateAvailable, dismiss, refresh } = useVersionCheck();

  useEffect(() => {
    if (!isUpdateAvailable) return;

    const { dismiss: dismissToast } = toast({
      title: 'New version available',
      description: 'Refresh to get the latest features and improvements.',
      duration: Infinity,
      action: (
        <div className="flex items-center gap-2">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              dismiss();
              dismissToast();
            }}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Dismiss
          </Button>
        </div>
      ),
    });

    return () => {
      dismissToast();
    };
  }, [isUpdateAvailable, refresh, dismiss]);

  return null;
};

