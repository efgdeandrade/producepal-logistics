import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Package, CheckCircle2, Clock, AlertCircle, Plus, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface ProductionItem {
  id: string;
  customer_name: string;
  product_code: string;
  product_name: string;
  predicted_quantity: number;
  actual_quantity: number | null;
  notes: string | null;
}

interface ProductionOrder {
  id: string;
  order_date: string;
  delivery_date: string;
  status: string;
  items: ProductionItem[];
}

const ProductionDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newOrderDate, setNewOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newDeliveryDate, setNewDeliveryDate] = useState('');

  useEffect(() => {
    fetchProductionOrders();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchProductionOrders = async () => {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('production_orders')
        .select('*')
        .in('status', ['planned', 'in_production'])
        .order('delivery_date', { ascending: true });

      if (ordersError) throw ordersError;

      // Fetch all customers and products for joins
      const { data: allCustomers } = await supabase.from('customers').select('id, name');
      const { data: allProducts } = await supabase.from('products').select('code, name');
      
      const customerMap = new Map(allCustomers?.map(c => [c.id, c.name]) || []);
      const productMap = new Map(allProducts?.map(p => [p.code, p.name]) || []);

      const ordersWithItems = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: itemsData, error: itemsError } = await supabase
            .from('production_items')
            .select('*')
            .eq('production_order_id', order.id);

          if (itemsError) throw itemsError;

          const items = (itemsData || []).map(item => ({
            id: item.id,
            customer_name: customerMap.get(item.customer_id) || 'Unknown',
            product_code: item.product_code,
            product_name: productMap.get(item.product_code) || item.product_code,
            predicted_quantity: item.predicted_quantity,
            actual_quantity: item.actual_quantity,
            notes: item.notes,
          }));

          return { ...order, items };
        })
      );

      setOrders(ordersWithItems);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateActualQuantity = async (itemId: string, quantity: number) => {
    try {
      const { error } = await supabase
        .from('production_items')
        .update({ actual_quantity: quantity })
        .eq('id', itemId);

      if (error) throw error;

      fetchProductionOrders();
      toast({
        title: 'Updated',
        description: 'Quantity updated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const markOrderComplete = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('production_orders')
        .update({ status: 'completed' })
        .eq('id', orderId);

      if (error) throw error;

      fetchProductionOrders();
      toast({
        title: 'Success',
        description: 'Production order marked as complete',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const createProductionOrder = async () => {
    if (!newDeliveryDate) {
      toast({
        title: 'Error',
        description: 'Please select a delivery date',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('production_orders')
        .insert({
          order_date: newOrderDate,
          delivery_date: newDeliveryDate,
          status: 'planned',
          created_by: user?.id,
        });

      if (error) throw error;

      setIsCreateDialogOpen(false);
      setNewOrderDate(format(new Date(), 'yyyy-MM-dd'));
      setNewDeliveryDate('');
      fetchProductionOrders();
      
      toast({
        title: 'Success',
        description: 'Production order created successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'in_production':
        return <Clock className="h-5 w-5 text-blue-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'in_production':
        return 'bg-blue-500';
      default:
        return 'bg-yellow-500';
    }
  };

  // Group items by customer for better organization
  const groupItemsByCustomer = (items: ProductionItem[]) => {
    const grouped: { [key: string]: ProductionItem[] } = {};
    items.forEach(item => {
      if (!grouped[item.customer_name]) {
        grouped[item.customer_name] = [];
      }
      grouped[item.customer_name].push(item);
    });
    return grouped;
  };

  // Calculate totals per product
  const calculateProductTotals = (orders: ProductionOrder[]) => {
    const totals: { [key: string]: { predicted: number; actual: number; name: string } } = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        if (!totals[item.product_code]) {
          totals[item.product_code] = { predicted: 0, actual: 0, name: item.product_name };
        }
        totals[item.product_code].predicted += item.predicted_quantity;
        totals[item.product_code].actual += item.actual_quantity || 0;
      });
    });
    return totals;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-xl text-muted-foreground">Loading production orders...</p>
        </div>
      </div>
    );
  }

  const productTotals = calculateProductTotals(orders);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Header */}
      <div className="bg-card border-b shadow-sm">
        <div className="container mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <Package className="h-12 w-12 text-primary" />
              <div>
                <h1 className="text-4xl font-bold text-foreground">Production Dashboard</h1>
                <p className="text-lg text-muted-foreground">Real-time production overview</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-5xl font-bold text-foreground tabular-nums">
                  {format(currentTime, 'HH:mm:ss')}
                </div>
                <div className="text-xl text-muted-foreground">
                  {format(currentTime, 'EEEE, MMMM d, yyyy')}
                </div>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg">
                    <Plus className="mr-2 h-5 w-5" />
                    New Production Order
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Production Order</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Order Date</Label>
                      <Input
                        type="date"
                        value={newOrderDate}
                        onChange={(e) => setNewOrderDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Delivery Date</Label>
                      <Input
                        type="date"
                        value={newDeliveryDate}
                        onChange={(e) => setNewDeliveryDate(e.target.value)}
                      />
                    </div>
                    <Button onClick={createProductionOrder} className="w-full">
                      Create Order
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-8 py-8">
        {/* Product Totals Overview */}
        <Card className="mb-8 bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl">Total Production Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {Object.entries(productTotals).map(([code, data]) => (
                <div key={code} className="text-center p-4 bg-card rounded-lg border">
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    {data.name}
                  </div>
                  <div className="text-4xl font-bold text-primary mb-1">
                    {data.predicted}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Produced: {data.actual}
                  </div>
                  {data.actual >= data.predicted && (
                    <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mt-2" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Production Orders */}
        {orders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16">
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-2xl text-muted-foreground">No active production orders</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const groupedItems = groupItemsByCustomer(order.items);
              
              return (
                <Card key={order.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(order.status)}
                        <div>
                          <CardTitle className="text-2xl">
                            Delivery: {format(new Date(order.delivery_date), 'MMMM d, yyyy')}
                          </CardTitle>
                          <p className="text-muted-foreground">
                            Order Date: {format(new Date(order.order_date), 'MMMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={getStatusColor(order.status)}>
                          {order.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        {order.status === 'in_production' && (
                          <Button onClick={() => markOrderComplete(order.id)} size="lg">
                            <CheckCircle2 className="mr-2 h-5 w-5" />
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-8">
                      {Object.entries(groupedItems).map(([customerName, customerItems]) => (
                        <div key={customerName} className="border rounded-lg overflow-hidden">
                          <div className="bg-muted px-6 py-4">
                            <h3 className="text-xl font-bold text-foreground">{customerName}</h3>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b bg-muted/30">
                                  <th className="text-left py-4 px-6 text-base font-semibold">Product</th>
                                  <th className="text-center py-4 px-6 text-base font-semibold">Target Qty</th>
                                  <th className="text-center py-4 px-6 text-base font-semibold">Actual Qty</th>
                                  <th className="text-center py-4 px-6 text-base font-semibold">Status</th>
                                  <th className="text-right py-4 px-6 text-base font-semibold">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {customerItems.map((item) => {
                                  const isComplete = item.actual_quantity !== null && item.actual_quantity >= item.predicted_quantity;
                                  return (
                                    <tr key={item.id} className="border-b hover:bg-muted/20">
                                      <td className="py-4 px-6 text-base font-medium">{item.product_name}</td>
                                      <td className="py-4 px-6 text-center text-2xl font-bold text-primary">
                                        {item.predicted_quantity}
                                      </td>
                                      <td className="py-4 px-6 text-center">
                                        <input
                                          type="number"
                                          min="0"
                                          value={item.actual_quantity || ''}
                                          onChange={(e) => updateActualQuantity(item.id, parseInt(e.target.value) || 0)}
                                          className="w-24 text-center text-xl font-bold border rounded px-3 py-2 bg-background"
                                          placeholder="0"
                                        />
                                      </td>
                                      <td className="py-4 px-6 text-center">
                                        {isComplete ? (
                                          <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto" />
                                        ) : (
                                          <Clock className="h-6 w-6 text-yellow-500 mx-auto" />
                                        )}
                                      </td>
                                      <td className="py-4 px-6 text-right">
                                        {item.notes && (
                                          <Badge variant="outline">{item.notes}</Badge>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductionDashboard;
