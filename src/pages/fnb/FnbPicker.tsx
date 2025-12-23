import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, CheckCircle, Clock, User, Package, AlertTriangle, LogOut, Scale, Trophy } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PickerSessionModal } from '@/components/fnb/PickerSessionModal';
import { PickerQueueZone } from '@/components/fnb/PickerQueueZone';
import { WeightVerificationDialog } from '@/components/fnb/WeightVerificationDialog';
import { ShortageRequestDialog } from '@/components/fnb/ShortageRequestDialog';
import { PickerLeaderboard } from '@/components/fnb/PickerLeaderboard';
import { ShortageQuickButtons } from '@/components/fnb/ShortageQuickButtons';
import { AssistanceButton } from '@/components/fnb/AssistanceButton';
import { cn } from '@/lib/utils';

const SHORT_REASONS = [
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'other', label: 'Other' },
];

const SESSION_KEY = 'fnb_picker_session';

export default function FnbPicker() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Session state
  const [pickerName, setPickerName] = useState<string | null>(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored || null;
  });
  
  // UI state
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [pickedQuantities, setPickedQuantities] = useState<Record<string, number>>({});
  const [shortReasons, setShortReasons] = useState<Record<string, string>>({});
  const [showWeightDialog, setShowWeightDialog] = useState(false);
  const [shortageItem, setShortageItem] = useState<{
    id: string;
    productName: string;
    productCode: string;
    orderedQuantity: number;
    unit: string;
  } | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Handle session start
  const handleSessionStart = (name: string) => {
    setPickerName(name);
    sessionStorage.setItem(SESSION_KEY, name);
    toast.success(`Welcome, ${name}!`);
  };

  // Handle session end
  const handleSessionEnd = () => {
    setPickerName(null);
    sessionStorage.removeItem(SESSION_KEY);
    setSelectedQueue(null);
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

  // Fetch queue with item counts
  const { data: queueItems, isLoading } = useQuery({
    queryKey: ['fnb-picker-queue'],
    queryFn: async () => {
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
            fnb_customers(name, whatsapp_phone, address, customer_type, delivery_zone)
          )
        `)
        .in('status', ['queued', 'in_progress'])
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

  // Initialize picked quantities when order items load
  useEffect(() => {
    if (orderItems) {
      const initialQuantities: Record<string, number> = {};
      const initialReasons: Record<string, string> = {};
      orderItems.forEach((item: any) => {
        initialQuantities[item.id] = item.picked_quantity ?? item.quantity;
        if (item.short_reason) {
          initialReasons[item.id] = item.short_reason;
        }
      });
      setPickedQuantities(initialQuantities);
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

  const completeMutation = useMutation({
    mutationFn: async ({ queueId, verifiedWeight }: { queueId: string; verifiedWeight: number }) => {
      const queueItem = queueItems?.find((q: any) => q.id === queueId);
      if (!queueItem) throw new Error('Queue item not found');

      // Update all items with current picked quantities
      if (orderItems) {
        for (const item of orderItems) {
          const pickedQty = pickedQuantities[item.id] ?? item.quantity;
          const shortQty = Math.max(0, item.quantity - pickedQty);
          const isWeightBased = item.fnb_products?.is_weight_based || false;
          const isOverPicked = pickedQty > item.quantity;
          
          await supabase
            .from('fnb_order_items')
            .update({
              picked_quantity: pickedQty,
              picked_by: user?.id,
              picked_at: new Date().toISOString(),
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
      setSelectedQueue(null);
      setPickedQuantities({});
      setShortReasons({});
      setShowWeightDialog(false);
      toast.success('Order completed and ready for delivery! 🎉');
    },
    onError: () => {
      toast.error('Failed to complete order');
    },
  });

  const selectedQueueItem = queueItems?.find((q: any) => q.id === selectedQueue);
  const isMyOrder = selectedQueueItem?.picker_name === pickerName;

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

  // Calculate expected weight
  const expectedWeight = orderItems?.reduce((sum: number, item: any) => {
    return sum + (pickedQuantities[item.id] || 0) * 0.5;
  }, 0) || 0;

  // Show session modal if no picker name
  if (!pickerName) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <PickerSessionModal open={true} onSessionStart={handleSessionStart} onClose={() => navigate('/fnb')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/fnb">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Picker Workstation</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <User className="h-3.5 w-3.5" />
                {pickerName}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLeaderboard(!showLeaderboard)}
              className={cn(showLeaderboard && 'bg-accent')}
            >
              <Trophy className="h-4 w-4 mr-1" />
              Leaderboard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSessionEnd}
              className="text-muted-foreground"
            >
              <LogOut className="h-4 w-4 mr-1" />
              End Session
            </Button>
          </div>
        </div>

        {/* Leaderboard Panel */}
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

        <div className="grid lg:grid-cols-2 gap-4">
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

                  {/* In progress by another picker */}
                  {selectedQueueItem.status === 'in_progress' && !isMyOrder && (
                    <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg text-center">
                      <User className="h-8 w-8 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                      <p className="font-medium">Being picked by {selectedQueueItem.picker_name}</p>
                      <p className="text-sm text-muted-foreground">Select another order from the queue</p>
                    </div>
                  )}

                  {/* Items List with Quantity Adjustment */}
                  {isMyOrder && orderItems && (
                    <>
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

                          return (
                            <div
                              key={item.id}
                              className={cn(
                                'p-4 rounded-lg border-2 transition-colors',
                                getBorderColor(),
                                getBgColor()
                              )}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">{item.fnb_products?.name}</p>
                                    {isWeightBased && (
                                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                        <Scale className="h-3 w-3 mr-1" />
                                        Weight
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {item.fnb_products?.code}
                                  </p>
                                  {isReported && (
                                    <Badge variant="outline" className="mt-1 text-blue-600 border-blue-400">
                                      Shortage Reported
                                    </Badge>
                                  )}
                                  {isOverPicked && isWeightBased && (
                                    <Badge variant="outline" className="mt-1 text-blue-600 border-blue-400">
                                      Over-picked (+{(pickedQty - item.quantity).toFixed(2)})
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-muted-foreground">Ordered</p>
                                  <p className="font-bold">
                                    {item.quantity} {item.fnb_products?.unit}
                                  </p>
                                </div>
                              </div>

                              {/* Quantity Adjustment */}
                              <div className="flex items-center gap-3 mt-3">
                                <span className="text-sm font-medium w-16">Picked:</span>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-12 w-12 text-lg touch-manipulation"
                                    onClick={() =>
                                      setPickedQuantities({
                                        ...pickedQuantities,
                                        [item.id]: Math.max(0, isWeightBased 
                                          ? parseFloat((pickedQty - 0.1).toFixed(2))
                                          : pickedQty - 1
                                        ),
                                      })
                                    }
                                    disabled={isReported}
                                  >
                                    -
                                  </Button>
                                  <Input
                                    type="number"
                                    min="0"
                                    max={isWeightBased ? undefined : item.quantity}
                                    step={isWeightBased ? "0.01" : "1"}
                                    value={pickedQty}
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value) || 0;
                                      const maxValue = isWeightBased ? value : Math.min(item.quantity, value);
                                      setPickedQuantities({
                                        ...pickedQuantities,
                                        [item.id]: Math.max(0, maxValue),
                                      });
                                    }}
                                    className="w-24 h-12 text-center text-lg font-bold"
                                    disabled={isReported}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-12 w-12 text-lg touch-manipulation"
                                    onClick={() =>
                                      setPickedQuantities({
                                        ...pickedQuantities,
                                        [item.id]: isWeightBased
                                          ? parseFloat((pickedQty + 0.1).toFixed(2))
                                          : Math.min(item.quantity, pickedQty + 1),
                                      })
                                    }
                                    disabled={isReported}
                                  >
                                    +
                                  </Button>
                                  {isWeightBased && (
                                    <span className="text-sm text-muted-foreground ml-1">
                                      {item.fnb_products?.weight_unit || 'kg'}
                                    </span>
                                  )}
                                </div>
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

                      {/* Complete Button */}
                      <Button
                        className="w-full h-16 text-lg"
                        onClick={() => setShowWeightDialog(true)}
                        disabled={
                          !allItemsReviewed ||
                          hasUnreasonedShorts ||
                          completeMutation.isPending
                        }
                      >
                        <Scale className="mr-2 h-5 w-5" />
                        Verify Weight & Complete
                      </Button>

                      {hasUnreasonedShorts && (
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

      {/* Weight Verification Dialog */}
      <WeightVerificationDialog
        open={showWeightDialog}
        onOpenChange={setShowWeightDialog}
        expectedWeight={expectedWeight}
        onVerify={(weight) =>
          completeMutation.mutate({
            queueId: selectedQueue!,
            verifiedWeight: weight,
          })
        }
        isLoading={completeMutation.isPending}
      />

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
