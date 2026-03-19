import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, Package, User, MapPin, Clock, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function FnbOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      const [orderRes, itemsRes] = await Promise.all([
        supabase
          .from('distribution_orders')
          .select('*, distribution_customers(name, whatsapp_phone, zone, delivery_zone)')
          .eq('id', orderId!)
          .single(),
        supabase
          .from('distribution_order_items')
          .select('*, distribution_products(name, unit)')
          .eq('order_id', orderId!),
      ]);

      setOrder(orderRes.data);
      setItems(itemsRes.data || []);
      setLoading(false);
    };
    if (orderId) fetchOrder();
  }, [orderId]);

  const updateStatus = async (newStatus: string) => {
    setUpdating(true);
    const { error } = await supabase
      .from('distribution_orders')
      .update({ status: newStatus })
      .eq('id', orderId!);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setOrder((prev: any) => ({ ...prev, status: newStatus }));
      toast({ title: `Order ${newStatus}` });
    }
    setUpdating(false);
  };

  const sendToPicker = async () => {
    await updateStatus('picking');
    await supabase.from('distribution_picker_queue').upsert({
      order_id: orderId,
      status: 'pending',
      assigned_at: new Date().toISOString(),
    }, { onConflict: 'order_id' });
    toast({ title: '✅ Sent to Picker Station' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Order not found</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    pending: 'bg-muted text-muted-foreground',
    confirmed: 'bg-primary/10 text-primary',
    picking: 'bg-amber-500/10 text-amber-700',
    packed: 'bg-purple-500/10 text-purple-700',
    ready: 'bg-blue-500/10 text-blue-700',
    out_for_delivery: 'bg-orange-500/10 text-orange-700',
    delivered: 'bg-green-500/10 text-green-700',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  const customerZone = order.distribution_customers?.zone || order.distribution_customers?.delivery_zone;

  return (
    <div className="max-w-2xl mx-auto space-y-4 p-4 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-md hover:bg-muted transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{order.order_number}</h1>
          <p className="text-xs text-muted-foreground">
            {order.created_at ? format(new Date(order.created_at), 'MMM d, yyyy HH:mm') : ''}
          </p>
        </div>
        <Badge className={statusColors[order.status] || 'bg-muted text-muted-foreground'}>
          {order.status}
        </Badge>
      </div>

      {/* Customer info */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4 text-muted-foreground" />
            {order.distribution_customers?.name || 'Unknown customer'}
          </div>
          {customerZone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {customerZone}
            </div>
          )}
          {order.source_channel && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              Via {order.source_channel}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" />
            Order Items
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No items recorded — order may have been created before item tracking was enabled.
            </p>
          ) : (
            <div className="divide-y">
              {items.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {item.distribution_products?.name || item.product_name_raw}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} {item.order_unit || item.distribution_products?.unit || ''}
                    </p>
                  </div>
                  <div className="text-right">
                    {Number(item.unit_price_xcg) > 0 && (
                      <>
                        <p className="text-sm font-medium">XCG {Number(item.total_xcg || 0).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">@ {item.unit_price_xcg}/{item.order_unit || 'unit'}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {Number(order.total_xcg) > 0 && (
            <div className="flex items-center justify-between pt-3 border-t mt-2 font-medium">
              <span>Total</span>
              <span>XCG {Number(order.total_xcg).toFixed(2)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Action buttons — fixed bottom */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-background border-t space-y-2 z-40">
        {(order.status === 'confirmed' || order.status === 'pending') && (
          <Button className="w-full" onClick={sendToPicker} disabled={updating}>
            {updating ? 'Sending...' : '📦 Send to Picker Station'}
          </Button>
        )}
        {order.status === 'picking' && (
          <Button className="w-full" onClick={() => updateStatus('packed')} disabled={updating}>
            ✅ Mark as Packed
          </Button>
        )}
        {(order.status === 'packed' || order.status === 'ready') && (
          <Button className="w-full" onClick={() => updateStatus('out_for_delivery')} disabled={updating}>
            🚚 Send for Delivery
          </Button>
        )}
        {order.status === 'out_for_delivery' && (
          <Button className="w-full" onClick={() => updateStatus('delivered')} disabled={updating}>
            ✅ Mark as Delivered
          </Button>
        )}
        {!['delivered', 'cancelled'].includes(order.status) && (
          <Button variant="outline" className="w-full" onClick={() => updateStatus('cancelled')} disabled={updating}>
            Cancel Order
          </Button>
        )}
      </div>
    </div>
  );
}
