import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingBag } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export default function IntakeShopifyOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('distribution_orders')
      .select('*, distribution_customers:customer_id(name)')
      .eq('source_channel', 'shopify')
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  const openDetail = async (order: any) => {
    setSelectedOrder(order);
    const { data } = await supabase
      .from('distribution_order_items')
      .select('*, distribution_products:product_id(name, code)')
      .eq('order_id', order.id);
    setOrderItems(data || []);
  };

  const lastReceived = orders.length > 0 ? orders[0].created_at : null;

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: 'bg-muted text-intake-text-muted',
      confirmed: 'bg-intake-brand text-white',
      delivered: 'bg-intake-accent text-white',
      cancelled: 'bg-intake-danger text-white',
    };
    return map[s] || 'bg-muted text-intake-text';
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-intake-text mb-4">Shopify Orders</h1>

      {/* Status banner */}
      <div className="mb-6 p-4 rounded-lg border bg-intake-surface">
        {lastReceived ? (
          <p className="text-sm text-intake-text">
            Last Shopify order received:{' '}
            <span className="font-medium">{formatDistanceToNow(new Date(lastReceived), { addSuffix: true })}</span>
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-intake-text-muted" />
            <p className="text-sm text-intake-text-muted">
              No Shopify orders received yet. The webhook will be configured in the next session.
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className="border rounded-lg bg-intake-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Fulfillment Type</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead>Order Status</TableHead>
                <TableHead>Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-intake-text-muted">
                    No Shopify orders yet
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(order)}>
                    <TableCell className="text-xs">{format(new Date(order.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                    <TableCell className="text-xs">{(order.distribution_customers as any)?.name || '—'}</TableCell>
                    <TableCell className="text-xs">{order.is_pickup ? 'Pickup' : 'Delivery'}</TableCell>
                    <TableCell className="text-xs">{order.payment_method || '—'}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${statusColor(order.status || '')}`}>{order.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">—</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail slide-over */}
      <Sheet open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Order Details</SheetTitle>
          </SheetHeader>
          {selectedOrder && (
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <p className="text-sm"><span className="font-medium">Order #:</span> {selectedOrder.order_number}</p>
                <p className="text-sm"><span className="font-medium">Customer:</span> {(selectedOrder.distribution_customers as any)?.name || '—'}</p>
                <p className="text-sm"><span className="font-medium">Status:</span> {selectedOrder.status}</p>
                <p className="text-sm"><span className="font-medium">Delivery Date:</span> {selectedOrder.delivery_date || '—'}</p>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">Line Items</h4>
                {orderItems.length === 0 ? (
                  <p className="text-xs text-intake-text-muted">No items</p>
                ) : (
                  <div className="space-y-1">
                    {orderItems.map((item) => (
                      <div key={item.id} className="flex justify-between text-xs border-b py-1.5">
                        <span>{(item.distribution_products as any)?.name || 'Unknown'}</span>
                        <span>{item.quantity} {item.order_unit || ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
