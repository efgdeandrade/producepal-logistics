import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { playOrderNotificationSound, playUrgentNotificationSound } from '@/utils/audioNotification';

const SOUND_STORAGE_KEY = 'fnb_picker_sound_enabled';

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
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem(SOUND_STORAGE_KEY);
    return stored !== 'false';
  });
  
  // Track processed queue IDs to avoid duplicate notifications
  const processedIds = useRef<Set<string>>(new Set());

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const newValue = !prev;
      localStorage.setItem(SOUND_STORAGE_KEY, String(newValue));
      return newValue;
    });
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

  // Clean up old notifications after 1 minute
  useEffect(() => {
    const cleanup = setInterval(() => {
      const oneMinuteAgo = new Date(Date.now() - 60000);
      setNotifications(prev => 
        prev.filter(n => n.createdAt > oneMinuteAgo)
      );
    }, 10000);

    return () => clearInterval(cleanup);
  }, []);

  return {
    notifications,
    soundEnabled,
    toggleSound,
    dismissNotification,
    dismissAll,
  };
}
