import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Plus, Trash2, ShoppingCart, Save, Banknote, CreditCard, Building2, FileText, UserPlus, Truck, Store, Package } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

type PaymentMethod = 'cash' | 'swipe' | 'transfer' | 'credit';

const PAYMENT_METHODS: { value: PaymentMethod; label: string; iconName: 'banknote' | 'creditCard' | 'building2' | 'fileText' }[] = [
  { value: 'cash', label: 'Cash', iconName: 'banknote' },
  { value: 'swipe', label: 'Swipe', iconName: 'creditCard' },
  { value: 'transfer', label: 'Bank Transfer', iconName: 'building2' },
  { value: 'credit', label: 'Credit (QB)', iconName: 'fileText' },
];

const PaymentIcon = ({ name }: { name: string }) => {
  switch (name) {
    case 'banknote': return <Banknote className="h-4 w-4" />;
    case 'creditCard': return <CreditCard className="h-4 w-4" />;
    case 'building2': return <Building2 className="h-4 w-4" />;
    case 'fileText': return <FileText className="h-4 w-4" />;
    default: return null;
  }
};

export default function FnbNewOrder() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const queryClient = useQueryClient();
  const isEditMode = !!orderId;
  
  const [customerId, setCustomerId] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [orderNumber, setOrderNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [isPickup, setIsPickup] = useState(false);
  
  // New customer dialog state
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    whatsapp_phone: '',
    address: '',
    delivery_zone: '',
    customer_type: 'regular' as 'regular' | 'supermarket' | 'cod' | 'credit',
    preferred_language: 'pap',
  });

  // New product dialog state
  const [isNewProductDialogOpen, setIsNewProductDialogOpen] = useState(false);
  const [pendingProductItemIndex, setPendingProductItemIndex] = useState<number | null>(null);
  const [newProductForm, setNewProductForm] = useState({
    code: '',
    name: '',
    unit: 'kg',
    price_xcg: 0,
  });

  const { data: customers } = useQuery({
    queryKey: ['fnb-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_customers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: deliveryZones } = useQuery({
    queryKey: ['fnb-delivery-zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_delivery_zones')
        .select('name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ['fnb-products-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_products')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Load existing order for edit mode
  const { data: existingOrder, isLoading: isLoadingOrder } = useQuery({
    queryKey: ['fnb-order', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from('fnb_orders')
        .select(`
          *,
          fnb_order_items(*, fnb_products(*))
        `)
        .eq('id', orderId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEditMode,
  });

  // Smart pre-fill payment method when customer changes
  useEffect(() => {
    const prefillPaymentMethod = async () => {
      if (!customerId || isEditMode) return;
      
      const customer = customers?.find((c: any) => c.id === customerId);
      
      // 1. Check if customer has preferred payment method
      if (customer?.preferred_payment_method) {
        setPaymentMethod(customer.preferred_payment_method as PaymentMethod);
        return;
      }
      
      // 2. Check last 5 orders for most common payment method
      const { data: recentOrders } = await supabase
        .from('fnb_orders')
        .select('payment_method_used')
        .eq('customer_id', customerId)
        .not('payment_method_used', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (recentOrders && recentOrders.length > 0) {
        // Find most common payment method
        const methodCounts: Record<string, number> = {};
        recentOrders.forEach((order) => {
          if (order.payment_method_used) {
            methodCounts[order.payment_method_used] = (methodCounts[order.payment_method_used] || 0) + 1;
          }
        });
        
        const mostCommon = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0];
        if (mostCommon) {
          setPaymentMethod(mostCommon[0] as PaymentMethod);
          return;
        }
      }
      
      // 3. Default to cash
      setPaymentMethod('cash');
    };
    
    prefillPaymentMethod();
  }, [customerId, customers, isEditMode]);

  // Populate form when editing
  useEffect(() => {
    if (existingOrder) {
      setCustomerId(existingOrder.customer_id || '');
      setDeliveryDate(existingOrder.delivery_date || format(new Date(), 'yyyy-MM-dd'));
      setNotes(existingOrder.notes || '');
      setOrderNumber(existingOrder.order_number);
      setPaymentMethod((existingOrder.payment_method_used as PaymentMethod) || 'cash');
      setIsPickup(existingOrder.is_pickup || false);
      
      const loadedItems: OrderItem[] = existingOrder.fnb_order_items?.map((item: any) => ({
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: item.unit_price_xcg,
        total: item.total_xcg,
      })) || [];
      setItems(loadedItems);
    }
  }, [existingOrder]);

  const addItem = () => {
    setItems([...items, { productId: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  // Handle customer selection
  const handleCustomerChange = (value: string) => {
    setCustomerId(value);
  };

  // Create new customer mutation
  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!newCustomerForm.name.trim()) throw new Error('Name is required');
      if (!newCustomerForm.whatsapp_phone.trim()) throw new Error('WhatsApp phone is required');

      const { data, error } = await supabase
        .from('fnb_customers')
        .insert({
          name: newCustomerForm.name.trim(),
          whatsapp_phone: newCustomerForm.whatsapp_phone.trim(),
          address: newCustomerForm.address.trim() || null,
          delivery_zone: newCustomerForm.delivery_zone || null,
          customer_type: newCustomerForm.customer_type,
          preferred_language: newCustomerForm.preferred_language,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newCustomer) => {
      queryClient.invalidateQueries({ queryKey: ['fnb-customers'] });
      setCustomerId(newCustomer.id);
      setIsNewCustomerDialogOpen(false);
      setNewCustomerForm({
        name: '',
        whatsapp_phone: '',
        address: '',
        delivery_zone: '',
        customer_type: 'regular',
        preferred_language: 'pap',
      });
      toast.success(`Customer "${newCustomer.name}" created`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Handle product selection
  const handleProductChange = (index: number, value: string) => {
    updateItem(index, 'productId', value);
  };

  // Handle add new product click
  const handleAddNewProduct = (index: number) => {
    setPendingProductItemIndex(index);
    setIsNewProductDialogOpen(true);
  };

  // Create new product mutation
  const createProductMutation = useMutation({
    mutationFn: async () => {
      if (!newProductForm.code.trim()) throw new Error('Product code is required');
      if (!newProductForm.name.trim()) throw new Error('Product name is required');
      if (newProductForm.price_xcg <= 0) throw new Error('Price must be greater than 0');

      const { data, error } = await supabase
        .from('fnb_products')
        .insert({
          code: newProductForm.code.trim(),
          name: newProductForm.name.trim(),
          unit: newProductForm.unit,
          price_xcg: newProductForm.price_xcg,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newProduct) => {
      queryClient.invalidateQueries({ queryKey: ['fnb-products-active'] });
      // Auto-select the new product in the pending order item
      if (pendingProductItemIndex !== null) {
        updateItem(pendingProductItemIndex, 'productId', newProduct.id);
      }
      setIsNewProductDialogOpen(false);
      setPendingProductItemIndex(null);
      setNewProductForm({ code: '', name: '', unit: 'kg', price_xcg: 0 });
      toast.success(`Product "${newProduct.name}" created`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-fill price when product selected
    if (field === 'productId') {
      const product = products?.find((p: any) => p.id === value);
      if (product) {
        newItems[index].unitPrice = product.price_xcg;
        newItems[index].total = product.price_xcg * newItems[index].quantity;
      }
    }

    // Recalculate total when quantity changes
    if (field === 'quantity') {
      newItems[index].total = newItems[index].unitPrice * value;
    }

    setItems(newItems);
  };

  const orderTotal = items.reduce((sum, item) => sum + item.total, 0);

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error('Please select a customer');
      if (items.length === 0) throw new Error('Please add at least one item');
      if (items.some((i) => !i.productId))
        throw new Error('Please select products for all items');

      // Generate order number
      const newOrderNumber = `FNB-${Date.now()}`;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('fnb_orders')
        .insert({
          customer_id: customerId,
          order_number: newOrderNumber,
          order_date: new Date().toISOString().split('T')[0],
          delivery_date: deliveryDate,
          notes,
          total_xcg: orderTotal,
          status: 'pending',
          payment_method: paymentMethod,
          payment_method_used: paymentMethod,
          cod_amount_due: paymentMethod === 'cash' ? orderTotal : null,
          is_pickup: isPickup,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price_xcg: item.unitPrice,
        total_xcg: item.total,
      }));

      const { error: itemsError } = await supabase
        .from('fnb_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Add to picker queue automatically
      const { error: queueError } = await supabase
        .from('fnb_picker_queue')
        .insert({
          order_id: order.id,
          status: 'queued',
          priority: 0,
        });

      if (queueError) throw queueError;

      // Update order status to confirmed
      await supabase
        .from('fnb_orders')
        .update({ status: 'confirmed' })
        .eq('id', order.id);

      return order;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['fnb-orders'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-picker-queue'] });
      toast.success(`Order ${order.order_number} created and queued for picking${isPickup ? ' (Pickup)' : ''}`);
      
      // Reset form for next order instead of navigating away
      setCustomerId('');
      setItems([{ productId: '', quantity: 1, unitPrice: 0, total: 0 }]);
      setNotes('');
      setPaymentMethod('cash');
      setIsPickup(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error('No order ID');
      if (!customerId) throw new Error('Please select a customer');
      if (items.length === 0) throw new Error('Please add at least one item');
      if (items.some((i) => !i.productId))
        throw new Error('Please select products for all items');

      // Update order
      const { error: orderError } = await supabase
        .from('fnb_orders')
        .update({
          customer_id: customerId,
          delivery_date: deliveryDate,
          notes,
          total_xcg: orderTotal,
          payment_method: paymentMethod,
          payment_method_used: paymentMethod,
          cod_amount_due: paymentMethod === 'cash' ? orderTotal : null,
          is_pickup: isPickup,
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // Delete existing items
      const { error: deleteError } = await supabase
        .from('fnb_order_items')
        .delete()
        .eq('order_id', orderId);

      if (deleteError) throw deleteError;

      // Insert new items
      const orderItems = items.map((item) => ({
        order_id: orderId,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price_xcg: item.unitPrice,
        total_xcg: item.total,
      }));

      const { error: itemsError } = await supabase
        .from('fnb_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return { order_number: orderNumber };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['fnb-orders'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-order', orderId] });
      toast.success(`Order ${result.order_number} updated`);
      navigate('/fnb/orders');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = () => {
    if (isEditMode) {
      updateOrderMutation.mutate();
    } else {
      createOrderMutation.mutate();
    }
  };

  const isPending = createOrderMutation.isPending || updateOrderMutation.isPending;

  if (isEditMode && isLoadingOrder) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-6">
          <p className="text-center text-muted-foreground">Loading order...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/fnb/orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">
              {isEditMode ? `Edit Order ${orderNumber}` : 'New F&B Order'}
            </h1>
            <p className="text-muted-foreground">
              {isEditMode ? 'Update order details and items' : 'Manually create an order for F&B customers'}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Order Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer & Delivery */}
            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer *</Label>
                    <SearchableSelect
                      options={customers?.map((c: any) => ({
                        value: c.id,
                        label: c.name,
                        searchTerms: `${c.name} ${c.whatsapp_phone || ''} ${c.delivery_zone || ''} ${c.address || ''}`,
                      })) || []}
                      value={customerId}
                      onValueChange={handleCustomerChange}
                      placeholder="Select customer"
                      emptyMessage="No customers found"
                      addNewLabel="Add New Customer"
                      onAddNew={() => setIsNewCustomerDialogOpen(true)}
                      addNewIcon={<UserPlus className="mr-2 h-4 w-4" />}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isPickup ? 'Pickup Date' : 'Delivery Date'}</Label>
                    <Input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </div>
                </div>
                
                {/* Order Type Toggle */}
                <div className="space-y-2">
                  <Label>Order Type</Label>
                  <ToggleGroup 
                    type="single" 
                    value={isPickup ? 'pickup' : 'delivery'} 
                    onValueChange={(value) => value && setIsPickup(value === 'pickup')}
                    className="justify-start"
                  >
                    <ToggleGroupItem 
                      value="delivery"
                      className="flex items-center gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      <Truck className="h-4 w-4" />
                      <span>Delivery</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem 
                      value="pickup"
                      className="flex items-center gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      <Store className="h-4 w-4" />
                      <span>Pickup</span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="space-y-2">
                  <Label>Payment Method *</Label>
                  <ToggleGroup 
                    type="single" 
                    value={paymentMethod} 
                    onValueChange={(value) => value && setPaymentMethod(value as PaymentMethod)}
                    className="justify-start flex-wrap"
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <ToggleGroupItem 
                        key={method.value} 
                        value={method.value}
                        className="flex items-center gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                      >
                        <PaymentIcon name={method.iconName} />
                        <span className="hidden sm:inline">{method.label}</span>
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Special instructions, delivery notes..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Order Items
                </CardTitle>
                <Button onClick={addItem} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No items added yet. Click "Add Item" to start.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
                      >
                        <div className="flex-1">
                          <SearchableSelect
                            options={products?.map((p: any) => ({
                              value: p.id,
                              label: `${p.name} (${p.code}) - ${p.price_xcg} XCG/${p.unit}`,
                              searchTerms: `${p.name} ${p.code}`,
                            })) || []}
                            value={item.productId}
                            onValueChange={(v) => handleProductChange(index, v)}
                            placeholder="Select product"
                            emptyMessage="No products found"
                            addNewLabel="Add New Product"
                            onAddNew={() => handleAddNewProduct(index)}
                            addNewIcon={<Package className="mr-2 h-4 w-4" />}
                          />
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(index, 'quantity', Number(e.target.value))
                            }
                            placeholder="Qty"
                          />
                        </div>
                        <div className="w-28 text-right font-medium">
                          {item.total.toFixed(2)} XCG
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Items</span>
                    <span>{items.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Customer</span>
                    <span>
                      {customers?.find((c: any) => c.id === customerId)?.name || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery</span>
                    <span>
                      {deliveryDate
                        ? format(new Date(deliveryDate), 'MMM d, yyyy')
                        : '-'}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{orderTotal.toFixed(2)} XCG</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={isPending || !customerId || items.length === 0}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isPending 
                    ? (isEditMode ? 'Updating...' : 'Creating...') 
                    : (isEditMode ? 'Update Order' : 'Create Order')}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  {isEditMode 
                    ? 'Changes will be saved to the existing order'
                    : 'Order will be automatically queued for picking'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Add New Customer Dialog */}
      <Dialog open={isNewCustomerDialogOpen} onOpenChange={setIsNewCustomerDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add New Customer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={newCustomerForm.name}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp Phone *</Label>
              <Input
                value={newCustomerForm.whatsapp_phone}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, whatsapp_phone: e.target.value })}
                placeholder="+5999..."
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={newCustomerForm.address}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                placeholder="Delivery address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Delivery Zone</Label>
                <Select 
                  value={newCustomerForm.delivery_zone} 
                  onValueChange={(v) => setNewCustomerForm({ ...newCustomerForm, delivery_zone: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryZones?.map((zone: any) => (
                      <SelectItem key={zone.name} value={zone.name}>
                        {zone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Customer Type</Label>
                <Select 
                  value={newCustomerForm.customer_type} 
                  onValueChange={(v) => setNewCustomerForm({ ...newCustomerForm, customer_type: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="supermarket">Supermarket</SelectItem>
                    <SelectItem value="cod">COD</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Preferred Language</Label>
              <Select 
                value={newCustomerForm.preferred_language} 
                onValueChange={(v) => setNewCustomerForm({ ...newCustomerForm, preferred_language: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pap">Papiamentu</SelectItem>
                  <SelectItem value="nl">Dutch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewCustomerDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createCustomerMutation.mutate()}
              disabled={createCustomerMutation.isPending || !newCustomerForm.name.trim() || !newCustomerForm.whatsapp_phone.trim()}
            >
              {createCustomerMutation.isPending ? 'Creating...' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Product Dialog */}
      <Dialog open={isNewProductDialogOpen} onOpenChange={setIsNewProductDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Add New Product
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Product Code *</Label>
              <Input
                value={newProductForm.code}
                onChange={(e) => setNewProductForm({ ...newProductForm, code: e.target.value })}
                placeholder="e.g., STB_500"
              />
            </div>
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input
                value={newProductForm.name}
                onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                placeholder="e.g., Strawberries 500g"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select 
                  value={newProductForm.unit} 
                  onValueChange={(v) => setNewProductForm({ ...newProductForm, unit: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="piece">piece</SelectItem>
                    <SelectItem value="box">box</SelectItem>
                    <SelectItem value="tray">tray</SelectItem>
                    <SelectItem value="gram">gram</SelectItem>
                    <SelectItem value="bunch">bunch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price (XCG) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newProductForm.price_xcg}
                  onChange={(e) => setNewProductForm({ ...newProductForm, price_xcg: Number(e.target.value) })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewProductDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createProductMutation.mutate()}
              disabled={createProductMutation.isPending || !newProductForm.code.trim() || !newProductForm.name.trim() || newProductForm.price_xcg <= 0}
            >
              {createProductMutation.isPending ? 'Creating...' : 'Create Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
