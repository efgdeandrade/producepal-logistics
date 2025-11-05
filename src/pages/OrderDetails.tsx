import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Ban, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import LoadingBox from '@/components/LoadingBox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CustomerPackingSlip } from '@/components/CustomerPackingSlip';
import { SupplierOrderList } from '@/components/SupplierOrderList';
import { RoundupTable } from '@/components/RoundupTable';

interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
  po_number?: string;
}

interface Order {
  id: string;
  order_number: string;
  week_number: number;
  delivery_date: string;
  placed_by: string;
  status: string;
  created_at: string;
  notes?: string;
}

const OrderDetails = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [printDialog, setPrintDialog] = useState<'packing' | 'supplier' | 'roundup' | null>(null);
  const [printFormat, setPrintFormat] = useState<'a4' | 'receipt'>('a4');

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      setOrder(orderData);
      setOrderItems(itemsData || []);
    } catch (error: any) {
      console.error('Error fetching order details:', error);
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleVoidOrder = async () => {
    if (!order) return;
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'void' })
        .eq('id', order.id);

      if (error) throw error;

      toast.success('Order voided successfully');
      fetchOrderDetails();
    } catch (error: any) {
      console.error('Error voiding order:', error);
      toast.error('Failed to void order');
    }
  };

  const handlePrint = (type: 'packing' | 'supplier' | 'roundup') => {
    setPrintDialog(type);
  };

  const handleConfirmPrint = () => {
    setPrintDialog(null);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <LoadingBox />
        </main>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Order not found</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/history')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-foreground mb-2">Order Details</h1>
            <p className="text-muted-foreground">View and manage order {order.order_number}</p>
          </div>
        </div>

        <div className="grid gap-6 mb-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{order.order_number}</CardTitle>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Week {order.week_number} • Delivery: {new Date(order.delivery_date).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Placed by: {order.placed_by} • Created: {new Date(order.created_at).toLocaleDateString()}
                    </p>
                    <span className={`inline-block text-xs font-medium px-3 py-1 rounded-full ${
                      order.status === 'completed' ? 'bg-success/10 text-success' :
                      order.status === 'void' ? 'bg-destructive/10 text-destructive' :
                      'bg-primary/10 text-primary'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {order.status !== 'void' && (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleVoidOrder}
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Void Order
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {order.notes && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Notes:</p>
                  <p className="text-sm text-muted-foreground">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Print Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  variant="outline" 
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => handlePrint('packing')}
                >
                  <Printer className="h-6 w-6" />
                  <div className="text-center">
                    <div className="font-semibold">Customer Packing Slips</div>
                    <div className="text-xs text-muted-foreground">Print separate slip per customer</div>
                  </div>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => handlePrint('supplier')}
                >
                  <Printer className="h-6 w-6" />
                  <div className="text-center">
                    <div className="font-semibold">Supplier Order Lists</div>
                    <div className="text-xs text-muted-foreground">Print separate list per supplier</div>
                  </div>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => handlePrint('roundup')}
                >
                  <Printer className="h-6 w-6" />
                  <div className="text-center">
                    <div className="font-semibold">Total Roundup Table</div>
                    <div className="text-xs text-muted-foreground">Print complete summary</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Items ({orderItems.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(
                  orderItems.reduce((acc, item) => {
                    if (!acc[item.customer_name]) {
                      acc[item.customer_name] = [];
                    }
                    acc[item.customer_name].push(item);
                    return acc;
                  }, {} as Record<string, OrderItem[]>)
                ).map(([customerName, items]) => (
                  <div key={customerName} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">{customerName}</h3>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.product_code}</span>
                          <span className="font-medium">{item.quantity} trays</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={printDialog !== null} onOpenChange={() => setPrintDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Print Format</DialogTitle>
            <DialogDescription>
              Choose the format for your printout
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={printFormat === 'a4' ? 'default' : 'outline'}
                onClick={() => setPrintFormat('a4')}
              >
                A4 Format
              </Button>
              <Button
                variant={printFormat === 'receipt' ? 'default' : 'outline'}
                onClick={() => setPrintFormat('receipt')}
              >
                80mm Receipt
              </Button>
            </div>
            <Button onClick={handleConfirmPrint} className="w-full">
              Print Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden printable content */}
      <div className="hidden print:block">
        {printDialog === 'packing' && (
          <CustomerPackingSlip 
            order={order} 
            orderItems={orderItems} 
            format={printFormat}
          />
        )}
        {printDialog === 'supplier' && (
          <SupplierOrderList 
            order={order} 
            orderItems={orderItems} 
            format={printFormat}
          />
        )}
        {printDialog === 'roundup' && (
          <RoundupTable 
            order={order} 
            orderItems={orderItems} 
            format={printFormat}
          />
        )}
      </div>
    </div>
  );
};

export default OrderDetails;
