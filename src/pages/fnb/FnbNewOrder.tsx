import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Plus, Trash2, ShoppingCart, Save } from 'lucide-react';
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

interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

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

  // Populate form when editing
  useEffect(() => {
    if (existingOrder) {
      setCustomerId(existingOrder.customer_id || '');
      setDeliveryDate(existingOrder.delivery_date || format(new Date(), 'yyyy-MM-dd'));
      setNotes(existingOrder.notes || '');
      setOrderNumber(existingOrder.order_number);
      
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
      toast.success(`Order ${order.order_number} created and queued for picking`);
      navigate('/fnb/orders');
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
                    <Select value={customerId} onValueChange={setCustomerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers?.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Delivery Date</Label>
                    <Input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </div>
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
                          <Select
                            value={item.productId}
                            onValueChange={(v) => updateItem(index, 'productId', v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {products?.map((p: any) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} ({p.code}) - {p.price_xcg} XCG/{p.unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
    </div>
  );
}
