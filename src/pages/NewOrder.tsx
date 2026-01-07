import { useState, useEffect, useCallback } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, Printer, X, ArrowLeft, FileText, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getWeek } from 'date-fns';
import { StandingOrderPrompt } from '@/components/StandingOrderPrompt';

interface Product {
  id: string;
  code: string;
  name: string;
  pack_size: number;
  supplier_id: string | null;
  consolidation_group: string | null;
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
  notes: string;
  products: OrderProduct[];
}

const NewOrder = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const isEditMode = !!orderId;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const today = new Date();
  const [weekNumber, setWeekNumber] = useState(getWeek(today));
  const [deliveryDate, setDeliveryDate] = useState(today.toISOString().split('T')[0]);
  const [placedBy, setPlacedBy] = useState('');
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderItem[]>([]);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showStandingOrderPrompt, setShowStandingOrderPrompt] = useState(false);
  const [initialDateSet, setInitialDateSet] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [customersRes, productsRes, suppliersRes] = await Promise.all([
        supabase.from('customers').select('id, name').order('name'),
        supabase.from('products').select('id, code, name, pack_size, supplier_id, consolidation_group').order('name'),
        supabase.from('suppliers').select('id, name').order('name'),
      ]);
      
      if (customersRes.error) {
        toast({ title: 'Error', description: 'Failed to load customers', variant: 'destructive' });
        setLoading(false);
        return;
      }
      if (productsRes.error) {
        toast({ title: 'Error', description: 'Failed to load products', variant: 'destructive' });
        setLoading(false);
        return;
      }
      if (suppliersRes.error) {
        toast({ title: 'Error', description: 'Failed to load suppliers', variant: 'destructive' });
        setLoading(false);
        return;
      }
      
      setCustomers(customersRes.data || []);
      setProducts(productsRes.data || []);
      setSuppliers(suppliersRes.data || []);
      
      // If in edit mode, fetch existing order data
      if (isEditMode && orderId) {
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
          
        if (orderError) {
          toast({ title: 'Error', description: 'Failed to load order', variant: 'destructive' });
          navigate('/history');
          return;
        }
        
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', orderId);
          
        if (itemsError) {
          toast({ title: 'Error', description: 'Failed to load order items', variant: 'destructive' });
          setLoading(false);
          return;
        }
        
        // Populate form with existing order data
        setWeekNumber(order.week_number);
        setDeliveryDate(order.delivery_date);
        setPlacedBy(order.placed_by);
        
        // Group order items by customer
        const customerMap = new Map<string, CustomerOrderItem>();
        
        orderItems?.forEach((item: any) => {
          const existingCustomer = customerMap.get(item.customer_name);
          const product = productsRes.data?.find(p => p.code === item.product_code);
          
          if (!product) return;
          
          const orderProduct: OrderProduct = {
            id: Date.now().toString() + Math.random(),
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            packSize: product.pack_size,
            trays: item.quantity,
            units: item.quantity * product.pack_size,
          };
          
          if (existingCustomer) {
            existingCustomer.products.push(orderProduct);
          } else {
            const customer = customersRes.data?.find(c => c.name === item.customer_name);
            customerMap.set(item.customer_name, {
              id: Date.now().toString() + Math.random(),
              customerId: customer?.id || '',
              customerName: item.customer_name,
              notes: item.customer_notes || '',
              products: [orderProduct],
            });
          }
        });
        
        setCustomerOrders(Array.from(customerMap.values()));
      }
      
      setLoading(false);
    };
    
    fetchData();
  }, [orderId, isEditMode]);

  const addCustomer = () => {
    setCustomerOrders([
      ...customerOrders,
      {
        id: Date.now().toString(),
        customerId: '',
        customerName: '',
        notes: '',
        products: [],
      }
    ]);
  };

  const updateCustomerNotes = (id: string, notes: string) => {
    setCustomerOrders(customerOrders.map(co => 
      co.id === id ? { ...co, notes } : co
    ));
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

  const handleDeliveryDateChange = (newDate: string) => {
    setDeliveryDate(newDate);
    // Show standing order prompt when date is changed for new orders (not edit mode)
    if (!isEditMode && initialDateSet) {
      setShowStandingOrderPrompt(true);
    }
    setInitialDateSet(true);
  };

  const loadStandingOrderData = async (data: Array<{
    customerId: string;
    customerName: string;
    products: Array<{ productCode: string; quantity: number }>;
  }>) => {
    // Convert standing order data to CustomerOrderItem format
    const newCustomerOrders: CustomerOrderItem[] = data.map(customerData => {
      const customerProducts: OrderProduct[] = customerData.products.map(p => {
        const product = products.find(prod => prod.code === p.productCode);
        return {
          id: Date.now().toString() + Math.random(),
          productId: product?.id || '',
          productCode: p.productCode,
          productName: product?.name || p.productCode,
          packSize: product?.pack_size || 1,
          trays: p.quantity,
          units: p.quantity * (product?.pack_size || 1),
        };
      });

      return {
        id: Date.now().toString() + Math.random(),
        customerId: customerData.customerId,
        customerName: customerData.customerName,
        notes: '',
        products: customerProducts,
      };
    });

    setCustomerOrders(newCustomerOrders);
    toast({ title: 'Standing order loaded', description: `Loaded ${newCustomerOrders.length} customers` });
  };

  const cloneLastOrderData = async (data: Array<{
    customerId: string;
    customerName: string;
    products: Array<{ productCode: string; quantity: number }>;
  }>) => {
    // Same as loading standing order
    await loadStandingOrderData(data);
    toast({ title: 'Order cloned', description: 'Copied from last order. PO numbers cleared.' });
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

  interface ConsolidatedGroup {
    groupName: string | null;
    packSize: number;
    products: Array<{ product: Product; individualUnits: number }>;
    totalUnits: number;
    totalCases: number;
  }

  interface SupplierGroup {
    supplier: { id: string; name: string };
    consolidatedGroups: ConsolidatedGroup[];
  }

  const groupBySupplier = (): SupplierGroup[] => {
    const roundup = calculateRoundup();
    const supplierMap = new Map<string, SupplierGroup>();

    roundup.forEach(item => {
      const supplierId = item.product.supplier_id || 'unknown';
      const supplier = suppliers.find(s => s.id === supplierId) || { id: 'unknown', name: 'Unknown Supplier' };
      const groupKey = item.product.consolidation_group;
      const packSize = item.product.pack_size;

      if (!supplierMap.has(supplierId)) {
        supplierMap.set(supplierId, { supplier, consolidatedGroups: [] });
      }

      const supplierGroup = supplierMap.get(supplierId)!;
      
      // Find or create consolidation group
      let consolidatedGroup = supplierGroup.consolidatedGroups.find(
        cg => cg.groupName === groupKey && cg.packSize === packSize
      );

      if (!consolidatedGroup) {
        consolidatedGroup = {
          groupName: groupKey,
          packSize,
          products: [],
          totalUnits: 0,
          totalCases: 0,
        };
        supplierGroup.consolidatedGroups.push(consolidatedGroup);
      }

      consolidatedGroup.products.push({ product: item.product, individualUnits: item.totalUnits });
      consolidatedGroup.totalUnits += item.totalUnits;
      consolidatedGroup.totalCases = Math.ceil(consolidatedGroup.totalUnits / packSize);
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
      
      if (isEditMode && orderId) {
        // Update existing order
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            week_number: weekNumber,
            delivery_date: deliveryDate,
            placed_by: placedBy,
            user_id: user?.id,
          })
          .eq('id', orderId);

        if (orderError) throw orderError;

        // Delete old order items
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', orderId);

        if (deleteError) throw deleteError;

        // Insert new order items
        const orderItems = customerOrders.flatMap(co => 
          co.products.map(p => ({
            order_id: orderId,
            customer_name: co.customerName,
            product_code: p.productCode,
            quantity: p.trays,
            po_number: null,
            customer_notes: co.notes || null,
          }))
        );

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;

        toast({ title: 'Success', description: 'Order updated successfully!' });
        setTimeout(() => navigate(`/order/${orderId}`), 1000);
      } else {
        // Create new order
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
            customer_notes: co.notes || null,
          }))
        );

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;

        toast({ title: 'Success', description: 'Order saved successfully!' });
        setTimeout(() => navigate('/history'), 1000);
      }
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
          ${co.notes ? `<p style="margin-top: 12px; padding: 10px; background: #fffbeb; border-left: 4px solid #f59e0b; font-style: italic;"><strong>Notes:</strong> ${co.notes}</p>` : ''}
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
    
    const printContent = supplierGroups.map(group => {
      const groupRows = group.consolidatedGroups.map(cg => {
        const isConsolidated = cg.groupName && cg.products.length > 1;
        
        if (isConsolidated) {
          // Show consolidated group with individual products indented
          const groupHeader = `
            <tr style="background: #e8f4e8;">
              <td colspan="3" style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">
                ${cg.groupName?.replace(/_/g, ' ')} (${cg.packSize} per case) - ${cg.totalCases} CASE${cg.totalCases !== 1 ? 'S' : ''}
              </td>
            </tr>
          `;
          const productRows = cg.products.map(p => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 12px; padding-left: 32px; color: #666;">↳ ${p.product.name}</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right; color: #666;">${p.individualUnits} units</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;"></td>
            </tr>
          `).join('');
          const totalRow = `
            <tr style="background: #f9f9f9;">
              <td style="border: 1px solid #ddd; padding: 12px; padding-left: 32px; font-style: italic;">Total in case(s)</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right; font-weight: bold;">${cg.totalUnits} units</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right; font-weight: bold;">${cg.totalCases} case${cg.totalCases !== 1 ? 's' : ''}</td>
            </tr>
          `;
          return groupHeader + productRows + totalRow;
        } else {
          // Non-consolidated: show individual product with cases
          return cg.products.map(p => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 12px;">${p.product.name}</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${p.individualUnits} units</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right; font-weight: bold;">${cg.totalCases} case${cg.totalCases !== 1 ? 's' : ''}</td>
            </tr>
          `).join('');
        }
      }).join('');

      return `
        <div style="page-break-after: always; padding: 40px; font-family: Arial, sans-serif;">
          <h1 style="margin-bottom: 20px;">Supplier Order - ${group.supplier.name}</h1>
          <p><strong>Week:</strong> ${weekNumber} | <strong>Delivery Date:</strong> ${deliveryDate}</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Product</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Quantity</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Cases</th>
              </tr>
            </thead>
            <tbody>
              ${groupRows}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

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
    <div className="container py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/history')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-4xl font-bold text-foreground">
                {isEditMode ? 'Edit Order' : 'New Order'}
              </h1>
            </div>
            {!isEditMode && (
              <Button 
                variant="outline" 
                onClick={() => setShowStandingOrderPrompt(true)}
              >
                <FileText className="mr-2 h-4 w-4" />
                Load Template
              </Button>
            )}
          </div>
          <p className="text-muted-foreground">
            {isEditMode ? 'Update order details and items' : 'Create a new order from your customers'}
          </p>
        </div>

        {loading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading order data...</p>
          </div>
        )}

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
                  onChange={(e) => handleDeliveryDateChange(e.target.value)}
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
                <div className="mt-3">
                  <Textarea
                    placeholder="Add notes for this customer's order (optional)..."
                    value={customerOrder.notes}
                    onChange={(e) => updateCustomerNotes(customerOrder.id, e.target.value)}
                    className="min-h-[60px] text-sm"
                    rows={2}
                  />
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
                          <td className="py-3 px-4 text-sm font-medium text-foreground">
                            {product.name}
                            {product.consolidation_group && (
                              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                                {product.consolidation_group.replace(/_/g, ' ')}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-lg font-bold text-primary">{totalTrays}</td>
                          <td className="py-3 px-4 text-right text-sm text-muted-foreground">{totalUnits}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Consolidated Supplier Orders Section */}
              {roundup.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="text-sm font-semibold text-foreground mb-4">Consolidated Supplier Orders</h4>
                  <div className="space-y-4">
                    {groupBySupplier().map((supplierGroup) => (
                      <div key={supplierGroup.supplier.id} className="border rounded-lg p-4 bg-background">
                        <h5 className="font-medium text-foreground mb-3">{supplierGroup.supplier.name}</h5>
                        <div className="space-y-2">
                          {supplierGroup.consolidatedGroups.map((cg, idx) => {
                            const isConsolidated = cg.groupName && cg.products.length > 1;
                            
                            if (isConsolidated) {
                              return (
                                <div key={idx} className="bg-green-50 dark:bg-green-950/20 rounded p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-green-800 dark:text-green-200">
                                      {cg.groupName?.replace(/_/g, ' ')} ({cg.packSize}/case)
                                    </span>
                                    <span className="font-bold text-green-700 dark:text-green-300">
                                      {cg.totalCases} CASE{cg.totalCases !== 1 ? 'S' : ''}
                                    </span>
                                  </div>
                                  <div className="text-sm text-muted-foreground space-y-1">
                                    {cg.products.map((p, pIdx) => (
                                      <div key={pIdx} className="flex justify-between pl-4">
                                        <span>↳ {p.product.name}</span>
                                        <span>{p.individualUnits} units</span>
                                      </div>
                                    ))}
                                    <div className="flex justify-between pl-4 pt-1 border-t border-green-200 dark:border-green-800 font-medium">
                                      <span>Total in case(s)</span>
                                      <span>{cg.totalUnits} units</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            } else {
                              return cg.products.map((p, pIdx) => (
                                <div key={`${idx}-${pIdx}`} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded">
                                  <span className="text-sm text-foreground">{p.product.name}</span>
                                  <div className="text-right">
                                    <span className="text-sm text-muted-foreground">{p.individualUnits} units</span>
                                    <span className="ml-3 font-bold text-foreground">{cg.totalCases} case{cg.totalCases !== 1 ? 's' : ''}</span>
                                  </div>
                                </div>
                              ));
                            }
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Button onClick={handleSave} className="w-full" size="lg" disabled={loading}>
              <Save className="mr-2 h-5 w-5" />
              {isEditMode ? 'Update Order' : 'Save Order'}
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

          {/* Quick access to Standing Orders */}
          {!isEditMode && (
            <div className="text-center">
              <Link 
                to="/standing-orders" 
                className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
              >
                <Settings className="h-3 w-3" />
                Manage Standing Order Templates
              </Link>
            </div>
        )}
      </div>

      {/* Standing Order Prompt Dialog */}
      <StandingOrderPrompt
        open={showStandingOrderPrompt}
        onOpenChange={setShowStandingOrderPrompt}
        deliveryDate={deliveryDate}
        onLoadStandingOrder={loadStandingOrderData}
        onCloneLastOrder={cloneLastOrderData}
        onStartFresh={() => setCustomerOrders([])}
      />
    </div>
  );
};

export default NewOrder;
