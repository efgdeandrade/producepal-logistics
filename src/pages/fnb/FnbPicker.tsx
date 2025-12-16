import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, CheckCircle, Clock, User, Package, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SHORT_REASONS = [
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'other', label: 'Other' },
];

export default function FnbPicker() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [pickedQuantities, setPickedQuantities] = useState<Record<string, number>>({});
  const [shortReasons, setShortReasons] = useState<Record<string, string>>({});

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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
            fnb_customers(name, whatsapp_phone, address)
          )
        `)
        .in('status', ['queued', 'in_progress'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

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
          fnb_products(code, name, unit)
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

  const claimMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const { error } = await supabase
        .from('fnb_picker_queue')
        .update({
          claimed_by: user?.id,
          claimed_at: new Date().toISOString(),
          status: 'in_progress',
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
      toast.success('Order claimed');
    },
    onError: () => {
      toast.error('Failed to claim order - it may have been taken');
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      pickedQty,
      orderedQty,
      shortReason,
    }: {
      itemId: string;
      pickedQty: number;
      orderedQty: number;
      shortReason?: string;
    }) => {
      const shortQty = Math.max(0, orderedQty - pickedQty);
      const { error } = await supabase
        .from('fnb_order_items')
        .update({
          picked_quantity: pickedQty,
          picked_by: user?.id,
          picked_at: new Date().toISOString(),
          short_quantity: shortQty,
          short_reason: shortQty > 0 ? shortReason : null,
        })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-picker-items'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const queueItem = queueItems?.find((q: any) => q.id === queueId);
      if (!queueItem) throw new Error('Queue item not found');

      // Update all items with current picked quantities
      if (orderItems) {
        for (const item of orderItems) {
          const pickedQty = pickedQuantities[item.id] ?? item.quantity;
          const shortQty = Math.max(0, item.quantity - pickedQty);
          await supabase
            .from('fnb_order_items')
            .update({
              picked_quantity: pickedQty,
              picked_by: user?.id,
              picked_at: new Date().toISOString(),
              short_quantity: shortQty,
              short_reason: shortQty > 0 ? shortReasons[item.id] || 'other' : null,
            })
            .eq('id', item.id);
        }
      }

      const { error: queueError } = await supabase
        .from('fnb_picker_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
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
      setSelectedQueue(null);
      setPickedQuantities({});
      setShortReasons({});
      toast.success('Order completed and ready for delivery');
    },
    onError: () => {
      toast.error('Failed to complete order');
    },
  });

  const selectedQueueItem = queueItems?.find((q: any) => q.id === selectedQueue);
  const isMyOrder = selectedQueueItem?.claimed_by === user?.id;

  // Check if all items have been reviewed (picked_quantity set)
  const allItemsReviewed =
    orderItems &&
    orderItems.length > 0 &&
    orderItems.every((item: any) => pickedQuantities[item.id] !== undefined);

  // Check for any shorts
  const hasShorts =
    orderItems &&
    orderItems.some(
      (item: any) => (pickedQuantities[item.id] ?? item.quantity) < item.quantity
    );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/fnb">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Picker Workstation</h1>
            <p className="text-muted-foreground">
              Claim and fulfill F&B orders • Touch-friendly interface
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Order Queue */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Order Queue ({queueItems?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center py-8 text-muted-foreground">Loading...</p>
              ) : queueItems && queueItems.length > 0 ? (
                <div className="space-y-3">
                  {queueItems.map((item: any) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedQueue === item.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedQueue(item.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-lg">
                            {item.fnb_orders?.order_number}
                          </p>
                          <p className="text-sm">
                            {item.fnb_orders?.fnb_customers?.name}
                          </p>
                          {item.fnb_orders?.delivery_date && (
                            <p className="text-xs text-muted-foreground">
                              Deliver:{' '}
                              {format(
                                new Date(item.fnb_orders.delivery_date),
                                'MMM d'
                              )}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {item.status === 'in_progress' ? (
                            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                              <User className="h-3 w-3 mr-1" />
                              In Progress
                            </Badge>
                          ) : (
                            <Badge variant="outline">Queued</Badge>
                          )}
                          {item.priority > 0 && (
                            <Badge className="ml-2 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              Priority
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  No orders in queue
                </p>
              )}
            </CardContent>
          </Card>

          {/* Order Details & Picking */}
          <Card>
            <CardHeader>
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
                      <p className="text-sm mt-2 text-orange-600 dark:text-orange-400">
                        Note: {selectedQueueItem.fnb_orders.notes}
                      </p>
                    )}
                  </div>

                  {/* Claim Button */}
                  {selectedQueueItem.status === 'queued' && (
                    <Button
                      className="w-full h-14 text-lg"
                      onClick={() => claimMutation.mutate(selectedQueueItem.id)}
                      disabled={claimMutation.isPending}
                    >
                      <User className="mr-2 h-5 w-5" />
                      Claim This Order
                    </Button>
                  )}

                  {/* Items List with Quantity Adjustment */}
                  {isMyOrder && orderItems && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Items to Pick</h4>
                      {orderItems.map((item: any) => {
                        const pickedQty = pickedQuantities[item.id] ?? item.quantity;
                        const isShort = pickedQty < item.quantity;
                        const shortQty = item.quantity - pickedQty;

                        return (
                          <div
                            key={item.id}
                            className={`p-4 rounded-lg border ${
                              isShort
                                ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'
                                : 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="font-medium">
                                  {item.fnb_products?.name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {item.fnb_products?.code}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">
                                  Ordered
                                </p>
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
                                  className="h-10 w-10 text-lg"
                                  onClick={() =>
                                    setPickedQuantities({
                                      ...pickedQuantities,
                                      [item.id]: Math.max(0, pickedQty - 1),
                                    })
                                  }
                                >
                                  -
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  max={item.quantity}
                                  value={pickedQty}
                                  onChange={(e) =>
                                    setPickedQuantities({
                                      ...pickedQuantities,
                                      [item.id]: Math.max(
                                        0,
                                        Math.min(
                                          item.quantity,
                                          Number(e.target.value) || 0
                                        )
                                      ),
                                    })
                                  }
                                  className="w-20 h-10 text-center text-lg font-bold"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-10 w-10 text-lg"
                                  onClick={() =>
                                    setPickedQuantities({
                                      ...pickedQuantities,
                                      [item.id]: Math.min(item.quantity, pickedQty + 1),
                                    })
                                  }
                                >
                                  +
                                </Button>
                              </div>
                            </div>

                            {/* Short Reason */}
                            {isShort && (
                              <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900 rounded">
                                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 text-sm mb-2">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span>Short by {shortQty} {item.fnb_products?.unit}</span>
                                </div>
                                <Select
                                  value={shortReasons[item.id] || ''}
                                  onValueChange={(v) =>
                                    setShortReasons({
                                      ...shortReasons,
                                      [item.id]: v,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select reason" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SHORT_REASONS.map((reason) => (
                                      <SelectItem key={reason.value} value={reason.value}>
                                        {reason.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Complete Button */}
                  {isMyOrder && allItemsReviewed && (
                    <div className="space-y-2">
                      {hasShorts && (
                        <p className="text-sm text-yellow-600 dark:text-yellow-400 text-center">
                          This order has shortages. Please ensure all short reasons are selected.
                        </p>
                      )}
                      <Button
                        className={`w-full h-14 text-lg ${
                          hasShorts
                            ? 'bg-yellow-600 hover:bg-yellow-700'
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                        onClick={() => completeMutation.mutate(selectedQueueItem.id)}
                        disabled={
                          completeMutation.isPending ||
                          (hasShorts &&
                            orderItems?.some(
                              (item: any) =>
                                (pickedQuantities[item.id] ?? item.quantity) <
                                  item.quantity && !shortReasons[item.id]
                            ))
                        }
                      >
                        <CheckCircle className="mr-2 h-5 w-5" />
                        {hasShorts ? 'Complete with Shortages' : 'Complete Order'}
                      </Button>
                    </div>
                  )}

                  {selectedQueueItem.status === 'in_progress' && !isMyOrder && (
                    <p className="text-center py-4 text-muted-foreground">
                      This order is being picked by another team member
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  Select an order from the queue to start picking
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
