import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Pencil, X, Plus, AlertTriangle, History, Target, FileText } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QuickAddItemDialog } from './QuickAddItemDialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  picking: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  out_for_delivery: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  delivered: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  cancelled: 'bg-destructive/10 text-destructive',
};

const statusWarnings: Record<string, string> = {
  picking: 'This order is currently being picked. Editing may cause confusion.',
  ready: 'This order is ready for delivery. Changes will need to be communicated to the driver.',
  out_for_delivery: 'This order is out for delivery. Changes may not reach the driver in time.',
  delivered: 'This order has been delivered. Editing will only update records.',
};

interface FnbOrderDetailDialogProps {
  order: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FnbOrderDetailDialog({ order, open, onOpenChange }: FnbOrderDetailDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [showModifications, setShowModifications] = useState(false);
  const [showNotes, setShowNotes] = useState(order?.notes?.includes('Original WhatsApp Message') ?? false);

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // Log the cancellation
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('distribution_order_modifications').insert({
        order_id: orderId,
        modified_by: user?.id,
        modified_by_email: user?.email,
        modification_type: 'status_changed',
        previous_value: { status: order.status },
        new_value: { status: 'cancelled' },
        notes: 'Order cancelled',
      });

      await supabase.from('distribution_picker_queue').delete().eq('order_id', orderId);
      const { error } = await supabase
        .from('distribution_orders')
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

  // Allow editing for more statuses - only delivered and cancelled are restricted for full edit
  const canEditOrder = (status: string) => !['cancelled'].includes(status);
  const canCancelOrder = (status: string) => !['delivered', 'cancelled'].includes(status);
  const canQuickAdd = (status: string) => !['delivered', 'cancelled'].includes(status);
  const canGoToPicking = (status: string) => ['pending', 'confirmed', 'picking'].includes(status);
  const hasWarning = (status: string) => Object.keys(statusWarnings).includes(status);

  const { data: orderItems } = useQuery({
    queryKey: ['fnb-order-items', order?.id],
    queryFn: async () => {
      if (!order) return [];
      const { data, error } = await supabase
        .from('distribution_order_items')
        .select(`
          *,
          distribution_products(code, name, unit)
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
        .from('distribution_conversations')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!order,
  });

  // Fetch modification history
  const { data: modifications } = useQuery({
    queryKey: ['fnb-order-modifications', order?.id],
    queryFn: async () => {
      if (!order) return [];
      const { data, error } = await supabase
        .from('distribution_order_modifications')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!order,
  });

  if (!order) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order {order.order_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Warning for in-progress orders */}
            {hasWarning(order.status) && (
              <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {statusWarnings[order.status]}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-medium">{order.distribution_customers?.name || order.fnb_customers?.name}</p>
                <p className="text-sm">{order.distribution_customers?.whatsapp_phone || order.fnb_customers?.whatsapp_phone}</p>
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

            {/* Order Items with Quick Add */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Order Items</h4>
                {canQuickAdd(order.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickAddOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                )}
              </div>
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
                          {item.distribution_products?.name || item.fnb_products?.name} ({item.distribution_products?.code || item.fnb_products?.code})
                        </TableCell>
                        <TableCell>
                          {item.quantity} {item.distribution_products?.unit || item.fnb_products?.unit}
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

            {/* Order Notes / Source Message */}
            {order.notes && (
              <Collapsible open={showNotes} onOpenChange={setShowNotes}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {order.notes.includes('Original WhatsApp Message') 
                        ? 'Original WhatsApp Message' 
                        : 'Order Notes'}
                    </span>
                    <Badge variant="secondary">{showNotes ? 'Hide' : 'Show'}</Badge>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-3 bg-muted/50 rounded-lg border">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                      {order.notes}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Modification History */}
            {modifications && modifications.length > 0 && (
              <Collapsible open={showModifications} onOpenChange={setShowModifications}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Modification History ({modifications.length})
                    </span>
                    <Badge variant="secondary">{showModifications ? 'Hide' : 'Show'}</Badge>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScrollArea className="h-32 border rounded-lg p-2 mt-2">
                    <div className="space-y-2">
                      {modifications.map((mod: any) => (
                        <div key={mod.id} className="text-xs p-2 bg-muted rounded">
                          <div className="flex justify-between">
                            <span className="font-medium capitalize">
                              {mod.modification_type.replace('_', ' ')}
                            </span>
                            <span className="text-muted-foreground">
                              {format(new Date(mod.created_at), 'MMM d, HH:mm')}
                            </span>
                          </div>
                          <p className="text-muted-foreground">{mod.notes}</p>
                          <p className="text-muted-foreground">by {mod.modified_by_email}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
            )}

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
            <div className="flex gap-2 pt-4 border-t flex-wrap">
              {canGoToPicking(order.status) && (
                <Button
                  variant="default"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/fnb/picker/${order.id}`);
                  }}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Go to Picking
                </Button>
              )}
              {canQuickAdd(order.status) && (
                <Button
                  variant="outline"
                  onClick={() => setQuickAddOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Quick Add
                </Button>
              )}
              {canEditOrder(order.status) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/fnb/orders/edit/${order.id}`);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Full Edit
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

      {/* Quick Add Dialog */}
      <QuickAddItemDialog
        orderId={order.id}
        orderNumber={order.order_number}
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
      />
    </>
  );
}
