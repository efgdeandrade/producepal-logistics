import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { playOrderNotificationSound, preWarmAudio, hasUserInteracted } from "@/utils/audioNotification";
import { toast } from "sonner";

export interface OrderNotification {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  zone: string | null;
  queueId: string | null; // Added for direct picking
  createdAt: Date;
}

const SOUND_STORAGE_KEY = 'fnb-order-sound-enabled';

export function useNewFnbOrderNotifications() {
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem(SOUND_STORAGE_KEY);
    return stored !== null ? stored === 'true' : true;
  });

  const toggleSound = useCallback(async () => {
    const newValue = !soundEnabled;
    
    // Pre-warm audio when enabling sound
    if (newValue) {
      const success = await preWarmAudio();
      if (success) {
        toast.success('Sound notifications enabled');
      } else if (!hasUserInteracted()) {
        toast.warning('Click anywhere on page first to enable sound');
      }
    } else {
      toast.info('Sound notifications disabled');
    }
    
    setSoundEnabled(newValue);
    localStorage.setItem(SOUND_STORAGE_KEY, String(newValue));
  }, [soundEnabled]);

  const minimize = useCallback(() => setIsMinimized(true), []);
  const expand = useCallback(() => setIsMinimized(false), []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    console.log('[useNewFnbOrderNotifications] Setting up real-time subscription for distribution_orders INSERT');
    
    const channel = supabase
      .channel('new-fnb-order-notifications')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'distribution_orders' 
        },
        async (payload) => {
          console.log('[useNewFnbOrderNotifications] New order detected:', payload.new);
          
          try {
            const orderId = (payload.new as any).id;
            
            // Fetch order details with customer info
            const { data: orderData, error } = await supabase
              .from('distribution_orders')
              .select(`
                id, order_number, status,
                distribution_customers(name, delivery_zone)
              `)
              .eq('id', orderId)
              .single();

            if (error) {
              console.error('[useNewFnbOrderNotifications] Error fetching order details:', error);
              return;
            }

            // Also fetch the queue entry for this order (may be created shortly after)
            let queueId: string | null = null;
            
            // Try fetching queue entry with a small delay to allow for queue creation
            const fetchQueueId = async () => {
              const { data: queueData } = await supabase
                .from('distribution_picker_queue')
                .select('id')
                .eq('order_id', orderId)
                .maybeSingle();
              
              return queueData?.id || null;
            };
            
            // Try immediately first
            queueId = await fetchQueueId();
            
            // If not found, try again after a short delay
            if (!queueId) {
              await new Promise(resolve => setTimeout(resolve, 500));
              queueId = await fetchQueueId();
            }

            if (orderData) {
              console.log('[useNewFnbOrderNotifications] Order details fetched:', orderData, 'queueId:', queueId);
              
              const notification: OrderNotification = {
                id: `order-${(orderData as any).id}-${Date.now()}`,
                orderId: (orderData as any).id,
                orderNumber: (orderData as any).order_number,
                customerName: (orderData as any).distribution_customers?.name || 'Unknown Customer',
                zone: (orderData as any).distribution_customers?.delivery_zone || null,
                queueId: queueId,
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
