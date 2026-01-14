import { useState, useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import { useFnbStandingOrdersSync } from '@/hooks/useFnbStandingOrdersSync';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useNewFnbOrderNotifications } from '@/hooks/useNewFnbOrderNotifications';
import { toast } from 'sonner';
import { 
  ArrowLeft,
  Search, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Package,
  Store,
  Banknote,
  CreditCard,
  CheckCircle,
  Clock,
  Camera,
  AlertCircle,
  Truck,
  Target,
  Edit,
  X,
  PlusCircle,
  ClipboardList,
  Repeat,
  GripVertical,
  Volume2,
  VolumeX,
  RefreshCw
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link, useNavigate } from 'react-router-dom';
import { format, addDays, startOfWeek, isSameDay, parseISO, getISOWeek } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FnbOrderDayDialog } from '@/components/fnb/FnbOrderDayDialog';
import { QuickAddItemDialog } from '@/components/fnb/QuickAddItemDialog';
import { ExportButton } from '@/components/reports/ExportButton';
import { NewOrderToast } from '@/components/fnb/NewOrderToast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  pointerWithin,
  rectIntersection,
  CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Cast the backend client to `any` in this page to avoid excessively-deep type instantiation errors
// from complex nested selects (keeps runtime behavior the same).
const supabase = supabaseClient as any;

type CustomerType = 'regular' | 'supermarket' | 'cod' | 'credit';

interface OrderWithDetails {
  id: string;
  order_number: string;
  status: string;
  total_xcg: number | null;
  delivery_date: string | null;
  delivery_station: string | null;
  driver_name: string | null;
  payment_method: string | null;
  receipt_photo_url: string | null;
  receipt_verified_at: string | null;
  quickbooks_invoice_id: string | null;
  is_pickup: boolean | null;
  po_number: string | null;
  notes: string | null;
  distribution_customers: {
    name: string;
    whatsapp_phone?: string;
    delivery_zone: string | null;
    customer_type: CustomerType;
  } | null;
  distribution_order_items?: { 
    id: string;
    quantity: number;
    picked_quantity: number | null;
    short_quantity: number | null;
    unit_price_xcg: number;
    distribution_products: {
      name: string;
      code: string;
    } | null;
  }[];
}

const isStandingOrder = (order: OrderWithDetails) => {
  return order.notes?.startsWith('Auto-generated from standing order:') ?? false;
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  picking: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  out_for_delivery: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  delivered: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  cancelled: 'bg-destructive/10 text-destructive',
};

const zoneColors: Record<string, string> = {
  'Willemstad': 'border-l-blue-500',
  'Otrobanda': 'border-l-green-500',
  'Punda': 'border-l-purple-500',
  'Pietermaai': 'border-l-orange-500',
  'Scharloo': 'border-l-pink-500',
  'Salinja': 'border-l-teal-500',
  'default': 'border-l-muted-foreground',
};

const customerTypeIcons: Record<CustomerType, React.ReactNode> = {
  regular: <Package className="h-3 w-3" />,
  supermarket: <Store className="h-3 w-3" />,
  cod: <Banknote className="h-3 w-3" />,
  credit: <CreditCard className="h-3 w-3" />,
};

const customerTypeLabels: Record<CustomerType, string> = {
  regular: 'Regular',
  supermarket: 'Supermarket',
  cod: 'COD',
  credit: 'Credit',
};

// Sortable Order Card wrapper (supports both within-day reorder and cross-day drag)
function SortableOrderCard({ 
  order,
  children 
}: { 
  order: OrderWithDetails; 
  children: React.ReactNode;
}) {
  const isDisabled = order.status === 'delivered' || order.status === 'cancelled';
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: order.id,
    data: { order, date: order.delivery_date },
    disabled: isDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group',
        isDragging && 'opacity-50 z-50'
      )}
    >
      {/* Drag handle */}
      {!isDisabled && (
        <div
          {...listeners}
          {...attributes}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 opacity-0 group-hover:opacity-100 
                     cursor-grab active:cursor-grabbing p-1 rounded bg-muted/80 transition-opacity z-10"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      {children}
    </div>
  );
}

// Droppable Day Column wrapper
function DroppableDayColumn({ 
  date, 
  isOver,
  children 
}: { 
  date: Date; 
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({
    id: format(date, 'yyyy-MM-dd'),
    data: { date },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'h-full transition-colors rounded-lg',
        isOver && 'bg-primary/10 ring-2 ring-primary ring-dashed'
      )}
    >
      {children}
    </div>
  );
}

export default function FnbOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [quickAddOrder, setQuickAddOrder] = useState<{ id: string; orderNumber: string } | null>(null);
  const [activeOrder, setActiveOrder] = useState<OrderWithDetails | null>(null);
  const [cancelOrderData, setCancelOrderData] = useState<{ id: string; orderNumber: string; status: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeDropTarget, setActiveDropTarget] = useState<string | null>(null);

  // Real-time updates for distribution_orders - auto-refresh when orders are created/updated/deleted
  const { lastUpdate } = useRealtimeUpdates(['distribution_orders'], [['fnb-orders-weekly']]);

  // Track time since last update
  const [timeAgo, setTimeAgo] = useState<string>('Just now');
  
  useEffect(() => {
    const updateTimeAgo = () => {
      if (!lastUpdate) {
        setTimeAgo('Just now');
        return;
      }
      
      const seconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
      
      if (seconds < 5) setTimeAgo('Just now');
      else if (seconds < 60) setTimeAgo(`${seconds}s ago`);
      else if (seconds < 3600) setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
      else setTimeAgo(`${Math.floor(seconds / 3600)}h ago`);
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 1000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['fnb-orders-weekly'] });
    toast.success('Orders refreshed');
  };

  // New order notifications with sound
  const {
    notifications: orderNotifications,
    isMinimized: notificationsMinimized,
    soundEnabled,
    toggleSound,
    minimize: minimizeNotifications,
    expand: expandNotifications,
    dismissNotification,
  } = useNewFnbOrderNotifications();

  // Configure DnD sensors with higher thresholds
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  // Custom collision detection: prioritize day columns for cross-day drops
  const customCollisionDetection: CollisionDetection = (args) => {
    // Get all collisions using pointer within
    const pointerCollisions = pointerWithin(args);
    
    // Check if we're over a day column (date string format)
    const dayColumnCollisions = pointerCollisions.filter(
      collision => /^\d{4}-\d{2}-\d{2}$/.test(collision.id as string)
    );
    
    // If we're over a day column that's different from the dragged item's day, prioritize it
    if (dayColumnCollisions.length > 0 && args.active.data.current?.date) {
      const activeDate = args.active.data.current.date;
      const differentDayCollision = dayColumnCollisions.find(c => c.id !== activeDate);
      if (differentDayCollision) {
        setActiveDropTarget(differentDayCollision.id as string);
        return [differentDayCollision];
      }
    }
    
    // Fall back to rect intersection for within-day reordering
    const rectCollisions = rectIntersection(args);
    setActiveDropTarget(null);
    return rectCollisions;
  };

  const { generateForDateRange } = useFnbStandingOrdersSync();

  // Auto-generate standing orders for the visible week
  useEffect(() => {
    const syncStandingOrders = async () => {
      const weekEnd = addDays(weekStart, 6);
      const ordersCreated = await generateForDateRange(weekStart, weekEnd);
      if (ordersCreated > 0) {
        // Refetch orders if new ones were created
        queryClient.invalidateQueries({ queryKey: ['fnb-orders-weekly'] });
      }
    };
    syncStandingOrders();
  }, [weekStart, generateForDateRange, queryClient]);

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const weekDays = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)); // Mon-Sat

  // Fetch orders for the week
  const { data: orders, isLoading } = useQuery({
    queryKey: ['fnb-orders-weekly', format(weekStart, 'yyyy-MM-dd'), statusFilter],
    queryFn: async () => {
      const weekEnd = addDays(weekStart, 6);
      let query = supabase
        .from('distribution_orders')
        .select(`
          id,
          order_number,
          status,
          total_xcg,
          delivery_date,
          delivery_station,
          driver_name,
          payment_method,
          receipt_photo_url,
          receipt_verified_at,
          quickbooks_invoice_id,
          is_pickup,
          po_number,
          notes,
          distribution_customers (name, whatsapp_phone, delivery_zone, customer_type),
          distribution_order_items (id, quantity, picked_quantity, short_quantity, unit_price_xcg, distribution_products (name, code))
        `)
        .gte('delivery_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('delivery_date', format(weekEnd, 'yyyy-MM-dd'))
        .order('delivery_date', { ascending: true })
        .order('priority', { ascending: true });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      } else {
        query = query.neq('status', 'cancelled');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (OrderWithDetails & { priority?: number })[];
    },
  });

  const getOrdersForDay = (day: Date) => {
    let dayOrders = orders?.filter((order) => {
      if (!order.delivery_date) return false;
      return isSameDay(parseISO(order.delivery_date), day);
    }) || [];

    // Sort by priority within the day
    dayOrders.sort((a, b) => ((a as any).priority || 0) - ((b as any).priority || 0));

    // Apply search filter
    if (searchTerm) {
      dayOrders = dayOrders.filter(
        (o) =>
          o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          o.distribution_customers?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return dayOrders;
  };

  const getZoneColor = (zone: string | null) => {
    return zone ? (zoneColors[zone] || zoneColors.default) : zoneColors.default;
  };

  const getDayStats = (dayOrders: OrderWithDetails[]) => {
    const total = dayOrders.length;
    const delivered = dayOrders.filter((o) => o.status === 'delivered').length;
    const pending = dayOrders.filter((o) => o.status === 'pending').length;
    const pendingReceipts = dayOrders.filter(
      (o) => o.distribution_customers?.customer_type === 'supermarket' && o.status === 'delivered' && !o.receipt_verified_at
    ).length;
    const codTotal = dayOrders
      .filter((o) => o.distribution_customers?.customer_type === 'cod' || o.payment_method === 'cod')
      .reduce((sum, o) => sum + (o.total_xcg || 0), 0);
    const totalXCG = dayOrders.reduce((sum, o) => sum + (o.total_xcg || 0), 0);
    
    // Total items count
    const totalItems = dayOrders.reduce((sum, order) => {
      return sum + (order.distribution_order_items?.reduce((itemSum, item) => 
        itemSum + (item.quantity || 0), 0) || 0);
    }, 0);
    
    // Picking accuracy calculation
    let totalOrdered = 0;
    let totalPicked = 0;
    dayOrders.forEach(order => {
      order.distribution_order_items?.forEach(item => {
        if (item.picked_quantity !== null) {
          totalOrdered += item.quantity || 0;
          totalPicked += item.picked_quantity || 0;
        }
      });
    });
    const pickingAccuracy = totalOrdered > 0 
      ? Math.round((totalPicked / totalOrdered) * 100) 
      : null;
    
    return { total, delivered, pending, pendingReceipts, codTotal, totalXCG, totalItems, pickingAccuracy };
  };

  const previousWeek = () => setWeekStart(addDays(weekStart, -7));
  const nextWeek = () => setWeekStart(addDays(weekStart, 7));
  const goToToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Confirm a single order - add to picker queue and update status
  const confirmOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // Add to picker queue
      const { error: queueError } = await supabase
        .from('distribution_picker_queue')
        .insert({
          order_id: orderId,
          status: 'queued',
          priority: 0,
        });
      
      if (queueError) throw queueError;
      
      // Update order status
      const { error: updateError } = await supabase
        .from('distribution_orders')
        .update({ status: 'confirmed' })
        .eq('id', orderId);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-orders-weekly'] });
      toast.success('Order confirmed and sent to picking queue');
    },
    onError: (error) => {
      toast.error('Failed to confirm order');
      console.error(error);
    }
  });

  // Confirm all pending orders for a specific day
  const confirmAllPendingMutation = useMutation({
    mutationFn: async (date: Date) => {
      const dayOrders = getOrdersForDay(date).filter(o => o.status === 'pending');
      
      for (const order of dayOrders) {
        await supabase.from('distribution_picker_queue').insert({
          order_id: order.id,
          status: 'queued',
          priority: 0,
        });
        
        await supabase.from('distribution_orders')
          .update({ status: 'confirmed' })
          .eq('id', order.id);
      }
      
      return dayOrders.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['fnb-orders-weekly'] });
      toast.success(`${count} orders confirmed and sent to picking queue`);
    },
    onError: (error) => {
      toast.error('Failed to confirm orders');
      console.error(error);
    }
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async ({ orderId, orderStatus }: { orderId: string; orderStatus: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Log the cancellation
      await supabase.from('distribution_order_modifications').insert({
        order_id: orderId,
        modified_by: user?.id,
        modified_by_email: user?.email,
        modification_type: 'status_changed',
        previous_value: { status: orderStatus },
        new_value: { status: 'cancelled' },
        notes: 'Order cancelled',
      });

      // Remove from picker queue if present
      await supabase.from('distribution_picker_queue').delete().eq('order_id', orderId);
      
      // Update order status
      const { error } = await supabase
        .from('distribution_orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-orders-weekly'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-picker-queue'] });
      toast.success('Order cancelled');
    },
    onError: () => {
      toast.error('Failed to cancel order');
    }
  });

  // Drag-and-drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const order = event.active.data.current?.order as OrderWithDetails;
    setActiveOrder(order || null);
    setIsDragging(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOrder(null);
    setIsDragging(false);
    setActiveDropTarget(null);

    if (!over || !active) return;

    const orderId = active.id as string;
    const order = orders?.find(o => o.id === orderId);
    if (!order) return;

    // Check if dropping on a day column (date change) - over.id is a date string
    const isDateColumn = typeof over.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(over.id);
    
    if (isDateColumn) {
      const newDate = over.id as string;
      // Check if date actually changed
      if (order.delivery_date === newDate) return;

      // Optimistic update
      queryClient.setQueryData(['fnb-orders-weekly', format(weekStart, 'yyyy-MM-dd'), statusFilter], 
        (old: OrderWithDetails[] | undefined) => 
          old?.map(o => o.id === orderId ? { ...o, delivery_date: newDate } : o)
      );

      const { error } = await supabase
        .from('distribution_orders')
        .update({ delivery_date: newDate })
        .eq('id', orderId);

      if (error) {
        toast.error('Failed to move order');
        queryClient.invalidateQueries({ queryKey: ['fnb-orders-weekly'] });
      } else {
        toast.success(`Order moved to ${format(parseISO(newDate), 'EEE, MMM d')}`);
      }
      return;
    }

    // Check if dropping on another order (reorder within day)
    const overOrder = orders?.find(o => o.id === over.id);
    if (overOrder && order.delivery_date === overOrder.delivery_date) {
      const dayOrders = getOrdersForDay(parseISO(order.delivery_date!));
      const oldIndex = dayOrders.findIndex(o => o.id === orderId);
      const newIndex = dayOrders.findIndex(o => o.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reorderedOrders = arrayMove(dayOrders, oldIndex, newIndex);
        
        // Optimistic update
        const priorityMap = new Map(reorderedOrders.map((o, idx) => [o.id, idx]));
        queryClient.setQueryData(['fnb-orders-weekly', format(weekStart, 'yyyy-MM-dd'), statusFilter], 
          (old: (OrderWithDetails & { priority?: number })[] | undefined) => 
            old?.map(o => priorityMap.has(o.id) ? { ...o, priority: priorityMap.get(o.id) } : o)
        );

        // Batch update priorities in database
        const updates = reorderedOrders.map((o, index) => 
          supabase.from('distribution_orders').update({ priority: index }).eq('id', o.id)
        );
        
        const results = await Promise.all(updates);
        const hasError = results.some(r => r.error);
        
        if (hasError) {
          toast.error('Failed to update order sequence');
          queryClient.invalidateQueries({ queryKey: ['fnb-orders-weekly'] });
        } else {
          toast.success('Order sequence updated');
        }
      }
    }
  };

  const renderOrderCard = (order: OrderWithDetails) => {
    const customerType = order.distribution_customers?.customer_type || 'regular';
    const isSupermarket = customerType === 'supermarket';
    const needsReceipt = isSupermarket && order.status === 'delivered' && !order.receipt_verified_at;
    const hasReceipt = !!order.receipt_photo_url;
    const isVerified = !!order.receipt_verified_at;
    const isExpanded = expandedOrders.has(order.id);
    const totalItems = order.distribution_order_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

    const isPendingStandingOrder = order.status === 'pending' && isStandingOrder(order);

    return (
      <Collapsible
        key={order.id}
        open={isExpanded}
        onOpenChange={() => toggleOrderExpanded(order.id)}
      >
        <Card
          className={cn(
            'mb-2 transition-shadow border-l-4',
            getZoneColor(order.distribution_customers?.delivery_zone || null),
            needsReceipt && 'ring-2 ring-orange-400',
            isPendingStandingOrder && 'ring-2 ring-amber-400 animate-pulse',
            isExpanded && 'shadow-md'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Needs Confirmation Banner for pending standing orders */}
          {isPendingStandingOrder && (
            <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 
                            px-3 py-1.5 text-xs font-medium flex items-center gap-2 rounded-t-md">
              <AlertCircle className="h-3.5 w-3.5" />
              Standing order - needs confirmation before picking
            </div>
          )}
          <CollapsibleTrigger asChild>
            <CardContent className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="space-y-2">
                {/* Row 1: Customer name + Status + Chevron */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {isStandingOrder(order) && (
                      <Repeat className="h-4 w-4 text-blue-500 shrink-0" />
                    )}
                    <p className="font-semibold text-base line-clamp-1">{order.distribution_customers?.name || 'Unknown'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={cn('text-xs', statusColors[order.status])}>
                      {order.status?.replace('_', ' ')}
                    </Badge>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
                
                {/* Row 2: Items count + Station + Pickup badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Package className="h-4 w-4" />
                    <span className="font-medium text-sm">{totalItems} items</span>
                  </div>
                  {order.delivery_station && (
                    <Badge variant="secondary" className="text-xs font-medium bg-primary/10 text-primary">
                      {order.delivery_station}
                    </Badge>
                  )}
                  {order.is_pickup && (
                    <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 border-amber-300">
                      Pickup
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-3 pb-3 border-t pt-2 space-y-2">
              {/* Order details */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span>Order: {order.order_number}</span>
                {order.po_number && (
                  <Badge variant="outline" className="text-xs font-mono">
                    PO: {order.po_number}
                  </Badge>
                )}
              </div>

              {/* Customer type and zone */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  {customerTypeIcons[customerType]}
                  <span className="text-xs">{customerTypeLabels[customerType]}</span>
                </div>
                {order.distribution_customers?.delivery_zone && (
                  <Badge variant="outline" className="text-xs">
                    {order.distribution_customers.delivery_zone}
                  </Badge>
                )}
              </div>

              {/* Driver info */}
              {order.driver_name && (
                <div className="flex items-center gap-1 text-xs">
                  <Truck className="h-3 w-3" />
                  <span>Driver: {order.driver_name}</span>
                </div>
              )}

              {/* Payment method */}
              {order.payment_method && (
                <div className="flex items-center gap-1 text-xs">
                  <Banknote className="h-3 w-3" />
                  <span>Payment: {order.payment_method}</span>
                </div>
              )}

              {/* Order Items */}
              {order.distribution_order_items && order.distribution_order_items.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium">Items:</p>
                  <div className="space-y-1 pl-2 max-h-32 overflow-y-auto">
                    {order.distribution_order_items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="truncate flex-1">{item.distribution_products?.name || 'Unknown Product'}</span>
                        <span className="text-muted-foreground ml-2">x {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status indicators for supermarket orders */}
              {isSupermarket && order.status === 'delivered' && (
                <div className="flex items-center gap-2 text-xs">
                  {hasReceipt ? (
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      <Camera className="h-3 w-3 mr-1" />
                      Receipt
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      No Receipt
                    </Badge>
                  )}
                  {isVerified ? (
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 flex-wrap">
                {/* Confirm Order button for pending orders */}
                {order.status === 'pending' && (
                  <Button
                    variant="default"
                    size="sm"
                    className="text-xs h-7 bg-green-600 hover:bg-green-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmOrderMutation.mutate(order.id);
                    }}
                    disabled={confirmOrderMutation.isPending}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Confirm Order
                  </Button>
                )}
                {['confirmed', 'picking'].includes(order.status) && (
                  <Button
                    variant="default"
                    size="sm"
                    className="text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/fnb/picker/${order.id}`);
                    }}
                  >
                    <ClipboardList className="h-3 w-3 mr-1" />
                    Go to Picking
                  </Button>
                )}
                {!['delivered', 'cancelled'].includes(order.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickAddOrder({ id: order.id, orderNumber: order.order_number });
                    }}
                  >
                    <PlusCircle className="h-3 w-3 mr-1" />
                    Add Item
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/fnb/orders/edit/${order.id}`);
                  }}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                {!['delivered', 'cancelled'].includes(order.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCancelOrderData({ id: order.id, orderNumber: order.order_number, status: order.status });
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  };

  const selectedDayOrders = selectedDay ? getOrdersForDay(selectedDay) : [];

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      <div className="container py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/distribution">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Distribution Orders</h1>
            <p className="text-muted-foreground">
              View and manage orders by day
            </p>
          </div>
          <ExportButton
            data={(orders || []).map(o => ({
              order_number: o.order_number,
              customer: o.distribution_customers?.name || 'Unknown',
              status: o.status,
              delivery_date: o.delivery_date,
              total_xcg: o.total_xcg,
              items: o.distribution_order_items?.length || 0,
              zone: o.distribution_customers?.delivery_zone || '',
              driver: o.driver_name || '',
            }))}
            filename="fnb-orders"
            columns={['order_number', 'customer', 'status', 'delivery_date', 'total_xcg', 'items', 'zone', 'driver']}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSound}
            title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Button onClick={() => navigate('/fnb/orders/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </div>

        {/* Week Navigation */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={previousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-sm font-semibold">
                      Week {getISOWeek(weekStart)}
                    </Badge>
                    <h2 className="text-lg font-semibold">
                      {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 5), 'MMM d, yyyy')}
                    </h2>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon">
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={weekStart}
                        onSelect={(date) => date && setWeekStart(startOfWeek(date, { weekStartsOn: 1 }))}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Today
                  </Button>
                </div>
                <Button variant="outline" size="icon" onClick={nextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-4">
                {/* Last Updated Indicator */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className={cn(
                      "w-2 h-2 rounded-full bg-green-500",
                      timeAgo === 'Just now' && "animate-pulse"
                    )} />
                    Updated {timeAgo}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleManualRefresh}
                    title="Refresh orders"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-48"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="picking">Picking</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            <span>Supermarket (receipt required)</span>
          </div>
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            <span>COD</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span>Credit</span>
          </div>
        </div>

        {/* Calendar Grid with DnD */}
        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Loading orders...</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {weekDays.map((day) => {
                const dayOrders = getOrdersForDay(day);
                const stats = getDayStats(dayOrders);
                const isToday = isSameDay(day, new Date());
                const dateStr = format(day, 'yyyy-MM-dd');
                const isActiveDropTarget = activeDropTarget === dateStr;

                return (
                  <DroppableDayColumn 
                    key={day.toISOString()} 
                    date={day}
                    isOver={isActiveDropTarget}
                  >
                    <Card
                      className={cn(
                        'min-h-[400px] cursor-pointer hover:shadow-lg transition-shadow h-full',
                        isToday && 'ring-2 ring-primary'
                      )}
                      onClick={() => setSelectedDay(day)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isToday && (
                              <Badge className="bg-primary text-primary-foreground text-xs font-bold">
                                TODAY
                              </Badge>
                            )}
                            <span className={cn('font-bold', isToday && 'text-primary')}>
                              {format(day, 'EEE')}
                            </span>
                            <span className="text-muted-foreground">
                              {format(day, 'MMM d')}
                            </span>
                          </div>
                          <Badge variant={stats.total > 0 ? 'default' : 'secondary'}>
                            {stats.total}
                          </Badge>
                          {/* Confirm All Pending button */}
                          {stats.pending > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-6 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmAllPendingMutation.mutate(day);
                              }}
                              disabled={confirmAllPendingMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Confirm All ({stats.pending})
                            </Button>
                          )}
                        </CardTitle>
                        {/* Day Stats */}
                        {stats.total > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {stats.delivered > 0 && (
                              <Badge variant="outline" className="text-xs text-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {stats.delivered}
                              </Badge>
                            )}
                            {stats.pending > 0 && (
                              <Badge variant="outline" className="text-xs text-yellow-600">
                                <Clock className="h-3 w-3 mr-1" />
                                {stats.pending}
                              </Badge>
                            )}
                            {stats.pendingReceipts > 0 && (
                              <Badge variant="outline" className="text-xs text-orange-600">
                                <Camera className="h-3 w-3 mr-1" />
                                {stats.pendingReceipts}
                              </Badge>
                            )}
                            {stats.codTotal > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Banknote className="h-3 w-3 mr-1" />
                                {stats.codTotal.toFixed(0)}
                              </Badge>
                            )}
                            {stats.totalItems > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Package className="h-3 w-3 mr-1" />
                                {stats.totalItems}
                              </Badge>
                            )}
                            {stats.pickingAccuracy !== null && (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs",
                                  stats.pickingAccuracy >= 95 && "text-green-600 border-green-300",
                                  stats.pickingAccuracy >= 80 && stats.pickingAccuracy < 95 && "text-yellow-600 border-yellow-300",
                                  stats.pickingAccuracy < 80 && "text-red-600 border-red-300"
                                )}
                              >
                                <Target className="h-3 w-3 mr-1" />
                                {stats.pickingAccuracy}%
                              </Badge>
                            )}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className={cn(
                        "space-y-2 max-h-[500px]",
                        isDragging ? "overflow-hidden" : "overflow-y-auto",
                        "overscroll-contain"
                      )}>
                        {dayOrders.length === 0 ? (
                          <p className="text-center py-4 text-muted-foreground text-sm">
                            No orders
                          </p>
                        ) : (
                          <SortableContext
                            items={dayOrders.map(o => o.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {dayOrders.map((order) => (
                              <SortableOrderCard key={order.id} order={order}>
                                {renderOrderCard(order)}
                              </SortableOrderCard>
                            ))}
                          </SortableContext>
                        )}
                      </CardContent>
                    </Card>
                  </DroppableDayColumn>
                );
              })}
            </div>

            {/* Drag Overlay */}
            <DragOverlay>
              {activeOrder ? (
                <Card className={cn(
                  "w-64 opacity-95 shadow-xl rotate-2 border-l-4",
                  getZoneColor(activeOrder.distribution_customers?.delivery_zone || null)
                )}>
                  <CardContent className="p-3">
                    <p className="font-semibold">{activeOrder.distribution_customers?.name || 'Unknown'}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Package className="h-3 w-3" />
                      <span>{activeOrder.distribution_order_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0} items</span>
                    </div>
                    {activeOrder.distribution_customers?.delivery_zone && (
                      <Badge variant="outline" className="text-xs mt-2">
                        {activeOrder.distribution_customers.delivery_zone}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Day Drill-Down Dialog */}
        <FnbOrderDayDialog
          day={selectedDay}
          orders={selectedDayOrders}
          open={!!selectedDay}
          onOpenChange={(open) => !open && setSelectedDay(null)}
          onOrderUpdated={() => queryClient.invalidateQueries({ queryKey: ['fnb-orders-weekly'] })}
        />

        {/* Quick Add Item Dialog */}
        {quickAddOrder && (
          <QuickAddItemDialog
            orderId={quickAddOrder.id}
            orderNumber={quickAddOrder.orderNumber}
            open={!!quickAddOrder}
            onOpenChange={(open) => !open && setQuickAddOrder(null)}
          />
        )}

        {/* New Order Notifications */}
        <NewOrderToast
          notifications={orderNotifications.map(n => ({
            id: n.id,
            queueId: n.id, // Use order notification id as queueId since these aren't from picker queue
            orderId: n.orderId,
            orderNumber: n.orderNumber,
            customerName: n.customerName,
            zone: n.zone,
            isUrgent: false,
            createdAt: n.createdAt
          }))}
          isMinimized={notificationsMinimized}
          onMinimize={minimizeNotifications}
          onExpand={expandNotifications}
          onPickOrder={(notification) => {
            navigate(`/fnb/orders/edit/${notification.orderId}`);
            dismissNotification(notification.id);
          }}
          onDismiss={dismissNotification}
        />

        {/* Cancel Order Confirmation Dialog */}
        <AlertDialog open={!!cancelOrderData} onOpenChange={(open) => !open && setCancelOrderData(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
              <AlertDialogDescription>
                This will cancel order {cancelOrderData?.orderNumber} and remove it from the picker queue. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Order</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (cancelOrderData) {
                    cancelOrderMutation.mutate({ 
                      orderId: cancelOrderData.id, 
                      orderStatus: cancelOrderData.status 
                    });
                    setCancelOrderData(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Cancel Order
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
