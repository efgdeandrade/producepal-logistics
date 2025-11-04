import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomerOrder, PRODUCTS, OrderItem } from '@/types/order';
import { Plus, Trash2, Save, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const CUSTOMERS = [
  'FUIK SHOP',
  'RIO',
  'HYPER',
  'VDT JANTHIEL',
  'CORENDON',
  'GOISCO JNW',
];

const NewOrder = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
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

  const updateQuantity = (customerId: string, productCode: string, quantity: number) => {
    setCustomerOrders(customerOrders.map(co => 
      co.customerId === customerId 
        ? {
            ...co,
            items: co.items.map(item =>
              item.productCode === productCode ? { ...item, quantity } : item
            )
          }
        : co
    ));
  };

  const calculateRoundup = () => {
    const roundup = PRODUCTS.map(product => {
      const totalTrays = customerOrders.reduce((sum, co) => {
        const item = co.items.find(i => i.productCode === product.code);
        return sum + (item?.quantity || 0);
      }, 0);
      const totalUnits = totalTrays * product.packSize;
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
          <p className="text-muted-foreground">Create a new order for your customers</p>
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
                      {CUSTOMERS.map(customer => (
                        <option key={customer} value={customer}>{customer}</option>
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
                        <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Pack Size</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Total Units</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerOrder.items.map((item) => {
                        const product = PRODUCTS.find(p => p.code === item.productCode)!;
                        const totalUnits = item.quantity * product.packSize;
                        return (
                          <tr key={item.productCode} className="border-b">
                            <td className="py-3 px-4 text-sm text-foreground">{product.name}</td>
                            <td className="py-3 px-4">
                              <Input
                                type="number"
                                min="0"
                                value={item.quantity || ''}
                                onChange={(e) => updateQuantity(customerOrder.customerId, item.productCode, parseInt(e.target.value) || 0)}
                                className="w-24 ml-auto"
                              />
                            </td>
                            <td className="py-3 px-4 text-right text-sm text-muted-foreground">{product.packSize}</td>
                            <td className="py-3 px-4 text-right text-sm font-semibold text-foreground">{totalUnits}</td>
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
