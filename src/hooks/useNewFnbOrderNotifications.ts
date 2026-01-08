import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { playOrderNotificationSound } from "@/utils/audioNotification";

export interface OrderNotification {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  zone: string | null;
  createdAt: Date;
}

export function useNewFnbOrderNotifications() {
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem('fnb-order-sound-enabled');
    return stored !== null ? stored === 'true' : true;
  });

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const newValue = !prev;
      localStorage.setItem('fnb-order-sound-enabled', String(newValue));
      return newValue;
    });
  }, []);

  const minimize = useCallback(() => setIsMinimized(true), []);
  const expand = useCallback(() => setIsMinimized(false), []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    console.log('[useNewFnbOrderNotifications] Setting up real-time subscription for fnb_orders INSERT');
    
    const channel = supabase
      .channel('new-fnb-order-notifications')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'fnb_orders' 
        },
        async (payload) => {
          console.log('[useNewFnbOrderNotifications] New order detected:', payload.new);
          
          try {
            // Fetch order details with customer info
            const { data: orderData, error } = await supabase
              .from('fnb_orders')
              .select(`
                id, order_number, status,
                fnb_customers(name, delivery_zone)
              `)
              .eq('id', payload.new.id)
              .single();

            if (error) {
              console.error('[useNewFnbOrderNotifications] Error fetching order details:', error);
              return;
            }

            if (orderData) {
              console.log('[useNewFnbOrderNotifications] Order details fetched:', orderData);
              
              const notification: OrderNotification = {
                id: `order-${orderData.id}-${Date.now()}`,
                orderId: orderData.id,
                orderNumber: orderData.order_number,
                customerName: orderData.fnb_customers?.name || 'Unknown Customer',
                zone: orderData.fnb_customers?.delivery_zone || null,
                createdAt: new Date()
              };

              setNotifications(prev => [...prev, notification]);
              setIsMinimized(false); // Expand when new notification arrives

              // Play sound if enabled
              if (soundEnabled) {
                console.log('[useNewFnbOrderNotifications] Playing notification sound');
                playOrderNotificationSound();
              }
            }
          } catch (err) {
            console.error('[useNewFnbOrderNotifications] Error processing notification:', err);
          }
        }
      )
      .subscribe((status) => {
        console.log('[useNewFnbOrderNotifications] Subscription status:', status);
      });

    return () => {
      console.log('[useNewFnbOrderNotifications] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [soundEnabled]);

  return {
    notifications,
    isMinimized,
    soundEnabled,
    toggleSound,
    minimize,
    expand,
    dismissNotification,
    dismissAll
  };
}
