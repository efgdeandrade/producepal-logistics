import { useState, useEffect, useCallback } from 'react';
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

  // Request permission and subscribe
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported on this device');
      return false;
    }

    setIsLoading(true);

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        // Register service worker if not already registered
        const registration = await navigator.serviceWorker.ready;

        // Subscribe to push - use a placeholder VAPID key
        // In production, this should come from server/secrets
        try {
          const sub = await (registration as any).pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
              'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
            ),
          });

          setSubscription(sub);
          toast.success('Push notifications enabled!');
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
      await subscription.unsubscribe();
      setSubscription(null);
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

  // Check existing subscription on mount
  useEffect(() => {
    const checkSubscription = async () => {
      if (!isSupported) return;

      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await (registration as any).pushManager.getSubscription();
        setSubscription(sub);
      } catch (error) {
        console.error('Failed to check subscription:', error);
      }
    };

    checkSubscription();
  }, [isSupported]);

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

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
