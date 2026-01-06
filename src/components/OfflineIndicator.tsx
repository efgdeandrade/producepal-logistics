import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      toast.success('Back online', {
        description: 'Your connection has been restored.',
      });
      // Simulate sync completion
      setTimeout(() => setIsSyncing(false), 2000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline', {
        description: 'Some features may be limited.',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !isSyncing) {
    return null; // Don't show indicator when online and not syncing
  }

  return (
    <Badge 
      variant={isOnline ? 'secondary' : 'destructive'}
      className={cn(
        'gap-1.5 text-xs',
        isSyncing && 'animate-pulse'
      )}
    >
      {isSyncing ? (
        <>
          <RefreshCw className="h-3 w-3 animate-spin" />
          Syncing...
        </>
      ) : isOnline ? (
        <>
          <Wifi className="h-3 w-3" />
          Online
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Offline
        </>
      )}
    </Badge>
  );
};
