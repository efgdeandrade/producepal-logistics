import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Ban, Edit, Eye, Download } from 'lucide-react';
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
import html2pdf from 'html2pdf.js';

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
  const [viewDialog, setViewDialog] = useState<'packing' | 'supplier' | 'roundup' | null>(null);
  const [printFormat, setPrintFormat] = useState<'a4' | 'receipt'>('a4');
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{type: 'packing' | 'supplier' | 'roundup', action: 'view' | 'print' | 'download'} | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

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

  const handleAction = (type: 'packing' | 'supplier' | 'roundup', action: 'view' | 'print' | 'download') => {
    setPendingAction({ type, action });
    setShowFormatDialog(true);
  };

  const handleConfirmFormat = async () => {
    setShowFormatDialog(false);
    
    if (!pendingAction) return;

    const { type, action } = pendingAction;

    if (action === 'view') {
      setViewDialog(type);
    } else if (action === 'print') {
      // Show the content briefly then print
      setViewDialog(type);
      setTimeout(() => {
        window.print();
        setTimeout(() => setViewDialog(null), 100);
      }, 100);
    } else if (action === 'download') {
      // Generate PDF and download
      setViewDialog(type);
      setTimeout(async () => {
        if (printRef.current) {
          const opt = {
            margin: printFormat === 'receipt' ? 0.2 : 0.5,
            filename: `${type}-${order?.order_number}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { 
              unit: 'in', 
              format: printFormat === 'receipt' ? [3.15, 11] as [number, number] : 'a4',
              orientation: 'portrait' as const
            }
          };
          
          try {
            await html2pdf().set(opt).from(printRef.current).save();
            toast.success('PDF downloaded successfully');
          } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Failed to generate PDF');
          }
        }
        setViewDialog(null);
      }, 500);
    }
    
    setPendingAction(null);
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
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/edit-order/${order.id}`)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Order
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={handleVoidOrder}
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Void Order
                      </Button>
                    </>
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
              <CardTitle>Document Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">Customer Packing Slips</h3>
                      <p className="text-xs text-muted-foreground">Separate slip per customer</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('packing', 'view')}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('packing', 'print')}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('packing', 'download')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">Supplier Order Lists</h3>
                      <p className="text-xs text-muted-foreground">Separate list per supplier</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('supplier', 'view')}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('supplier', 'print')}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('supplier', 'download')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">Total Roundup Table</h3>
                      <p className="text-xs text-muted-foreground">Complete summary for receiving</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('roundup', 'view')}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('roundup', 'print')}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('roundup', 'download')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
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

      <Dialog open={showFormatDialog} onOpenChange={setShowFormatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Format</DialogTitle>
            <DialogDescription>
              Choose the format for your document
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
            <Button onClick={handleConfirmFormat} className="w-full">
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialog !== null} onOpenChange={() => setViewDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewDialog === 'packing' && 'Customer Packing Slips'}
              {viewDialog === 'supplier' && 'Supplier Order Lists'}
              {viewDialog === 'roundup' && 'Total Roundup Table'}
            </DialogTitle>
          </DialogHeader>
          <div ref={printRef} className="print:block">
            {viewDialog === 'packing' && order && (
              <CustomerPackingSlip 
                order={order} 
                orderItems={orderItems} 
                format={printFormat}
              />
            )}
            {viewDialog === 'supplier' && order && (
              <SupplierOrderList 
                order={order} 
                orderItems={orderItems} 
                format={printFormat}
              />
            )}
            {viewDialog === 'roundup' && order && (
              <RoundupTable 
                order={order} 
                orderItems={orderItems} 
                format={printFormat}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderDetails;
