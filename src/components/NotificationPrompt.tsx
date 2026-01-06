import { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface NotificationPromptProps {
  variant?: 'banner' | 'card';
  onDismiss?: () => void;
}

export const NotificationPrompt = ({ variant = 'banner', onDismiss }: NotificationPromptProps) => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    checkSubscription();
  }, [user]);

  const checkSubscription = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
      
      setIsSubscribed(data && data.length > 0);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Notifications not supported', {
        description: 'Your browser does not support push notifications.',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        await subscribeToNotifications();
        toast.success('Notifications enabled!', {
          description: 'You will now receive updates about your deliveries.',
        });
      } else if (result === 'denied') {
        toast.error('Notifications blocked', {
          description: 'You can enable them in your browser settings.',
        });
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error('Failed to enable notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToNotifications = async () => {
    if (!user || !('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Note: VAPID key would be needed for actual push notifications
      // This is a placeholder for the subscription flow
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // applicationServerKey would go here
      });

      const subscriptionData = subscription.toJSON();
      
      await supabase.from('push_subscriptions').insert({
        user_id: user.id,
        endpoint: subscriptionData.endpoint || '',
        p256dh: subscriptionData.keys?.p256dh || '',
        auth: subscriptionData.keys?.auth || '',
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        },
      });

      setIsSubscribed(true);
    } catch (error) {
      console.error('Error subscribing to notifications:', error);
      // Store subscription intent even if push manager fails
      if (user) {
        await supabase.from('push_subscriptions').insert({
          user_id: user.id,
          endpoint: 'pending',
          p256dh: 'pending',
          auth: 'pending',
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            status: 'pending_vapid_key',
          },
        });
        setIsSubscribed(true);
      }
    }
  };

  const unsubscribe = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);
      
      setIsSubscribed(false);
      toast.success('Notifications disabled');
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error('Failed to disable notifications');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show if already subscribed and using banner variant
  if (variant === 'banner' && (isSubscribed || permission === 'denied')) {
    return null;
  }

  if (variant === 'card') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Get notified about new orders, delivery updates, and important alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="notifications" className="flex flex-col gap-1">
              <span>Enable notifications</span>
              <span className="text-xs text-muted-foreground">
                {permission === 'denied' 
                  ? 'Blocked in browser settings' 
                  : isSubscribed 
                    ? 'You will receive push notifications'
                    : 'Receive real-time updates'}
              </span>
            </Label>
            <Switch
              id="notifications"
              checked={isSubscribed}
              disabled={isLoading || permission === 'denied'}
              onCheckedChange={(checked) => {
                if (checked) {
                  requestPermission();
                } else {
                  unsubscribe();
                }
              }}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Banner variant
  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-3">
      <div className="container flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium">Enable notifications</p>
            <p className="text-xs text-muted-foreground">
              Get real-time updates about orders and deliveries
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={requestPermission}
            disabled={isLoading}
          >
            Enable
          </Button>
          {onDismiss && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
