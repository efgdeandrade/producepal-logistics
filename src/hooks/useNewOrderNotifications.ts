import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { playOrderNotificationSound, playUrgentNotificationSound } from '@/utils/audioNotification';

const SOUND_STORAGE_KEY = 'fnb_picker_sound_enabled';
const MINIMIZED_STORAGE_KEY = 'fnb_picker_notifications_minimized';
const REMINDER_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

export interface OrderNotification {
  id: string;
  queueId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  zone?: string;
  isUrgent: boolean;
  createdAt: Date;
}

export function useNewOrderNotifications() {
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [isMinimized, setIsMinimized] = useState(() => {
    const stored = localStorage.getItem(MINIMIZED_STORAGE_KEY);
    return stored === 'true';
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem(SOUND_STORAGE_KEY);
    return stored !== 'false';
  });
  
  // Track processed queue IDs to avoid duplicate notifications
  const processedIds = useRef<Set<string>>(new Set());
  const reminderInterval = useRef<NodeJS.Timeout | null>(null);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const newValue = !prev;
      localStorage.setItem(SOUND_STORAGE_KEY, String(newValue));
      return newValue;
    });
  }, []);

  const minimize = useCallback(() => {
    setIsMinimized(true);
    localStorage.setItem(MINIMIZED_STORAGE_KEY, 'true');
  }, []);

  const expand = useCallback(() => {
    setIsMinimized(false);
    localStorage.setItem(MINIMIZED_STORAGE_KEY, 'false');
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Subscribe to new orders in the picker queue
  useEffect(() => {
    const channel = supabase
      .channel('new-order-notifications')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'fnb_picker_queue' 
        },
        async (payload) => {
          const newQueue = payload.new as any;
          
          // Skip if already processed
          if (processedIds.current.has(newQueue.id)) {
            return;
          }
          processedIds.current.add(newQueue.id);

          // Fetch order details
          const { data: queueData } = await supabase
            .from('fnb_picker_queue')
            .select(`
              id,
              order_id,
              priority,
              fnb_orders(
                order_number,
                fnb_customers(name, delivery_zone)
              )
            `)
            .eq('id', newQueue.id)
            .single();

          if (queueData) {
            const order = queueData.fnb_orders as any;
            const customer = order?.fnb_customers as any;
            const isUrgent = (queueData.priority || 0) > 0;

            const notification: OrderNotification = {
              id: `notif-${queueData.id}`,
              queueId: queueData.id,
              orderId: queueData.order_id || '',
              orderNumber: order?.order_number || 'N/A',
              customerName: customer?.name || 'Unknown',
              zone: customer?.delivery_zone || undefined,
              isUrgent,
              createdAt: new Date(),
            };

            setNotifications(prev => [...prev, notification]);

            // Play sound if enabled
            if (soundEnabled) {
              if (isUrgent) {
                playUrgentNotificationSound();
              } else {
                playOrderNotificationSound();
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [soundEnabled]);

  // Reminder sound every 3 minutes for unattended orders
  useEffect(() => {
    // Clear existing interval
    if (reminderInterval.current) {
      clearInterval(reminderInterval.current);
      reminderInterval.current = null;
    }

    // Set up new interval if there are notifications and sound is enabled
    if (notifications.length > 0 && soundEnabled) {
      reminderInterval.current = setInterval(() => {
        // Play reminder sound
        const hasUrgent = notifications.some(n => n.isUrgent);
        if (hasUrgent) {
          playUrgentNotificationSound();
        } else {
          playOrderNotificationSound();
        }
      }, REMINDER_INTERVAL_MS);
    }

    return () => {
      if (reminderInterval.current) {
        clearInterval(reminderInterval.current);
        reminderInterval.current = null;
      }
    };
  }, [notifications.length, soundEnabled, notifications]);

  return {
    notifications,
    isMinimized,
    soundEnabled,
    toggleSound,
    minimize,
    expand,
    dismissNotification,
    dismissAll,
  };
}
