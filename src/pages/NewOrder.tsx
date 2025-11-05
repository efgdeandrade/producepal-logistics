import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, Printer, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getWeek } from 'date-fns';

interface Product {
  id: string;
  code: string;
  name: string;
  pack_size: number;
  supplier_id: string | null;
}

interface Customer {
  id: string;
  name: string;
}

interface OrderProduct {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  packSize: number;
  trays: number;
  units: number;
}

interface CustomerOrderItem {
  id: string;
  customerId: string;
  customerName: string;
  products: OrderProduct[];
}

const NewOrder = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const today = new Date();
  const [weekNumber, setWeekNumber] = useState(getWeek(today));
  const [deliveryDate, setDeliveryDate] = useState(today.toISOString().split('T')[0]);
  const [placedBy, setPlacedBy] = useState('');
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderItem[]>([]);
  const [showPrintOptions, setShowPrintOptions] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [customersRes, productsRes, suppliersRes] = await Promise.all([
        supabase.from('customers').select('id, name').order('name'),
        supabase.from('products').select('id, code, name, pack_size, supplier_id').order('name'),
        supabase.from('suppliers').select('id, name').order('name'),
      ]);
      
      if (customersRes.error) {
        toast({ title: 'Error', description: 'Failed to load customers', variant: 'destructive' });
        return;
      }
      if (productsRes.error) {
        toast({ title: 'Error', description: 'Failed to load products', variant: 'destructive' });
        return;
      }
      if (suppliersRes.error) {
        toast({ title: 'Error', description: 'Failed to load suppliers', variant: 'destructive' });
        return;
      }
      
      setCustomers(customersRes.data || []);
      setProducts(productsRes.data || []);
      setSuppliers(suppliersRes.data || []);
    };
    
    fetchData();
  }, []);

  const addCustomer = () => {
    setCustomerOrders([
      ...customerOrders,
      {
        id: Date.now().toString(),
        customerId: '',
        customerName: '',
        products: [],
      }
    ]);
  };

  const removeCustomer = (id: string) => {
    setCustomerOrders(customerOrders.filter(co => co.id !== id));
  };

  const updateCustomer = (id: string, customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    setCustomerOrders(customerOrders.map(co => 
      co.id === id ? { ...co, customerId, customerName: customer.name } : co
    ));
  };

  const addProductToCustomer = (customerId: string, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setCustomerOrders(customerOrders.map(co => {
      if (co.id !== customerId) return co;
      
      // Check if product already exists
      if (co.products.some(p => p.productId === productId)) {
        toast({ title: 'Product already added', variant: 'destructive' });
        return co;
      }

      return {
        ...co,
        products: [...co.products, {
          id: Date.now().toString(),
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          packSize: product.pack_size,
          trays: 0,
          units: 0,
        }]
      };
    }));
  };

  const removeProduct = (customerId: string, productId: string) => {
    setCustomerOrders(customerOrders.map(co => 
      co.id === customerId 
        ? { ...co, products: co.products.filter(p => p.id !== productId) }
        : co
    ));
  };

  const updateProductTrays = (customerId: string, productId: string, trays: number) => {
    setCustomerOrders(customerOrders.map(co => 
      co.id === customerId 
        ? {
            ...co,
            products: co.products.map(p =>
              p.id === productId 
                ? { ...p, trays, units: trays * p.packSize }
                : p
            )
          }
        : co
    ));
  };

  const updateProductUnits = (customerId: string, productId: string, units: number) => {
    setCustomerOrders(customerOrders.map(co => 
      co.id === customerId 
        ? {
            ...co,
            products: co.products.map(p =>
              p.id === productId 
                ? { ...p, units, trays: Math.ceil(units / p.packSize) }
                : p
            )
          }
        : co
    ));
  };

  const calculateRoundup = () => {
    const productMap = new Map<string, { product: Product; totalTrays: number; totalUnits: number }>();

    customerOrders.forEach(co => {
      co.products.forEach(orderProduct => {
        const product = products.find(p => p.id === orderProduct.productId);
        if (!product) return;

        const existing = productMap.get(product.id);
        if (existing) {
          existing.totalTrays += orderProduct.trays;
          existing.totalUnits += orderProduct.units;
        } else {
          productMap.set(product.id, {
            product,
            totalTrays: orderProduct.trays,
            totalUnits: orderProduct.units,
          });
        }
      });
    });

    return Array.from(productMap.values()).sort((a, b) => a.product.name.localeCompare(b.product.name));
  };

  const groupBySupplier = () => {
    const supplierMap = new Map<string, { supplier: { id: string; name: string }; items: Array<{ product: Product; totalTrays: number; totalUnits: number }> }>();

    const roundup = calculateRoundup();
    roundup.forEach(item => {
      const supplierId = item.product.supplier_id || 'unknown';
      const supplier = suppliers.find(s => s.id === supplierId) || { id: 'unknown', name: 'Unknown Supplier' };

      const existing = supplierMap.get(supplierId);
      if (existing) {
        existing.items.push(item);
      } else {
        supplierMap.set(supplierId, {
          supplier,
          items: [item],
        });
      }
    });

    return Array.from(supplierMap.values());
  };

  const handleSave = async () => {
    if (!placedBy) {
      toast({ title: 'Error', description: 'Please enter who placed this order', variant: 'destructive' });
      return;
    }

    if (customerOrders.length === 0 || customerOrders.every(co => !co.customerId)) {
      toast({ title: 'Error', description: 'Please add at least one customer', variant: 'destructive' });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: `ORD-${Date.now()}`,
          week_number: weekNumber,
          delivery_date: deliveryDate,
          placed_by: placedBy,
          user_id: user?.id,
          status: 'active',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = customerOrders.flatMap(co => 
        co.products.map(p => ({
          order_id: order.id,
          customer_name: co.customerName,
          product_code: p.productCode,
          quantity: p.trays,
          po_number: null,
        }))
      );

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast({ title: 'Success', description: 'Order saved successfully!' });
      setTimeout(() => navigate('/history'), 1000);
    } catch (error) {
      console.error('Error saving order:', error);
      toast({ title: 'Error', description: 'Failed to save order', variant: 'destructive' });
    }
  };

  const handlePrintPackingLists = () => {
    const printContent = customerOrders
      .filter(co => co.customerId && co.products.length > 0)
      .map(co => `
        <div style="page-break-after: always; padding: 40px; font-family: Arial, sans-serif;">
          <h1 style="margin-bottom: 20px;">Packing List - ${co.customerName}</h1>
          <p><strong>Week:</strong> ${weekNumber} | <strong>Delivery Date:</strong> ${deliveryDate}</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Product</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Trays</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Units</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Pack Size</th>
              </tr>
            </thead>
            <tbody>
              ${co.products.map(p => `
                <tr>
                  <td style="border: 1px solid #ddd; padding: 12px;">${p.productName}</td>
                  <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${p.trays}</td>
                  <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${p.units}</td>
                  <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${p.packSize}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('');

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>Packing Lists</title></head>
          <body>${printContent}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handlePrintSupplierOrders = () => {
    const supplierGroups = groupBySupplier();
    
    const printContent = supplierGroups.map(group => `
      <div style="page-break-after: always; padding: 40px; font-family: Arial, sans-serif;">
        <h1 style="margin-bottom: 20px;">Supplier Order - ${group.supplier.name}</h1>
        <p><strong>Week:</strong> ${weekNumber} | <strong>Delivery Date:</strong> ${deliveryDate}</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Product</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Total Trays</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Total Units</th>
            </tr>
          </thead>
          <tbody>
            ${group.items.map(item => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.product.name}</td>
                <td style="border: 1px solid #ddd; padding: 12px; text-align: right; font-weight: bold;">${item.totalTrays}</td>
                <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${item.totalUnits}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('');

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>Supplier Orders</title></head>
          <body>${printContent}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
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
            <Card key={customerOrder.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label>Customer</Label>
                    <Select value={customerOrder.customerId} onValueChange={(value) => updateCustomer(customerOrder.id, value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select customer..." />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map(customer => (
                          <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label>Add Product</Label>
                    <Select 
                      value="" 
                      onValueChange={(value) => addProductToCustomer(customerOrder.id, value)}
                      disabled={!customerOrder.customerId}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select product to add..." />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(product => (
                          <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCustomer(customerOrder.id)}
                    className="mt-6"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {customerOrder.products.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No products added yet. Select a product from the dropdown above.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Product</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Trays/Cases</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Units</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Pack Size</th>
                          <th className="w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerOrder.products.map((product) => (
                          <tr key={product.id} className="border-b">
                            <td className="py-3 px-4 text-sm text-foreground">{product.productName}</td>
                            <td className="py-3 px-4">
                              <Input
                                type="number"
                                min="0"
                                value={product.trays || ''}
                                onChange={(e) => updateProductTrays(customerOrder.id, product.id, parseInt(e.target.value) || 0)}
                                className="w-24 ml-auto"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <Input
                                type="number"
                                min="0"
                                value={product.units || ''}
                                onChange={(e) => updateProductUnits(customerOrder.id, product.id, parseInt(e.target.value) || 0)}
                                className="w-24 ml-auto"
                              />
                            </td>
                            <td className="py-3 px-4 text-right text-sm text-muted-foreground">{product.packSize}</td>
                            <td className="py-3 px-4">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeProduct(customerOrder.id, product.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
                    {roundup.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                          No products added yet
                        </td>
                      </tr>
                    ) : (
                      roundup.map(({ product, totalTrays, totalUnits }) => (
                        <tr key={product.id} className="border-b">
                          <td className="py-3 px-4 text-sm font-medium text-foreground">{product.name}</td>
                          <td className="py-3 px-4 text-right text-lg font-bold text-primary">{totalTrays}</td>
                          <td className="py-3 px-4 text-right text-sm text-muted-foreground">{totalUnits}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Button onClick={handleSave} className="w-full" size="lg">
              <Save className="mr-2 h-5 w-5" />
              Save Order
            </Button>
            
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                size="lg"
                onClick={handlePrintPackingLists}
                disabled={customerOrders.length === 0 || customerOrders.every(co => !co.customerId)}
              >
                <Printer className="mr-2 h-5 w-5" />
                Print Packing Lists
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={handlePrintSupplierOrders}
                disabled={roundup.length === 0}
              >
                <Printer className="mr-2 h-5 w-5" />
                Print Supplier Orders
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NewOrder;
