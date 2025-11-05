import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomerOrder, PRODUCTS, OrderItem } from '@/types/order';
import { Plus, Trash2, Save, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const NewOrder = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [weekNumber, setWeekNumber] = useState(45);
  const [deliveryDate, setDeliveryDate] = useState('2025-11-03');
  const [placedBy, setPlacedBy] = useState('');
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([
    {
      customerId: '1',
      customerName: '',
      items: PRODUCTS.map(p => ({ productCode: p.code, quantity: 0 })),
    }
  ]);

  useEffect(() => {
    const fetchCustomers = async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name');
      
      if (error) {
        console.error('Error fetching customers:', error);
        toast({
          title: 'Error',
          description: 'Failed to load customers',
          variant: 'destructive',
        });
        return;
      }
      
      setCustomers(data || []);
    };
    
    fetchCustomers();
  }, []);

  const addCustomer = () => {
    setCustomerOrders([
      ...customerOrders,
      {
        customerId: Date.now().toString(),
        customerName: '',
        items: PRODUCTS.map(p => ({ productCode: p.code, quantity: 0 })),
      }
    ]);
  };

  const removeCustomer = (customerId: string) => {
    setCustomerOrders(customerOrders.filter(co => co.customerId !== customerId));
  };

  const updateCustomerName = (customerId: string, name: string) => {
    setCustomerOrders(customerOrders.map(co => 
      co.customerId === customerId ? { ...co, customerName: name } : co
    ));
  };

  const updateQuantityByTrays = (customerId: string, productCode: string, trays: number) => {
    const product = PRODUCTS.find(p => p.code === productCode);
    if (!product) return;
    
    const units = trays * product.packSize;
    setCustomerOrders(customerOrders.map(co => 
      co.customerId === customerId 
        ? {
            ...co,
            items: co.items.map(item =>
              item.productCode === productCode ? { ...item, quantity: units } : item
            )
          }
        : co
    ));
  };

  const updateQuantityByUnits = (customerId: string, productCode: string, units: number) => {
    setCustomerOrders(customerOrders.map(co => 
      co.customerId === customerId 
        ? {
            ...co,
            items: co.items.map(item =>
              item.productCode === productCode ? { ...item, quantity: units } : item
            )
          }
        : co
    ));
  };

  const calculateRoundup = () => {
    const roundup = PRODUCTS.map(product => {
      const totalUnits = customerOrders.reduce((sum, co) => {
        const item = co.items.find(i => i.productCode === product.code);
        return sum + (item?.quantity || 0);
      }, 0);
      const totalTrays = Math.ceil(totalUnits / product.packSize);
      return { product, totalTrays, totalUnits };
    });
    return roundup;
  };

  const handleSave = () => {
    if (!placedBy) {
      toast({
        title: 'Error',
        description: 'Please enter who placed this order',
        variant: 'destructive',
      });
      return;
    }

    if (customerOrders.every(co => !co.customerName)) {
      toast({
        title: 'Error',
        description: 'Please add at least one customer',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'Order saved successfully!',
    });
    
    setTimeout(() => navigate('/history'), 1000);
  };

  const roundup = calculateRoundup();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">New Order</h1>
          <p className="text-muted-foreground">Create a new order from your customers</p>
        </div>

        <div className="grid gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="week">Week Number</Label>
                <Input
                  id="week"
                  type="number"
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="delivery">Delivery Date</Label>
                <Input
                  id="delivery"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="placed-by">Placed By</Label>
                <Input
                  id="placed-by"
                  value={placedBy}
                  onChange={(e) => setPlacedBy(e.target.value)}
                  placeholder="Your name"
                />
              </div>
            </CardContent>
          </Card>

          {customerOrders.map((customerOrder) => (
            <Card key={customerOrder.customerId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1 max-w-xs">
                    <Label htmlFor={`customer-${customerOrder.customerId}`}>Customer Name</Label>
                    <select
                      id={`customer-${customerOrder.customerId}`}
                      className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={customerOrder.customerName}
                      onChange={(e) => updateCustomerName(customerOrder.customerId, e.target.value)}
                    >
                      <option value="">Select customer...</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.name}>{customer.name}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCustomer(customerOrder.customerId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Product</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Trays/Cases</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Units</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Pack Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerOrder.items.map((item) => {
                        const product = PRODUCTS.find(p => p.code === item.productCode)!;
                        const trays = Math.ceil(item.quantity / product.packSize);
                        return (
                          <tr key={item.productCode} className="border-b">
                            <td className="py-3 px-4 text-sm text-foreground">{product.name}</td>
                            <td className="py-3 px-4">
                              <Input
                                type="number"
                                min="0"
                                value={trays || ''}
                                onChange={(e) => updateQuantityByTrays(customerOrder.customerId, item.productCode, parseInt(e.target.value) || 0)}
                                className="w-24 ml-auto"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <Input
                                type="number"
                                min="0"
                                value={item.quantity || ''}
                                onChange={(e) => updateQuantityByUnits(customerOrder.customerId, item.productCode, parseInt(e.target.value) || 0)}
                                className="w-24 ml-auto"
                              />
                            </td>
                            <td className="py-3 px-4 text-right text-sm text-muted-foreground">{product.packSize}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button onClick={addCustomer} variant="outline" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>

          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-primary">Order Roundup</CardTitle>
              <CardDescription>Total quantities needed for ordering</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Product</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Total Trays</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Total Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roundup.map(({ product, totalTrays, totalUnits }) => (
                      <tr key={product.code} className="border-b">
                        <td className="py-3 px-4 text-sm font-medium text-foreground">{product.name}</td>
                        <td className="py-3 px-4 text-right text-lg font-bold text-primary">{totalTrays}</td>
                        <td className="py-3 px-4 text-right text-sm text-muted-foreground">{totalUnits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button onClick={handleSave} className="flex-1" size="lg">
              <Save className="mr-2 h-5 w-5" />
              Save Order
            </Button>
            <Button variant="outline" className="flex-1" size="lg">
              <Printer className="mr-2 h-5 w-5" />
              Print Packing Slip
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NewOrder;
