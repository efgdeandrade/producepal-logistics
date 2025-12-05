import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, CheckCircle, Clock, User, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function FnbPicker() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);

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
    refetchInterval: 30000, // Refresh every 30 seconds
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

      // Update order status
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
    }: {
      itemId: string;
      pickedQty: number;
    }) => {
      const { error } = await supabase
        .from('fnb_order_items')
        .update({
          picked_quantity: pickedQty,
          picked_by: user?.id,
          picked_at: new Date().toISOString(),
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
      toast.success('Order completed and ready for delivery');
    },
    onError: () => {
      toast.error('Failed to complete order');
    },
  });

  const selectedQueueItem = queueItems?.find((q: any) => q.id === selectedQueue);
  const isMyOrder = selectedQueueItem?.claimed_by === user?.id;
  const allItemsPicked =
    orderItems &&
    orderItems.length > 0 &&
    orderItems.every((item: any) => item.picked_quantity !== null);

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
                Order Queue
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
                            <Badge className="bg-purple-100 text-purple-800">
                              <User className="h-3 w-3 mr-1" />
                              In Progress
                            </Badge>
                          ) : (
                            <Badge variant="outline">Queued</Badge>
                          )}
                          {item.priority > 0 && (
                            <Badge className="ml-2 bg-red-100 text-red-800">
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
                      <p className="text-sm mt-2 text-orange-600">
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

                  {/* Items List */}
                  {isMyOrder && orderItems && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Items to Pick</h4>
                      {orderItems.map((item: any) => (
                        <div
                          key={item.id}
                          className={`p-3 rounded-lg border ${
                            item.picked_quantity !== null
                              ? 'bg-green-50 border-green-200'
                              : 'bg-background'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={item.picked_quantity !== null}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  updateItemMutation.mutate({
                                    itemId: item.id,
                                    pickedQty: item.quantity,
                                  });
                                }
                              }}
                              className="h-6 w-6"
                            />
                            <div className="flex-1">
                              <p className="font-medium">
                                {item.fnb_products?.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {item.fnb_products?.code}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">
                                {item.quantity} {item.fnb_products?.unit}
                              </p>
                              {item.picked_quantity !== null && (
                                <p className="text-xs text-green-600">
                                  Picked: {item.picked_quantity}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Complete Button */}
                  {isMyOrder && allItemsPicked && (
                    <Button
                      className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                      onClick={() => completeMutation.mutate(selectedQueueItem.id)}
                      disabled={completeMutation.isPending}
                    >
                      <CheckCircle className="mr-2 h-5 w-5" />
                      Complete Order
                    </Button>
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