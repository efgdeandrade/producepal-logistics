import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Pencil, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  picking: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  out_for_delivery: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  delivered: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  cancelled: 'bg-destructive/10 text-destructive',
};

interface FnbOrderDetailDialogProps {
  order: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FnbOrderDetailDialog({ order, open, onOpenChange }: FnbOrderDetailDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await supabase.from('fnb_picker_queue').delete().eq('order_id', orderId);
      const { error } = await supabase
        .from('fnb_orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-orders'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-picker-queue'] });
      toast.success('Order cancelled');
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Failed to cancel order');
    },
  });

  const canEditOrder = (status: string) => ['pending', 'confirmed'].includes(status);
  const canCancelOrder = (status: string) => ['pending', 'confirmed', 'picking'].includes(status);

  const { data: orderItems } = useQuery({
    queryKey: ['fnb-order-items', order?.id],
    queryFn: async () => {
      if (!order) return [];
      const { data, error } = await supabase
        .from('fnb_order_items')
        .select(`
          *,
          fnb_products(code, name, unit)
        `)
        .eq('order_id', order.id);
      if (error) throw error;
      return data;
    },
    enabled: !!order,
  });

  const { data: conversations } = useQuery({
    queryKey: ['fnb-conversations', order?.id],
    queryFn: async () => {
      if (!order) return [];
      const { data, error } = await supabase
        .from('fnb_conversations')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!order,
  });

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Order {order.order_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-medium">{order.fnb_customers?.name}</p>
              <p className="text-sm">{order.fnb_customers?.whatsapp_phone}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={statusColors[order.status]}>
                {order.status?.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Delivery Date</p>
              <p className="font-medium">
                {order.delivery_date ? format(new Date(order.delivery_date), 'MMM d, yyyy') : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="font-medium">{order.total_xcg?.toFixed(2)} XCG</p>
            </div>
          </div>

          {/* Order Items */}
          <div>
            <h4 className="font-medium mb-2">Order Items</h4>
            {orderItems && orderItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.fnb_products?.name} ({item.fnb_products?.code})
                      </TableCell>
                      <TableCell>
                        {item.quantity} {item.fnb_products?.unit}
                      </TableCell>
                      <TableCell>{item.unit_price_xcg?.toFixed(2)}</TableCell>
                      <TableCell>{item.total_xcg?.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No items</p>
            )}
          </div>

          {/* Conversation History */}
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              WhatsApp Conversation
            </h4>
            <ScrollArea className="h-48 border rounded-lg p-3">
              {conversations && conversations.length > 0 ? (
                <div className="space-y-2">
                  {conversations.map((msg: any) => (
                    <div
                      key={msg.id}
                      className={`p-2 rounded-lg max-w-[80%] ${
                        msg.direction === 'inbound'
                          ? 'bg-muted'
                          : 'bg-primary text-primary-foreground ml-auto'
                      }`}
                    >
                      <p className="text-sm">{msg.message_text}</p>
                      <p className="text-xs opacity-70">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No conversation history
                </p>
              )}
            </ScrollArea>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            {canEditOrder(order.status) && (
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/fnb/orders/edit/${order.id}`);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit Order
              </Button>
            )}
            {canCancelOrder(order.status) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <X className="h-4 w-4 mr-2" />
                    Cancel Order
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel order {order.order_number} and remove it from the picker queue. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Order</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cancelOrderMutation.mutate(order.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Cancel Order
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
