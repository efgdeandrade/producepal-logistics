import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PushNotificationSettings {
  enabled: boolean;
  urgentOnly: boolean;
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: PushNotificationSettings = {
  enabled: true,
  urgentOnly: false,
  soundEnabled: true,
};

const SETTINGS_KEY = 'dre-push-settings';

// VAPID public key — set via VITE_VAPID_PUBLIC_KEY env var
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [settings, setSettings] = useState<PushNotificationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    }

    // Load settings from localStorage
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Failed to parse push settings:', e);
      }
    }
  }, []);

  // Check existing subscription on mount
  useEffect(() => {
    const checkSubscription = async () => {
      if (!isSupported) return;
      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        setSubscription(sub);
      } catch (error) {
        console.error('Failed to check subscription:', error);
      }
    };
    checkSubscription();
  }, [isSupported]);

  // Helper to convert VAPID key
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Request permission and subscribe
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported on this device');
      return false;
    }

    if (!VAPID_PUBLIC_KEY) {
      toast.error('Push notifications are not configured yet');
      return false;
    }

    setIsLoading(true);

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        const registration = await navigator.serviceWorker.ready;

        try {
          const sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
          });

          setSubscription(sub);

          // Save subscription to database
          const subJson = sub.toJSON();
          const { data: { user } } = await supabase.auth.getUser();

          if (user) {
            // Upsert: delete old subscriptions for this endpoint, then insert
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', subJson.endpoint!);

            await supabase.from('push_subscriptions').insert({
              user_id: user.id,
              endpoint: subJson.endpoint!,
              p256dh: subJson.keys?.p256dh || '',
              auth: subJson.keys?.auth || '',
            });
          }

          toast.success('Push notifications enabled! 🔔');
          return true;
        } catch (subError) {
          console.warn('Push subscription failed, but local notifications work:', subError);
          toast.success('Notifications enabled (local mode)');
          return true;
        }
      } else {
        toast.error('Permission denied for notifications');
        return false;
      }
    } catch (error) {
      console.error('Push permission error:', error);
      toast.error('Failed to enable notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  // Unsubscribe
  const unsubscribe = useCallback(async () => {
    if (!subscription) return;

    setIsLoading(true);

    try {
      const subJson = subscription.toJSON();
      await subscription.unsubscribe();
      setSubscription(null);

      // Remove from database
      if (subJson.endpoint) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', subJson.endpoint);
      }

      toast.success('Push notifications disabled');
    } catch (error) {
      console.error('Unsubscribe error:', error);
      toast.error('Failed to disable notifications');
    } finally {
      setIsLoading(false);
    }
  }, [subscription]);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<PushNotificationSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  }, [settings]);

  // Show local notification (for in-app alerts)
  const showLocalNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!settings.enabled) return;
    if (permission !== 'granted') return;

    // Play sound if enabled
    if (settings.soundEnabled) {
      try {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (e) {
        // Ignore audio errors
      }
    }

    // Vibrate if supported
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }

    // Show notification
    try {
      new Notification(title, {
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        ...options,
      });
    } catch (e) {
      console.warn('Failed to show notification:', e);
    }
  }, [permission, settings.enabled, settings.soundEnabled]);

  return {
    isSupported,
    permission,
    isSubscribed: !!subscription,
    isLoading,
    settings,
    requestPermission,
    unsubscribe,
    updateSettings,
    showLocalNotification,
  };
}
