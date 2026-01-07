import { useState, useEffect, useMemo } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, CheckCircle, Clock, User, Package, AlertTriangle, LogOut, Scale, Trophy, Edit, ChevronDown, ChevronUp, RefreshCw, Volume2, VolumeX, CalendarIcon } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, isToday, startOfDay, endOfDay, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { DateRange } from 'react-day-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PickerSessionModal } from '@/components/fnb/PickerSessionModal';
import { PickerQueueZone } from '@/components/fnb/PickerQueueZone';
import { ShortageRequestDialog } from '@/components/fnb/ShortageRequestDialog';
import { PickerLeaderboard } from '@/components/fnb/PickerLeaderboard';
import { ShortageQuickButtons } from '@/components/fnb/ShortageQuickButtons';
import { AssistanceButton } from '@/components/fnb/AssistanceButton';
import { WeightAccuracyIndicator } from '@/components/fnb/WeightAccuracyIndicator';
import { ItemsOverviewTable } from '@/components/fnb/ItemsOverviewTable';
import { NewOrderToast } from '@/components/fnb/NewOrderToast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useNewOrderNotifications } from '@/hooks/useNewOrderNotifications';

const SHORT_REASONS = [
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'other', label: 'Other' },
];

const SESSION_KEY = 'fnb_picker_session';
const SESSION_START_KEY = 'fnb_picker_session_start';
const SESSION_ORDERS_KEY = 'fnb_picker_session_orders';

export default function FnbPicker() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { orderId: urlOrderId } = useParams<{ orderId?: string }>();
  const queryClient = useQueryClient();
  
  // Session state
  const [pickerName, setPickerName] = useState<string | null>(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored || null;
  });
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(() => {
    const stored = sessionStorage.getItem(SESSION_START_KEY);
    return stored ? new Date(stored) : null;
  });
  const [sessionOrdersCompleted, setSessionOrdersCompleted] = useState<number>(() => {
    const stored = sessionStorage.getItem(SESSION_ORDERS_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });
  const [showSwitchPicker, setShowSwitchPicker] = useState(false);
  const [previousPickerStats, setPreviousPickerStats] = useState<{
    name: string;
    ordersCompleted: number;
    sessionDuration: string;
  } | null>(null);
  
  // UI state
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [pickedQuantities, setPickedQuantities] = useState<Record<string, number>>({});
  const [pickedUnits, setPickedUnits] = useState<Record<string, string>>({});
  const [shortReasons, setShortReasons] = useState<Record<string, string>>({});
  const [shortageItem, setShortageItem] = useState<{
    id: string;
    productName: string;
    productCode: string;
    orderedQuantity: number;
    unit: string;
  } | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showCompletedOrders, setShowCompletedOrders] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date()
  });
  
  // New order notifications
  const {
    notifications,
    isMinimized: notificationsMinimized,
    soundEnabled,
    toggleSound,
    minimize: minimizeNotifications,
    expand: expandNotifications,
    dismissNotification,
  } = useNewOrderNotifications();

const PICKER_UNITS = [
  { value: 'pcs', label: 'Pcs' },
  { value: 'kg', label: 'Kg' },
  { value: 'lb', label: 'Lb' },
  { value: 'oz', label: 'Oz' },
  { value: 'case', label: 'Case' },
];

  // Calculate session duration
  const getSessionDuration = () => {
    if (!sessionStartTime) return '0m';
    const now = new Date();
    const diffMs = now.getTime() - sessionStartTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  // Handle session start
  const handleSessionStart = (name: string) => {
    const now = new Date();
    setPickerName(name);
    setSessionStartTime(now);
    setSessionOrdersCompleted(0);
    sessionStorage.setItem(SESSION_KEY, name);
    sessionStorage.setItem(SESSION_START_KEY, now.toISOString());
    sessionStorage.setItem(SESSION_ORDERS_KEY, '0');
    setShowSwitchPicker(false);
    setPreviousPickerStats(null);
    toast.success(`Welcome, ${name}!`);
  };

  // Handle switch picker
  const handleSwitchPicker = () => {
    if (pickerName && sessionStartTime) {
      setPreviousPickerStats({
        name: pickerName,
        ordersCompleted: sessionOrdersCompleted,
        sessionDuration: getSessionDuration(),
      });
    }
    setShowSwitchPicker(true);
    setSelectedQueue(null);
  };

  // Handle session end
  const handleSessionEnd = () => {
    setPickerName(null);
    setSessionStartTime(null);
    setSessionOrdersCompleted(0);
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_START_KEY);
    sessionStorage.removeItem(SESSION_ORDERS_KEY);
    setSelectedQueue(null);
    setPreviousPickerStats(null);
    toast.info('Session ended');
  };

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('fnb-picker-queue-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fnb_picker_queue' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fnb-picker-queue'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fnb_orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fnb-picker-queue'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fnb_order_items' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fnb-picker-items'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch queue with item counts - filtered by selected date range
  const { data: queueItems, isLoading } = useQuery({
    queryKey: ['fnb-picker-queue', 
      dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '',
      dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''
    ],
    queryFn: async () => {
      const rangeStart = startOfDay(dateRange?.from || new Date()).toISOString();
      const rangeEnd = endOfDay(dateRange?.to || dateRange?.from || new Date()).toISOString();
      
      const { data, error } = await supabase
        .from('fnb_picker_queue')
        .select(`
          *,
          fnb_orders!inner(
            id,
            order_number,
            total_xcg,
            delivery_date,
            notes,
            fnb_customers(name, whatsapp_phone, address, customer_type, delivery_zone)
          )
        `)
        .in('status', ['queued', 'in_progress'])
        .gte('fnb_orders.delivery_date', rangeStart)
        .lte('fnb_orders.delivery_date', rangeEnd)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;

      // Get item counts for each order
      const orderIds = data?.map((q: any) => q.order_id).filter(Boolean) || [];
      const { data: itemCounts } = await supabase
        .from('fnb_order_items')
        .select('order_id')
        .in('order_id', orderIds);

      const countMap: Record<string, number> = {};
      itemCounts?.forEach((item: any) => {
        countMap[item.order_id] = (countMap[item.order_id] || 0) + 1;
      });

      return data?.map((q: any) => ({
        ...q,
        itemCount: countMap[q.order_id] || 0,
      })) || [];
    },
    refetchInterval: 30000,
  });

  // Fetch leaderboard stats
  const { data: leaderboardStats } = useQuery({
    queryKey: ['fnb-picker-leaderboard'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Get today's completed orders by picker
      const { data, error } = await supabase
        .from('fnb_picker_queue')
        .select('picker_name, completed_at, pick_start_time, order_id')
        .eq('status', 'completed')
        .gte('completed_at', today)
        .not('picker_name', 'is', null);

      if (error) throw error;

      // Get active pickers
      const { data: activePickers } = await supabase
        .from('fnb_picker_queue')
        .select('picker_name')
        .eq('status', 'in_progress')
        .not('picker_name', 'is', null);

      const activeNames = new Set(activePickers?.map((p: any) => p.picker_name) || []);

      // Aggregate stats
      const statsMap: Record<string, { orders: number; totalTime: number; items: number }> = {};
      
      data?.forEach((row: any) => {
        const name = row.picker_name;
        if (!statsMap[name]) {
          statsMap[name] = { orders: 0, totalTime: 0, items: 0 };
        }
        statsMap[name].orders++;
        
        if (row.pick_start_time && row.completed_at) {
          const start = new Date(row.pick_start_time).getTime();
          const end = new Date(row.completed_at).getTime();
          statsMap[name].totalTime += (end - start) / 60000; // minutes
        }
      });

      // Get item counts per order
      const orderIds = data?.map((d: any) => d.order_id).filter(Boolean) || [];
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from('fnb_order_items')
          .select('order_id, quantity')
          .in('order_id', orderIds);

        const orderItemMap: Record<string, number> = {};
        items?.forEach((item: any) => {
          orderItemMap[item.order_id] = (orderItemMap[item.order_id] || 0) + item.quantity;
        });

        data?.forEach((row: any) => {
          if (statsMap[row.picker_name]) {
            statsMap[row.picker_name].items += orderItemMap[row.order_id] || 0;
          }
        });
      }

      return Object.entries(statsMap).map(([name, stats]) => ({
        picker_name: name,
        orders_completed: stats.orders,
        avg_pick_time_minutes: stats.orders > 0 ? stats.totalTime / stats.orders : 0,
        items_picked: stats.items,
        is_active: activeNames.has(name),
      }));
    },
    refetchInterval: 10000,
  });

  // Fetch today's completed orders for editing
  const { data: completedOrders } = useQuery({
    queryKey: ['fnb-completed-orders-today', pickerName],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('fnb_picker_queue')
        .select(`
          *,
          fnb_orders(
            id,
            order_number,
            total_xcg,
            delivery_date,
            notes,
            status,
            fnb_customers(name, whatsapp_phone, address, delivery_zone)
          )
        `)
        .eq('status', 'completed')
        .gte('completed_at', today)
        .order('completed_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!pickerName,
    refetchInterval: 30000,
  });

  // Fetch all order items for the items overview table
  const { data: allQueueOrderItems, isLoading: isLoadingAllItems } = useQuery({
    queryKey: ['fnb-picker-all-items', queueItems?.map((q: any) => q.order_id).join(',')],
    queryFn: async () => {
      if (!queueItems || queueItems.length === 0) return [];
      
      const orderIds = queueItems.map((q: any) => q.order_id).filter(Boolean);
      if (orderIds.length === 0) return [];

      const { data, error } = await supabase
        .from('fnb_order_items')
        .select(`
          *,
          fnb_products(id, code, name, unit)
        `)
        .in('order_id', orderIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!queueItems && queueItems.length > 0,
    refetchInterval: 30000,
  });

  // Group orders by zone
  const ordersByZone = useMemo(() => {
    if (!queueItems) return {};
    
    const grouped: Record<string, any[]> = {};
    queueItems.forEach((item: any) => {
      const zone = item.fnb_orders?.fnb_customers?.delivery_zone || 'Unassigned';
      if (!grouped[zone]) grouped[zone] = [];
      grouped[zone].push(item);
    });

    // Sort zones to put urgent ones first
    return Object.fromEntries(
      Object.entries(grouped).sort(([, a], [, b]) => {
        const aUrgent = a.some((o: any) => o.priority > 0);
        const bUrgent = b.some((o: any) => o.priority > 0);
        if (aUrgent && !bUrgent) return -1;
        if (!aUrgent && bUrgent) return 1;
        return 0;
      })
    );
  }, [queueItems]);

  // Fetch order items when selected
  const { data: orderItems } = useQuery({
    queryKey: ['fnb-picker-items', selectedQueue],
    queryFn: async () => {
      if (!selectedQueue) return [];
      const queueItem = queueItems?.find((q: any) => q.id === selectedQueue);
      if (!queueItem) return [];

      const { data, error } = await supabase
        .from('fnb_order_items')
        .select(`
          *,
          fnb_products(code, name, unit, is_weight_based, weight_unit)
        `)
        .eq('order_id', queueItem.order_id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedQueue,
  });

  // Initialize picked quantities and units when order items load
  useEffect(() => {
    if (orderItems) {
      const initialQuantities: Record<string, number> = {};
      const initialUnits: Record<string, string> = {};
      const initialReasons: Record<string, string> = {};
      orderItems.forEach((item: any) => {
        initialQuantities[item.id] = item.picked_quantity ?? item.quantity;
        initialUnits[item.id] = item.picked_unit || item.order_unit || item.fnb_products?.unit || 'pcs';
        if (item.short_reason) {
          initialReasons[item.id] = item.short_reason;
        }
      });
      setPickedQuantities(initialQuantities);
      setPickedUnits(initialUnits);
      setShortReasons(initialReasons);
    }
  }, [orderItems]);

  // Mutations
  const claimMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const { error } = await supabase
        .from('fnb_picker_queue')
        .update({
          claimed_by: user?.id,
          claimed_at: new Date().toISOString(),
          status: 'in_progress',
          picker_name: pickerName,
          pick_start_time: new Date().toISOString(),
        })
        .eq('id', queueId)
        .eq('status', 'queued');
      if (error) throw error;

      const queueItem = queueItems?.find((q: any) => q.id === queueId);
      if (queueItem) {
        await supabase
          .from('fnb_orders')
          .update({ status: 'picking' })
          .eq('id', queueItem.order_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-picker-queue'] });
      toast.success('Order claimed - start picking!');
    },
    onError: () => {
      toast.error('Failed to claim - another picker got it first');
      queryClient.invalidateQueries({ queryKey: ['fnb-picker-queue'] });
    },
  });

  // Auto-select order from URL parameter (after claimMutation is defined)
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  useEffect(() => {
    if (urlOrderId && queueItems && pickerName && !hasAutoSelected) {
      // Find the queue item for this order
      const queueItem = queueItems.find((q: any) => q.order_id === urlOrderId);
      
      if (queueItem) {
        setHasAutoSelected(true);
        // If it's queued and not claimed, auto-claim it
        if (queueItem.status === 'queued') {
          claimMutation.mutate(queueItem.id);
          setSelectedQueue(queueItem.id);
          toast.success(`Auto-claimed order for ${queueItem.fnb_orders?.fnb_customers?.name || 'customer'}`);
        } else if (queueItem.status === 'in_progress') {
          // If already in progress, just select it
          setSelectedQueue(queueItem.id);
          toast.info(`Viewing order for ${queueItem.fnb_orders?.fnb_customers?.name || 'customer'}`);
        }
      } else if (queueItems.length > 0) {
        // Queue loaded but order not found
        setHasAutoSelected(true);
        toast.error('Order not found in picker queue. It may need to be confirmed first.');
      }
    }
  }, [urlOrderId, queueItems, pickerName, hasAutoSelected]);

  const shortageRequestMutation = useMutation({
    mutationFn: async ({ itemId, availableQuantity, reason, notes }: {
      itemId: string;
      availableQuantity: number;
      reason: string;
      notes?: string;
    }) => {
      const item = orderItems?.find((i: any) => i.id === itemId);
      if (!item) throw new Error('Item not found');

      const shortQty = item.quantity - availableQuantity;
      
      // Non-blocking: Mark as 'reported' instead of 'pending' approval
      // This allows the picker to continue without waiting
      const { error } = await supabase
        .from('fnb_order_items')
        .update({
          picked_quantity: availableQuantity,
          picked_by: user?.id,
          picked_at: new Date().toISOString(),
          short_quantity: shortQty,
          short_reason: reason,
          shortage_status: 'reported', // Non-blocking - just reported, no approval needed
          shortage_alerted_at: new Date().toISOString(),
        })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fnb-picker-items'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-shortage-alerts'] });
      setShortageItem(null);
      setPickedQuantities(prev => ({
        ...prev,
        [variables.itemId]: variables.availableQuantity,
      }));
      setShortReasons(prev => ({
        ...prev,
        [variables.itemId]: variables.reason,
      }));
      toast.success('Shortage reported - you can continue picking');
    },
    onError: () => {
      toast.error('Failed to submit shortage request');
    },
  });

  // Picker self-resolution of shortage - update picked quantity and resolve if fulfilled
  const [editingShortageItem, setEditingShortageItem] = useState<string | null>(null);
  
  const resolveShortageByPickerMutation = useMutation({
    mutationFn: async ({ itemId, newPickedQuantity }: {
      itemId: string;
      newPickedQuantity: number;
    }) => {
      const item = orderItems?.find((i: any) => i.id === itemId);
      if (!item) throw new Error('Item not found');

      const newShortQty = Math.max(0, item.quantity - newPickedQuantity);
      const isFullyResolved = newShortQty === 0;
      
      const { error } = await supabase
        .from('fnb_order_items')
        .update({
          picked_quantity: newPickedQuantity,
          short_quantity: newShortQty,
          shortage_status: isFullyResolved ? 'resolved' : 'reported',
          ...(isFullyResolved && {
            shortage_resolved_at: new Date().toISOString(),
            shortage_resolved_by: user?.id,
          }),
        })
        .eq('id', itemId);
      if (error) throw error;
      
      return { isFullyResolved, newShortQty };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fnb-picker-items'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-shortage-alerts'] });
      setEditingShortageItem(null);
      setPickedQuantities(prev => ({
        ...prev,
        [variables.itemId]: variables.newPickedQuantity,
      }));
      
      if (result.isFullyResolved) {
        toast.success('Shortage resolved - full quantity now picked! ✓');
      } else {
        toast.success(`Quantity updated - still short ${result.newShortQty}`);
      }
    },
    onError: () => {
      toast.error('Failed to update shortage');
    },
  });

  // Mutation for checking/unchecking items (collaborative picking)
  const checkItemMutation = useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: string; checked: boolean }) => {
      if (checked) {
        // Mark as picked by this picker
        const { error } = await supabase
          .from('fnb_order_items')
          .update({
            picked_by: user?.id,
            picked_at: new Date().toISOString(),
            picker_name: pickerName,
          })
          .eq('id', itemId);
        if (error) throw error;
      } else {
        // Only allow unchecking if this picker checked it
        const item = orderItems?.find((i: any) => i.id === itemId);
        if (item?.picked_by === user?.id) {
          const { error } = await supabase
            .from('fnb_order_items')
            .update({
              picked_by: null,
              picked_at: null,
              picker_name: null,
            })
            .eq('id', itemId);
          if (error) throw error;
        } else {
          throw new Error('Cannot uncheck item picked by another picker');
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-picker-items'] });
    },
    onError: (error: any) => {
      if (error.message === 'Cannot uncheck item picked by another picker') {
        toast.error('You can only uncheck items you picked');
      } else {
        toast.error('Failed to update item');
      }
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ queueId, verifiedWeight }: { queueId: string; verifiedWeight: number }) => {
      const queueItem = queueItems?.find((q: any) => q.id === queueId);
      if (!queueItem) throw new Error('Queue item not found');

      // Update all items with current picked quantities and units
      if (orderItems) {
        for (const item of orderItems) {
          const pickedQty = pickedQuantities[item.id] ?? item.quantity;
          const pickedUnit = pickedUnits[item.id] || item.order_unit || item.fnb_products?.unit || 'pcs';
          const shortQty = Math.max(0, item.quantity - pickedQty);
          const isWeightBased = item.fnb_products?.is_weight_based || false;
          const isOverPicked = pickedQty > item.quantity;
          
          await supabase
            .from('fnb_order_items')
            .update({
              picked_quantity: pickedQty,
              picked_by: user?.id,
              picked_at: new Date().toISOString(),
              picked_unit: pickedUnit,
              short_quantity: shortQty,
              short_reason: shortQty > 0 ? shortReasons[item.id] || 'other' : null,
              // For weight-based items, track if over-picked and actual weight
              is_over_picked: isWeightBased && isOverPicked,
              actual_weight_kg: isWeightBased ? pickedQty : null,
            })
            .eq('id', item.id);
        }
      }

      // Calculate expected weight
      const expectedWeight = orderItems?.reduce((sum: number, item: any) => {
        return sum + (pickedQuantities[item.id] || 0) * 0.5; // Placeholder: 0.5kg per unit
      }, 0) || 0;

      const { error: queueError } = await supabase
        .from('fnb_picker_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          verified_weight_kg: verifiedWeight,
          expected_weight_kg: expectedWeight,
        })
        .eq('id', queueId);
      if (queueError) throw queueError;

      const { error: orderError } = await supabase
        .from('fnb_orders')
        .update({ status: 'ready' })
        .eq('id', queueItem.order_id);
      if (orderError) throw orderError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-picker-queue'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-picker-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-completed-orders-today'] });
      
      // Increment session orders count
      const newCount = sessionOrdersCompleted + 1;
      setSessionOrdersCompleted(newCount);
      sessionStorage.setItem(SESSION_ORDERS_KEY, newCount.toString());
      
      setSelectedQueue(null);
      setPickedQuantities({});
      setShortReasons({});
      toast.success('Order completed and ready for delivery! 🎉');
    },
    onError: () => {
      toast.error('Failed to complete order');
    },
  });

  // Reopen a completed order for editing
  const reopenOrderMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const completedOrder = completedOrders?.find((o: any) => o.id === queueId);
      if (!completedOrder) throw new Error('Order not found');

      // Update picker queue status back to in_progress
      const { error: queueError } = await supabase
        .from('fnb_picker_queue')
        .update({
          status: 'in_progress',
          completed_at: null,
          verified_weight_kg: null,
          pick_start_time: new Date().toISOString(),
          picker_name: pickerName,
          claimed_by: user?.id,
          claimed_at: new Date().toISOString(),
        })
        .eq('id', queueId);
      if (queueError) throw queueError;

      // Update order status back to picking
      const { error: orderError } = await supabase
        .from('fnb_orders')
        .update({ status: 'picking' })
        .eq('id', completedOrder.order_id);
      if (orderError) throw orderError;

      return queueId;
    },
    onSuccess: (queueId) => {
      queryClient.invalidateQueries({ queryKey: ['fnb-picker-queue'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-completed-orders-today'] });
      setSelectedQueue(queueId);
      toast.success('Order reopened for editing');
    },
    onError: () => {
      toast.error('Failed to reopen order');
    },
  });

  const selectedQueueItem = queueItems?.find((q: any) => q.id === selectedQueue);
  const isOwner = selectedQueueItem?.picker_name === pickerName || selectedQueueItem?.claimed_by === user?.id;
  const canCollaborate = !!pickerName && selectedQueueItem?.status === 'in_progress';
  // For backwards compatibility with existing code that uses isMyOrder
  const isMyOrder = isOwner;

  // Check if any items have reported shortages (non-blocking, just visual)
  const hasReportedShortages = orderItems?.some(
    (item: any) => item.shortage_status === 'reported'
  );

  // Check if all items have been reviewed
  const allItemsReviewed =
    orderItems &&
    orderItems.length > 0 &&
    orderItems.every((item: any) => pickedQuantities[item.id] !== undefined);

  // Check for any shorts without reasons - only block if quantity reduced but no reason selected
  const hasUnreasonedShorts = orderItems?.some(
    (item: any) =>
      (pickedQuantities[item.id] ?? item.quantity) < item.quantity &&
      !shortReasons[item.id] &&
      item.shortage_status !== 'reported' // Don't block if already reported
  );

  // Calculate progress
  const pickedCount = Object.values(pickedQuantities).filter(q => q > 0).length;
  const totalCount = orderItems?.length || 0;
  const progress = totalCount > 0 ? (pickedCount / totalCount) * 100 : 0;

  // Calculate expected weight - use actual product weights when available
  // For weight-based items, the picked quantity IS the weight
  // For fixed items, use an average weight estimate (0.5kg per unit as fallback)
  const expectedWeight = orderItems?.reduce((sum: number, item: any) => {
    const pickedQty = pickedQuantities[item.id] ?? item.quantity;
    const isWeightBased = item.fnb_products?.is_weight_based || false;
    
    if (isWeightBased) {
      // Weight-based: picked quantity is already in kg (or weight unit)
      return sum + pickedQty;
    } else {
      // Fixed quantity: estimate 0.5kg per unit as fallback
      return sum + pickedQty * 0.5;
    }
  }, 0) || 0;

  // Show session modal if no picker name or switching
  if (!pickerName || showSwitchPicker) {
    return (
      <div className="space-y-6">
        <PickerSessionModal 
          open={true} 
          onSessionStart={handleSessionStart} 
          onClose={() => {
            if (showSwitchPicker) {
              setShowSwitchPicker(false);
              setPreviousPickerStats(null);
            } else {
              navigate('/fnb');
            }
          }}
          previousPickerStats={previousPickerStats}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Floating notification stack */}
      <NewOrderToast
        notifications={notifications}
        isMinimized={notificationsMinimized}
        onMinimize={minimizeNotifications}
        onExpand={expandNotifications}
        onPickOrder={(notification) => {
          // Find queue item and claim it
          const queueItem = queueItems?.find((q: any) => q.order_id === notification.orderId);
          if (queueItem) {
            if (queueItem.status === 'queued') {
              claimMutation.mutate(queueItem.id);
            }
            setSelectedQueue(queueItem.id);
          }
          dismissNotification(notification.id);
        }}
        onDismiss={dismissNotification}
      />
      
      <main className="container py-4 max-w-7xl">
        {/* Header with Session Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/fnb">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight">Picker Workstation</h1>
              {/* Session Info Banner */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <User className="h-3.5 w-3.5" />
                  {pickerName}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {getSessionDuration()}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {sessionOrdersCompleted} orders
                </span>
              </div>
            </div>
          </div>
          
          {/* Date Range Picker and Actions Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date Range Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant={dateRange?.from && !(isToday(dateRange.from) && (!dateRange.to || isToday(dateRange.to))) ? "destructive" : "outline"} 
                  size="sm" 
                  className={cn(
                    "gap-2",
                    dateRange?.from && !(isToday(dateRange.from) && (!dateRange.to || isToday(dateRange.to))) && "animate-pulse"
                  )}
                >
                  {dateRange?.from && !(isToday(dateRange.from) && (!dateRange.to || isToday(dateRange.to))) && (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <CalendarIcon className="h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to && dateRange.from.getTime() !== dateRange.to.getTime() ? (
                      <>
                        {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}
                      </>
                    ) : (
                      format(dateRange.from, 'EEE, MMM d')
                    )
                  ) : (
                    'Select dates'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            
            {/* Quick range buttons */}
            <Button
              variant={dateRange?.from && !(isToday(dateRange.from) && (!dateRange.to || isToday(dateRange.to))) ? "default" : "ghost"}
              size="sm"
              onClick={() => setDateRange({ from: new Date(), to: new Date() })}
              className={cn(
                "text-primary",
                dateRange?.from && !(isToday(dateRange.from) && (!dateRange.to || isToday(dateRange.to))) && "ring-2 ring-primary ring-offset-2"
              )}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const now = new Date();
                setDateRange({
                  from: startOfWeek(now, { weekStartsOn: 1 }),
                  to: endOfWeek(now, { weekStartsOn: 1 })
                });
              }}
            >
              This Week
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const lastWeek = subWeeks(new Date(), 1);
                setDateRange({
                  from: startOfWeek(lastWeek, { weekStartsOn: 1 }),
                  to: endOfWeek(lastWeek, { weekStartsOn: 1 })
                });
              }}
            >
              Last Week
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSound}
              className={cn(
                "relative",
                soundEnabled ? "text-primary" : "text-muted-foreground"
              )}
              title={soundEnabled ? "Sound notifications on" : "Sound notifications off"}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSwitchPicker}
              className="text-primary border-primary/50 hover:bg-primary/10"
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Switch Picker
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLeaderboard(!showLeaderboard)}
              className={cn(showLeaderboard && 'bg-accent')}
            >
              <Trophy className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Leaderboard</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSessionEnd}
              className="text-muted-foreground"
            >
              <LogOut className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">End Session</span>
            </Button>
          </div>
        </div>

        {/* Critical warning banner when viewing non-today date range */}
        {dateRange?.from && !(isToday(dateRange.from) && (!dateRange.to || isToday(dateRange.to))) && (
          <div className="mb-4 bg-destructive/10 border-2 border-destructive rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive flex-shrink-0 animate-bounce" />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-destructive uppercase tracking-wide">
                  ⚠️ Caution: Not Today's Orders
                </h3>
                <p className="text-destructive/80 mt-1">
                  You are viewing orders from: <strong>{format(dateRange.from, 'EEEE, MMMM d, yyyy')}</strong>
                  {dateRange.to && dateRange.from.getTime() !== dateRange.to.getTime() && (
                    <strong> - {format(dateRange.to, 'EEEE, MMMM d, yyyy')}</strong>
                  )}
                </p>
                <p className="text-sm text-destructive/70 mt-1">
                  Do NOT pick these orders unless specifically instructed.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDateRange({ from: new Date(), to: new Date() })}
              >
                ← Return to Today
              </Button>
            </div>
          </div>
        )}

        {showLeaderboard && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Today's Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PickerLeaderboard
                stats={leaderboardStats || []}
                currentPickerName={pickerName}
              />
            </CardContent>
          </Card>
        )}

        {/* Items Overview Table */}
        <ItemsOverviewTable
          queueItems={queueItems || []}
          allOrderItems={allQueueOrderItems || []}
          isLoading={isLoadingAllItems}
        />

        <div className="grid lg:grid-cols-2 gap-4 mt-4">
          {/* Order Queue - Zone Based */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Order Queue
                <Badge variant="secondary">{queueItems?.length || 0}</Badge>
              </h2>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : Object.keys(ordersByZone).length > 0 ? (
              <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
                {Object.entries(ordersByZone).map(([zone, orders]) => (
                  <PickerQueueZone
                    key={zone}
                    zoneName={zone}
                    orders={orders}
                    selectedOrderId={selectedQueue}
                    onOrderSelect={setSelectedQueue}
                    currentPickerName={pickerName}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No orders in queue</p>
                  <p className="text-sm">New orders will appear here automatically</p>
                </CardContent>
              </Card>
            )}

            {/* Completed Orders - Editable */}
            {completedOrders && completedOrders.length > 0 && (
              <Collapsible open={showCompletedOrders} onOpenChange={setShowCompletedOrders}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between px-2 py-1 h-auto">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Recently Completed
                      <Badge variant="secondary" className="text-xs">
                        {completedOrders.length}
                      </Badge>
                    </span>
                    {showCompletedOrders ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {completedOrders.map((order: any) => {
                    const completedTime = order.completed_at 
                      ? new Date(order.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '';
                    const isEditable = order.fnb_orders?.status === 'ready'; // Can only edit if not yet delivered
                    
                    return (
                      <Card 
                        key={order.id} 
                        className={cn(
                          "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30",
                          !isEditable && "opacity-60"
                        )}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">
                                {order.fnb_orders?.order_number}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {order.fnb_orders?.fnb_customers?.name}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3" />
                                Completed at {completedTime}
                                {order.picker_name && (
                                  <span className="ml-2">by {order.picker_name}</span>
                                )}
                              </p>
                            </div>
                            {isEditable ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => reopenOrderMutation.mutate(order.id)}
                                disabled={reopenOrderMutation.isPending}
                                className="gap-1"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                {order.fnb_orders?.status === 'delivered' ? 'Delivered' : order.fnb_orders?.status}
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          {/* Order Details & Picking */}
          <Card className="h-fit sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {selectedQueueItem
                  ? `Order ${selectedQueueItem.fnb_orders?.order_number}`
                  : 'Select an Order'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedQueueItem ? (
                <div className="space-y-4">
                  {/* Customer Info */}
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="font-medium">
                      {selectedQueueItem.fnb_orders?.fnb_customers?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedQueueItem.fnb_orders?.fnb_customers?.address}
                    </p>
                    {selectedQueueItem.fnb_orders?.notes && (
                      <p className="text-sm mt-2 text-orange-600 dark:text-orange-400 flex items-start gap-1">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        {selectedQueueItem.fnb_orders.notes}
                      </p>
                    )}
                  </div>

                  {/* Claim Button */}
                  {selectedQueueItem.status === 'queued' && (
                    <>
                      <Button
                        className="w-full h-16 text-lg"
                        onClick={() => claimMutation.mutate(selectedQueueItem.id)}
                        disabled={claimMutation.isPending}
                      >
                        <User className="mr-2 h-5 w-5" />
                        Claim This Order
                      </Button>

                      {/* Items Preview for unclaimed orders */}
                      {orderItems && orderItems.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-medium text-sm text-muted-foreground">
                              Items Preview ({orderItems.length} items)
                            </h4>
                          </div>
                          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                            {orderItems.map((item: any) => {
                              const isWeightBased = item.fnb_products?.is_weight_based || false;
                              return (
                                <div
                                  key={item.id}
                                  className="p-3 rounded-lg bg-muted/50 border border-border/50"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <p className="font-medium text-sm">{item.fnb_products?.name}</p>
                                        {isWeightBased && (
                                          <Scale className="h-3 w-3 text-blue-500" />
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {item.fnb_products?.code}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-bold text-sm">
                                        {item.quantity} {item.fnb_products?.unit}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Collaboration banner - shown when helping another picker */}
                  {selectedQueueItem.status === 'in_progress' && !isOwner && canCollaborate && (
                    <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-3">
                        <User className="h-8 w-8 text-purple-600 dark:text-purple-400 shrink-0" />
                        <div>
                          <p className="font-medium text-purple-800 dark:text-purple-200">
                            Helping {selectedQueueItem.picker_name}
                          </p>
                          <p className="text-sm text-purple-700 dark:text-purple-300">
                            You can pick any unpicked items. Items picked by others are locked.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Items List with Quantity Adjustment - Allow collaboration */}
                  {(isOwner || canCollaborate) && orderItems && (
                    <>
                      {/* Active Pickers Banner - Show who is picking this order */}
                      {(() => {
                        const activePickers = orderItems
                          .filter((item: any) => item.picked_by && item.picker_name)
                          .reduce((acc: { name: string; count: number; isMe: boolean }[], item: any) => {
                            const existing = acc.find(p => p.name === item.picker_name);
                            if (existing) {
                              existing.count++;
                            } else {
                              acc.push({ 
                                name: item.picker_name, 
                                count: 1, 
                                isMe: item.picked_by === user?.id 
                              });
                            }
                            return acc;
                          }, []);
                        
                        if (activePickers.length > 0) {
                          return (
                            <div className="flex items-center gap-2 flex-wrap p-2 bg-muted/50 rounded-lg">
                              <span className="text-xs font-medium text-muted-foreground">Picking:</span>
                              {activePickers.map((picker, idx) => (
                                <Badge 
                                  key={idx}
                                  variant="outline" 
                                  className={cn(
                                    "text-xs",
                                    picker.isMe 
                                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-400" 
                                      : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-purple-400"
                                  )}
                                >
                                  <User className="h-3 w-3 mr-1" />
                                  {picker.isMe ? 'You' : picker.name} ({picker.count})
                                </Badge>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{pickedCount} / {totalCount} items</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>

                      {/* Reported Shortages Info - Non-blocking */}
                      {hasReportedShortages && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                          <div>
                            <p className="font-medium text-blue-800 dark:text-blue-200">Shortages Reported</p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              Supervisor has been notified - you can continue
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        <h4 className="font-medium sticky top-0 bg-card py-1">Items to Pick</h4>
                        {orderItems.map((item: any) => {
                          const pickedQty = pickedQuantities[item.id] ?? item.quantity;
                          const isShort = pickedQty < item.quantity;
                          const isOverPicked = pickedQty > item.quantity;
                          const isReported = item.shortage_status === 'reported';
                          const isWeightBased = item.fnb_products?.is_weight_based || false;
                          const isComplete = pickedQty === item.quantity;

                          // Visual status: green for complete, blue for reported, orange for short
                          const getBorderColor = () => {
                            if (isReported) return 'border-blue-400 dark:border-blue-600';
                            if (isOverPicked && isWeightBased) return 'border-blue-400 dark:border-blue-600';
                            if (isShort) return 'border-orange-400 dark:border-orange-600';
                            if (isComplete) return 'border-green-400 dark:border-green-600';
                            return 'border-border';
                          };

                          const getBgColor = () => {
                            if (isReported) return 'bg-blue-50 dark:bg-blue-950';
                            if (isOverPicked && isWeightBased) return 'bg-blue-50 dark:bg-blue-950';
                            if (isShort) return 'bg-orange-50 dark:bg-orange-950';
                            if (isComplete) return 'bg-green-50 dark:bg-green-950';
                            return 'bg-card';
                          };

                          // Derive checked state from database (picked_by is set)
                          const isCheckedByMe = item.picked_by === user?.id;
                          const isCheckedByOther = item.picked_by && item.picked_by !== user?.id;
                          const isChecked = !!item.picked_by;
                          const pickerDisplayName = item.picker_name || 'Unknown';

                          return (
                            <div
                              key={item.id}
                              className={cn(
                                'py-2 px-3 rounded-lg border-2 transition-colors',
                                getBorderColor(),
                                getBgColor(),
                                isChecked && 'opacity-70'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                {/* Picked Checkbox */}
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    checkItemMutation.mutate({ itemId: item.id, checked: !!checked });
                                  }}
                                  disabled={isCheckedByOther || checkItemMutation.isPending}
                                  className={cn(
                                    "h-5 w-5 shrink-0",
                                    isCheckedByOther && "opacity-50 cursor-not-allowed"
                                  )}
                                />
                                
                                <div className="flex items-start justify-between flex-1 min-w-0">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className={cn(
                                        "text-sm font-medium truncate",
                                        isChecked && "line-through text-muted-foreground"
                                      )}>{item.fnb_products?.name}</p>
                                      {isWeightBased && (
                                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 shrink-0">
                                          <Scale className="h-3 w-3 mr-1" />
                                          Weight
                                        </Badge>
                                      )}
                                      {/* Picker attribution badge */}
                                      {isCheckedByMe && (
                                        <Badge variant="outline" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-400 shrink-0">
                                          <User className="h-3 w-3 mr-1" />
                                          You
                                        </Badge>
                                      )}
                                      {isCheckedByOther && (
                                        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-purple-400 shrink-0">
                                          <User className="h-3 w-3 mr-1" />
                                          {pickerDisplayName}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {item.fnb_products?.code}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0 ml-2">
                                    <p className="text-xs text-muted-foreground">Ordered</p>
                                    <p className="text-sm font-bold">
                                      {item.quantity} {item.fnb_products?.unit}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              {/* Status badges - shown inline */}
                              {(isReported || (isOverPicked && isWeightBased)) && (
                                <div className="flex items-center gap-2 mt-1 ml-8">
                                  {isReported && editingShortageItem !== item.id && (
                                    <>
                                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-400">
                                        Shortage Reported
                                      </Badge>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-1.5 text-xs text-blue-600 hover:text-blue-700"
                                        onClick={() => setEditingShortageItem(item.id)}
                                      >
                                        <Edit className="h-3 w-3 mr-1" />
                                        Edit
                                      </Button>
                                    </>
                                  )}
                                  {isOverPicked && isWeightBased && (
                                    <Badge variant="outline" className="text-xs text-blue-600 border-blue-400">
                                      Over-picked (+{(pickedQty - item.quantity).toFixed(2)})
                                    </Badge>
                                  )}
                                </div>
                              )}

                              {/* Quantity/Weight Input */}
                              <div className="mt-2 ml-8">
                                {isWeightBased ? (
                                  /* Weight-based items: Direct weight input */
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Scale className="h-4 w-4 text-blue-500" />
                                      <span className="text-xs font-medium">Weight:</span>
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          placeholder="Enter weight"
                                          value={pickedQty || ''}
                                          onChange={(e) => {
                                            const value = parseFloat(e.target.value) || 0;
                                            setPickedQuantities({
                                              ...pickedQuantities,
                                              [item.id]: Math.max(0, value),
                                            });
                                          }}
                                          className="w-20 h-9 text-center text-sm font-bold"
                                          disabled={isCheckedByOther || (isReported && editingShortageItem !== item.id)}
                                        />
                                        <Select
                                          value={pickedUnits[item.id] || item.order_unit || item.fnb_products?.weight_unit || 'kg'}
                                          onValueChange={(v) => setPickedUnits({ ...pickedUnits, [item.id]: v })}
                                          disabled={isCheckedByOther || (isReported && editingShortageItem !== item.id)}
                                        >
                                          <SelectTrigger className="w-16 h-9 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {PICKER_UNITS.map((u) => (
                                              <SelectItem key={u.value} value={u.value}>
                                                {u.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      
                                      {/* Weight Accuracy Indicator */}
                                      {pickedQty > 0 && (
                                        <WeightAccuracyIndicator
                                          expectedWeight={item.quantity}
                                          actualWeight={pickedQty}
                                          unit={pickedUnits[item.id] || item.fnb_products?.weight_unit || 'kg'}
                                          size="sm"
                                        />
                                      )}
                                    </div>
                                    
                                    {/* Weight status message */}
                                    {pickedQty > 0 && (
                                      <div className={cn(
                                        "flex items-center gap-2 text-sm px-3 py-1.5 rounded-md",
                                        pickedQty === item.quantity && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
                                        pickedQty > item.quantity && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                                        pickedQty < item.quantity && "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                      )}>
                                        {pickedQty === item.quantity && (
                                          <>
                                            <CheckCircle className="h-4 w-4" />
                                            Exact weight matched
                                          </>
                                        )}
                                        {pickedQty > item.quantity && (
                                          <>
                                            <Scale className="h-4 w-4" />
                                            Over by {(pickedQty - item.quantity).toFixed(2)} {pickedUnits[item.id] || item.fnb_products?.weight_unit || 'kg'}
                                          </>
                                        )}
                                        {pickedQty < item.quantity && (
                                          <>
                                            <AlertTriangle className="h-4 w-4" />
                                            Short by {(item.quantity - pickedQty).toFixed(2)} {pickedUnits[item.id] || item.fnb_products?.weight_unit || 'kg'}
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  /* Fixed quantity items: +/- buttons with unit selector */
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-medium">Picked:</span>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 w-9 text-base touch-manipulation"
                                        onClick={() =>
                                          setPickedQuantities({
                                            ...pickedQuantities,
                                            [item.id]: Math.max(0, pickedQty - 1),
                                          })
                                        }
                                        disabled={isCheckedByOther || (isReported && editingShortageItem !== item.id)}
                                      >
                                        -
                                      </Button>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={pickedQty}
                                        onChange={(e) => {
                                          const value = parseFloat(e.target.value) || 0;
                                          setPickedQuantities({
                                            ...pickedQuantities,
                                            [item.id]: Math.max(0, value),
                                          });
                                        }}
                                        className="w-16 h-9 text-center text-sm font-bold"
                                        disabled={isCheckedByOther || (isReported && editingShortageItem !== item.id)}
                                      />
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 w-9 text-base touch-manipulation"
                                        onClick={() =>
                                          setPickedQuantities({
                                            ...pickedQuantities,
                                            [item.id]: pickedQty + 1,
                                          })
                                        }
                                        disabled={isCheckedByOther || (isReported && editingShortageItem !== item.id)}
                                      >
                                        +
                                      </Button>
                                      <Select
                                        value={pickedUnits[item.id] || item.order_unit || item.fnb_products?.unit || 'pcs'}
                                        onValueChange={(v) => setPickedUnits({ ...pickedUnits, [item.id]: v })}
                                        disabled={isCheckedByOther || (isReported && editingShortageItem !== item.id)}
                                      >
                                        <SelectTrigger className="w-16 h-9 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {PICKER_UNITS.map((u) => (
                                            <SelectItem key={u.value} value={u.value}>
                                              {u.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Save button when editing a reported shortage */}
                                {editingShortageItem === item.id && (
                                  <div className="flex gap-2 mt-2">
                                    <Button
                                      size="sm"
                                      className="h-10"
                                      onClick={() => resolveShortageByPickerMutation.mutate({
                                        itemId: item.id,
                                        newPickedQuantity: pickedQty,
                                      })}
                                      disabled={resolveShortageByPickerMutation.isPending}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      {pickedQty >= item.quantity ? 'Resolve' : 'Update'}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-10"
                                      onClick={() => {
                                        setEditingShortageItem(null);
                                        setPickedQuantities(prev => ({
                                          ...prev,
                                          [item.id]: item.picked_quantity ?? item.quantity,
                                        }));
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {/* Inline Shortage Quick Buttons - only show for short items not yet reported */}
                              {isShort && !isReported && (
                                <div className="mt-3 space-y-2">
                                  <p className="text-xs text-muted-foreground">
                                    Short {(item.quantity - pickedQty).toFixed(isWeightBased ? 2 : 0)} - Select reason:
                                  </p>
                                  <ShortageQuickButtons
                                    compact
                                    onSelect={(reason) => {
                                      setShortReasons(prev => ({
                                        ...prev,
                                        [item.id]: reason,
                                      }));
                                      // Auto-submit shortage with selected reason
                                      shortageRequestMutation.mutate({
                                        itemId: item.id,
                                        availableQuantity: pickedQty,
                                        reason,
                                      });
                                    }}
                                    selectedReason={shortReasons[item.id]}
                                    disabled={shortageRequestMutation.isPending}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Assistance Button */}
                      <AssistanceButton
                        pickerQueueId={selectedQueueItem.id}
                        pickerName={pickerName}
                        orderNumber={selectedQueueItem.fnb_orders?.order_number || ''}
                        disabled={completeMutation.isPending}
                      />

                      {/* Complete Button - anyone can complete once all items are picked */}
                      {(() => {
                        const allItemsPicked = orderItems?.every(item => item.picked_by !== null) ?? false;
                        const canComplete = isOwner || allItemsPicked;
                        
                        if (canComplete) {
                          return (
                            <Button
                              className="w-full h-16 text-lg"
                              onClick={() => {
                                // Calculate total weight from individual items
                                const totalWeight = orderItems?.reduce((sum: number, item: any) => {
                                  const pickedQty = pickedQuantities[item.id] ?? item.quantity;
                                  const isWeightBased = item.fnb_products?.is_weight_based || false;
                                  return sum + (isWeightBased ? pickedQty : pickedQty * 0.5);
                                }, 0) || 0;
                                
                                completeMutation.mutate({
                                  queueId: selectedQueue!,
                                  verifiedWeight: totalWeight,
                                });
                              }}
                              disabled={
                                !allItemsReviewed ||
                                hasUnreasonedShorts ||
                                completeMutation.isPending
                              }
                            >
                              <CheckCircle className="mr-2 h-5 w-5" />
                              Complete Order
                            </Button>
                          );
                        }
                        
                        const pickedCount = orderItems?.filter(item => item.picked_by !== null).length || 0;
                        const totalCount = orderItems?.length || 0;
                        
                        return (
                          <div className="p-3 bg-muted rounded-lg text-center">
                            <p className="text-sm text-muted-foreground">
                              Pick remaining items to enable completion ({pickedCount}/{totalCount} picked)
                            </p>
                          </div>
                        );
                      })()}

                      {hasUnreasonedShorts && isOwner && (
                        <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                          Please report shortages for items with reduced quantities
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select an order from the queue to start picking</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Weight Verification Dialog - No longer used, kept for potential future use */}

      {/* Shortage Request Dialog */}
      <ShortageRequestDialog
        open={!!shortageItem}
        onOpenChange={(open) => !open && setShortageItem(null)}
        item={shortageItem}
        onSubmit={shortageRequestMutation.mutate}
        isLoading={shortageRequestMutation.isPending}
      />
    </div>
  );
}
