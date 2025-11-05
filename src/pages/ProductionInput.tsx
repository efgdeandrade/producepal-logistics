import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface Customer {
  id: string;
  name: string;
}

interface Product {
  code: string;
  name: string;
}

interface ProductionData {
  [productCode: string]: {
    [customerId: string]: {
      itemId?: string;
      quantity: number;
    };
  };
}

const ProductionInput = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productionData, setProductionData] = useState<ProductionData>({});
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [productionOrders, setProductionOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedOrderId) {
      loadProductionItems(selectedOrderId);
    }
  }, [selectedOrderId]);

  const loadData = async () => {
    try {
      // Load customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name')
        .order('name');

      if (customersError) throw customersError;

      // Load products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('code, name')
        .order('name');

      if (productsError) throw productsError;

      // Load active production orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('production_orders')
        .select('*')
        .in('status', ['planned', 'in_production'])
        .order('delivery_date', { ascending: true });

      if (ordersError) throw ordersError;

      setCustomers(customersData || []);
      setProducts(productsData || []);
      setProductionOrders(ordersData || []);

      // Select the first order by default
      if (ordersData && ordersData.length > 0) {
        setSelectedOrderId(ordersData[0].id);
      }
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

  const loadProductionItems = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('production_items')
        .select('*')
        .eq('production_order_id', orderId);

      if (error) throw error;

      const newData: ProductionData = {};
      
      // Initialize empty grid
      products.forEach(product => {
        newData[product.code] = {};
        customers.forEach(customer => {
          newData[product.code][customer.id] = { quantity: 0 };
        });
      });

      // Fill in existing data
      (data || []).forEach(item => {
        if (!newData[item.product_code]) {
          newData[item.product_code] = {};
        }
        newData[item.product_code][item.customer_id] = {
          itemId: item.id,
          quantity: item.actual_quantity || item.predicted_quantity || 0,
        };
      });

      setProductionData(newData);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const updateQuantity = (productCode: string, customerId: string, quantity: number) => {
    setProductionData(prev => ({
      ...prev,
      [productCode]: {
        ...prev[productCode],
        [customerId]: {
          ...prev[productCode][customerId],
          quantity: quantity,
        },
      },
    }));
  };

  const saveAll = async () => {
    if (!selectedOrderId) {
      toast({
        title: 'Error',
        description: 'Please select a production order',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const updates = [];
      const inserts = [];

      for (const [productCode, customerData] of Object.entries(productionData)) {
        for (const [customerId, data] of Object.entries(customerData)) {
          if (data.quantity > 0) {
            if (data.itemId) {
              // Update existing
              updates.push({
                id: data.itemId,
                actual_quantity: data.quantity,
              });
            } else {
              // Insert new
              inserts.push({
                production_order_id: selectedOrderId,
                customer_id: customerId,
                product_code: productCode,
                predicted_quantity: data.quantity,
                actual_quantity: data.quantity,
              });
            }
          }
        }
      }

      if (updates.length > 0) {
        for (const update of updates) {
          const { error } = await supabase
            .from('production_items')
            .update({ actual_quantity: update.actual_quantity })
            .eq('id', update.id);
          
          if (error) throw error;
        }
      }

      if (inserts.length > 0) {
        const { error } = await supabase
          .from('production_items')
          .insert(inserts);
        
        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Production data saved successfully',
      });

      // Update order status to in_production if it was planned
      const selectedOrder = productionOrders.find(o => o.id === selectedOrderId);
      if (selectedOrder?.status === 'planned') {
        await supabase
          .from('production_orders')
          .update({ status: 'in_production' })
          .eq('id', selectedOrderId);
      }

      loadProductionItems(selectedOrderId);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const calculateRowTotal = (productCode: string) => {
    if (!productionData[productCode]) return 0;
    return Object.values(productionData[productCode]).reduce((sum, data) => sum + data.quantity, 0);
  };

  const calculateColumnTotal = (customerId: string) => {
    let total = 0;
    Object.values(productionData).forEach(customerData => {
      if (customerData[customerId]) {
        total += customerData[customerId].quantity;
      }
    });
    return total;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-xl text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/production')}>
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Production Input</h1>
                <p className="text-muted-foreground">Grid-based quantity entry</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label>Production Order:</Label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  {productionOrders.map(order => (
                    <option key={order.id} value={order.id}>
                      Delivery: {format(new Date(order.delivery_date), 'MMM d, yyyy')} - {order.status}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={saveAll} disabled={saving} size="lg">
                <Save className="mr-2 h-5 w-5" />
                {saving ? 'Saving...' : 'Save All'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        <Card>
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border bg-muted p-3 text-left font-semibold sticky left-0 z-10 bg-muted">
                      Product
                    </th>
                    {customers.map(customer => (
                      <th key={customer.id} className="border bg-muted p-3 text-center font-semibold min-w-[120px]">
                        {customer.name}
                      </th>
                    ))}
                    <th className="border bg-primary/10 p-3 text-center font-bold">
                      TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.code} className="hover:bg-muted/50">
                      <td className="border p-3 font-medium sticky left-0 z-10 bg-background">
                        {product.name}
                      </td>
                      {customers.map(customer => (
                        <td key={customer.id} className="border p-2">
                          <Input
                            type="number"
                            min="0"
                            value={productionData[product.code]?.[customer.id]?.quantity || ''}
                            onChange={(e) => updateQuantity(product.code, customer.id, parseInt(e.target.value) || 0)}
                            className="text-center w-full"
                            placeholder="0"
                          />
                        </td>
                      ))}
                      <td className="border p-3 text-center font-bold bg-primary/5">
                        {calculateRowTotal(product.code)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-primary/10">
                    <td className="border p-3 font-bold sticky left-0 z-10 bg-primary/10">
                      TOTAL
                    </td>
                    {customers.map(customer => (
                      <td key={customer.id} className="border p-3 text-center font-bold">
                        {calculateColumnTotal(customer.id)}
                      </td>
                    ))}
                    <td className="border p-3 text-center font-bold text-primary">
                      {Object.values(productionData).reduce((total, customerData) => 
                        total + Object.values(customerData).reduce((sum, data) => sum + data.quantity, 0), 0
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProductionInput;
