import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Plus, Trash2, ShoppingCart, Save, Banknote, CreditCard, Building2, FileText, UserPlus, Truck, Store, Package, Info, Sparkles, RotateCcw, Calendar, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import { POUploadDialog } from '@/components/fnb/POUploadDialog';
import { POReviewDialog } from '@/components/fnb/POReviewDialog';
import { usePOImport, MatchedItem } from '@/hooks/usePOImport';
import { useFnbOrderSuggestions, OrderSuggestion } from '@/hooks/useFnbOrderSuggestions';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  unit: string;
  unitPrice: number;
  total: number;
}

const UNITS = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'kg', label: 'Kg' },
  { value: 'g', label: 'Grams' },
  { value: 'lb', label: 'Lb' },
  { value: 'oz', label: 'Oz' },
  { value: 'case', label: 'Case' },
];

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
  const [items, setItems] = useState<OrderItem[]>([{ productId: '', quantity: 1, unit: 'pcs', unitPrice: 0, total: 0 }]);
  const [orderNumber, setOrderNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [isPickup, setIsPickup] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  
  // PO Import state
  const poImport = usePOImport();
  const [showPOUpload, setShowPOUpload] = useState(false);
  const [showPOReview, setShowPOReview] = useState(false);
  
  // Refs for keyboard navigation
  const quantityRefs = useRef<(HTMLInputElement | null)[]>([]);
  const priceRefs = useRef<(HTMLInputElement | null)[]>([]);
  const productSelectRefs = useRef<(HTMLButtonElement | null)[]>([]);
  
  // Order suggestions hook
  const { suggestions, lastOrderSuggestions, hasStandingOrder } = useFnbOrderSuggestions(customerId || null);
  
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
        unit: item.order_unit || item.fnb_products?.unit || 'pcs',
        unitPrice: item.unit_price_xcg,
        total: item.total_xcg,
      })) || [];
      // Ensure there's always a blank row for adding more items
      loadedItems.push({ productId: '', quantity: 1, unit: 'pcs', unitPrice: 0, total: 0 });
      setItems(loadedItems);
    }
  }, [existingOrder]);

  const addItem = useCallback(() => {
    setItems(prev => [...prev, { productId: '', quantity: 1, unit: 'pcs', unitPrice: 0, total: 0 }]);
    // Focus new row's product select after render
    setTimeout(() => {
      productSelectRefs.current[items.length]?.focus();
    }, 50);
  }, [items.length]);

  // Add suggestion to order
  const addSuggestionToOrder = useCallback((suggestion: OrderSuggestion) => {
    // Check if already in order
    const existingIndex = items.findIndex(item => item.productId === suggestion.productId);
    if (existingIndex >= 0) {
      // Focus existing row
      quantityRefs.current[existingIndex]?.focus();
      quantityRefs.current[existingIndex]?.select();
      return;
    }
    
    // Find empty row or add new one
    const emptyIndex = items.findIndex(item => !item.productId);
    if (emptyIndex >= 0) {
      // Use existing empty row
      setItems(prev => prev.map((item, idx) => 
        idx === emptyIndex 
          ? {
              productId: suggestion.productId,
              quantity: suggestion.avgQuantity,
              unit: suggestion.suggestedUnit,
              unitPrice: suggestion.suggestedPrice,
              total: suggestion.avgQuantity * suggestion.suggestedPrice,
            }
          : item
      ));
      // Add a new empty row
      setTimeout(() => {
        setItems(prev => [...prev, { productId: '', quantity: 1, unit: 'pcs', unitPrice: 0, total: 0 }]);
      }, 10);
    } else {
      // Add new row with suggestion
      setItems(prev => [
        ...prev,
        {
          productId: suggestion.productId,
          quantity: suggestion.avgQuantity,
          unit: suggestion.suggestedUnit,
          unitPrice: suggestion.suggestedPrice,
          total: suggestion.avgQuantity * suggestion.suggestedPrice,
        },
        { productId: '', quantity: 1, unit: 'pcs', unitPrice: 0, total: 0 },
      ]);
    }
  }, [items]);

  // Focus quantity input after product selection
  const focusQuantity = useCallback((index: number) => {
    setTimeout(() => {
      quantityRefs.current[index]?.focus();
      quantityRefs.current[index]?.select();
    }, 50);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S = Save order
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSubmit();
      }
      // Ctrl/Cmd + N = Add new item row
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        addItem();
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [addItem]);

  // Keyboard navigation handler for quantity/price inputs
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, field: 'quantity' | 'price') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'quantity') {
        // Move to price input
        priceRefs.current[index]?.focus();
        priceRefs.current[index]?.select();
      } else {
        // Move to next row's product or add new row
        if (index === items.length - 1) {
          addItem();
        } else {
          productSelectRefs.current[index + 1]?.focus();
        }
      }
    }
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      if (field === 'quantity') {
        quantityRefs.current[index - 1]?.focus();
      } else {
        priceRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === 'ArrowDown' && index < items.length - 1) {
      e.preventDefault();
      if (field === 'quantity') {
        quantityRefs.current[index + 1]?.focus();
      } else {
        priceRefs.current[index + 1]?.focus();
      }
    }
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
  const handleProductChange = (index: number, value: string, autoFocus = false) => {
    updateItem(index, 'productId', value, autoFocus);
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

  // Helper to get unit-specific price
  const getUnitPrice = (product: any, unit: string): number => {
    const unitPriceMap: Record<string, number | null> = {
      'kg': product.price_per_kg,
      'g': product.price_per_gram,
      'gram': product.price_per_gram,
      'lb': product.price_per_lb,
      'case': product.price_per_case,
      'pcs': product.price_per_piece,
      'piece': product.price_per_piece,
    };
    return unitPriceMap[unit] ?? product.price_xcg;
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any, autoFocusQuantity = false) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-fill price and unit when product selected
    if (field === 'productId') {
      const product = products?.find((p: any) => p.id === value);
      if (product) {
        newItems[index].unit = product.unit || 'pcs';
        const unitPrice = getUnitPrice(product, newItems[index].unit);
        newItems[index].unitPrice = unitPrice;
        newItems[index].total = unitPrice * newItems[index].quantity;
      }
      
      // Auto-add new blank row when selecting product on last item
      if (value && index === newItems.length - 1) {
        newItems.push({ productId: '', quantity: 1, unit: 'pcs', unitPrice: 0, total: 0 });
      }
      
      // Auto-focus quantity after product selection
      if (autoFocusQuantity && value) {
        focusQuantity(index);
      }
    }

    // Auto-update price when unit changes
    if (field === 'unit') {
      const product = products?.find((p: any) => p.id === newItems[index].productId);
      if (product) {
        const newPrice = getUnitPrice(product, value);
        newItems[index].unitPrice = newPrice;
        newItems[index].total = newPrice * newItems[index].quantity;
      }
    }

    // Recalculate total when quantity changes
    if (field === 'quantity') {
      newItems[index].total = newItems[index].unitPrice * value;
    }

    // Recalculate total when price changes
    if (field === 'unitPrice') {
      newItems[index].total = value * newItems[index].quantity;
    }

    setItems(newItems);
  };

  const orderTotal = items.reduce((sum, item) => sum + item.total, 0);

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      // Filter out empty items before validation
      const validItems = items.filter(item => item.productId);
      
      if (!customerId) throw new Error('Please select a customer');
      if (validItems.length === 0) throw new Error('Please add at least one item');
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

      // Create order items (use validItems to exclude empty rows)
      const orderItems = validItems.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price_xcg: item.unitPrice,
        total_xcg: item.total,
        order_unit: item.unit,
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
      setItems([{ productId: '', quantity: 1, unit: 'pcs', unitPrice: 0, total: 0 }]);
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
      // Filter out empty items before validation
      const validItems = items.filter(item => item.productId);
      
      if (!orderId) throw new Error('No order ID');
      if (!customerId) throw new Error('Please select a customer');
      if (validItems.length === 0) throw new Error('Please add at least one item');
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

      // Insert new items (use validItems to exclude empty rows)
      const orderItems = validItems.map((item) => ({
        order_id: orderId,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price_xcg: item.unitPrice,
        total_xcg: item.total,
        order_unit: item.unit,
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

  // PO Import handlers
  const handlePOFileSelected = async (file: File) => {
    const extracted = await poImport.parseFile(file);
    if (extracted) {
      setShowPOUpload(false);
      // Match products
      if (products) {
        await poImport.matchProducts(extracted.items, poImport.selectedCustomerId, products);
      }
      setShowPOReview(true);
    }
  };

  const handlePOConfirm = async () => {
    const validItems = poImport.matchedItems.filter(i => i.matched_product_id);
    if (validItems.length === 0) return;

    // Save mappings
    if (poImport.selectedCustomerId) {
      await poImport.saveMappings(poImport.selectedCustomerId, poImport.matchedItems);
    }

    // Set customer and delivery date
    setCustomerId(poImport.selectedCustomerId);
    setDeliveryDate(poImport.selectedDeliveryDate || deliveryDate);

    // Convert to order items
    const newItems: OrderItem[] = validItems.map(item => {
      const product = products?.find(p => p.id === item.matched_product_id);
      const unitPrice = item.unit_price ?? product?.price_xcg ?? 0;
      return {
        productId: item.matched_product_id!,
        quantity: item.quantity,
        unit: item.unit || product?.unit || 'pcs',
        unitPrice,
        total: unitPrice * item.quantity,
      };
    });

    // Add empty row at end
    newItems.push({ productId: '', quantity: 1, unit: 'pcs', unitPrice: 0, total: 0 });

    setItems(newItems);
    setShowPOReview(false);
    poImport.reset();
    toast.success(`Imported ${validItems.length} items from PO`);
  };

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
          {!isEditMode && (
            <Button
              variant="outline"
              onClick={() => setShowPOUpload(true)}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Import from PO
            </Button>
          )}
        </div>

        {/* PO Import Dialogs */}
        <POUploadDialog
          open={showPOUpload}
          onOpenChange={setShowPOUpload}
          onFileSelected={handlePOFileSelected}
          isUploading={poImport.isUploading}
          isParsing={poImport.isParsing}
        />
        
        {poImport.extractedData && (
          <POReviewDialog
            open={showPOReview}
            onOpenChange={setShowPOReview}
            extractedData={poImport.extractedData}
            matchedItems={poImport.matchedItems}
            customers={customers || []}
            products={products || []}
            selectedCustomerId={poImport.selectedCustomerId}
            selectedDeliveryDate={poImport.selectedDeliveryDate}
            onCustomerChange={(id) => {
              poImport.setSelectedCustomerId(id);
              // Re-match products when customer changes
              if (poImport.extractedData && products) {
                poImport.matchProducts(poImport.extractedData.items, id, products);
              }
            }}
            onDeliveryDateChange={poImport.setSelectedDeliveryDate}
            onUpdateItem={poImport.updateMatchedItem}
            onRemoveItem={poImport.removeMatchedItem}
            onConfirm={handlePOConfirm}
            onCancel={() => {
              setShowPOReview(false);
              poImport.reset();
            }}
          />
        )}

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

            {/* Smart Suggestions */}
            {customerId && suggestions.length > 0 && (
              <Collapsible open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
                <Card className="border-dashed border-primary/30 bg-primary/5">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm font-medium">
                            Quick Add ({suggestions.length} suggestions)
                          </CardTitle>
                          {suggestionsOpen ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            suggestions.forEach(s => addSuggestionToOrder(s));
                            toast.success(`Added ${suggestions.length} items`);
                          }}
                          className="text-xs h-7"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add All
                        </Button>
                        {lastOrderSuggestions.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              lastOrderSuggestions.forEach(s => addSuggestionToOrder(s));
                              toast.success('Loaded items from last order');
                            }}
                            className="text-xs h-7"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Copy Last
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-3">
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((suggestion) => {
                          const isInOrder = items.some(item => item.productId === suggestion.productId);
                          return (
                            <Button
                              key={suggestion.productId}
                              variant={isInOrder ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => {
                                if (isInOrder) {
                                  // Flash the existing row
                                  const idx = items.findIndex(i => i.productId === suggestion.productId);
                                  if (idx >= 0) {
                                    quantityRefs.current[idx]?.focus();
                                    quantityRefs.current[idx]?.select();
                                  }
                                  toast.info(`${suggestion.productName} already in order`);
                                } else {
                                  addSuggestionToOrder(suggestion);
                                  toast.success(`Added ${suggestion.productName}`);
                                }
                              }}
                              className={`text-xs h-8 ${isInOrder ? 'opacity-60' : ''}`}
                            >
                              {suggestion.source === 'standing' && (
                                <Calendar className="h-3 w-3 mr-1 text-primary" />
                              )}
                              {suggestion.source === 'pattern' && (
                                <Sparkles className="h-3 w-3 mr-1 text-amber-500" />
                              )}
                              <span>{suggestion.productName}</span>
                              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">
                                {suggestion.avgQuantity} {suggestion.suggestedUnit}
                              </Badge>
                              {!isInOrder && <Plus className="h-3 w-3 ml-1" />}
                            </Button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

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
                        <div className="flex-1 flex items-center gap-1">
                          <SearchableSelect
                            options={products?.map((p: any) => ({
                              value: p.id,
                              label: `${p.name} (${p.code}) - ${p.price_xcg} XCG/${p.unit}`,
                              searchTerms: `${p.name} ${p.code}`,
                            })) || []}
                            value={item.productId}
                            onValueChange={(v) => handleProductChange(index, v, true)}
                            placeholder="Select product"
                            emptyMessage="No products found"
                            addNewLabel="Add New Product"
                            onAddNew={() => handleAddNewProduct(index)}
                            addNewIcon={<Package className="mr-2 h-4 w-4" />}
                            triggerRef={(el) => { productSelectRefs.current[index] = el; }}
                            onSelectComplete={() => focusQuantity(index)}
                          />
                          {item.productId && (() => {
                            const product = products?.find((p: any) => p.id === item.productId);
                            if (!product) return null;
                            const hasInfo = product.items_per_case || product.case_weight_kg || product.product_description || 
                              product.price_per_kg || product.price_per_lb || product.price_per_case || product.price_per_piece;
                            if (!hasInfo) return null;
                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                      <Info className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs">
                                    <div className="space-y-1 text-sm">
                                      <p className="font-medium">{product.name}</p>
                                      {product.product_description && (
                                        <p className="text-xs text-muted-foreground">{product.product_description}</p>
                                      )}
                                      {(product.items_per_case || product.case_weight_kg) && (
                                        <div className="border-t pt-1 mt-1">
                                          {product.items_per_case && <p>Items/Case: {product.items_per_case}</p>}
                                          {product.case_weight_kg && <p>Case Weight: {product.case_weight_kg} kg</p>}
                                        </div>
                                      )}
                                      {(product.price_per_kg || product.price_per_lb || product.price_per_case || product.price_per_piece) && (
                                        <div className="border-t pt-1 mt-1">
                                          <p className="font-medium text-xs">Unit Prices:</p>
                                          {product.price_per_piece && <p>Per Piece: {product.price_per_piece} XCG</p>}
                                          {product.price_per_kg && <p>Per Kg: {product.price_per_kg} XCG</p>}
                                          {product.price_per_lb && <p>Per Lb: {product.price_per_lb} XCG</p>}
                                          {product.price_per_case && <p>Per Case: {product.price_per_case} XCG</p>}
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
                        </div>
                        <div className="w-20">
                          <Input
                            ref={(el) => { quantityRefs.current[index] = el; }}
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(index, 'quantity', Number(e.target.value))
                            }
                            onKeyDown={(e) => handleInputKeyDown(e, index, 'quantity')}
                            placeholder="Qty"
                          />
                        </div>
                        <div className="w-20">
                          <Select
                            value={item.unit}
                            onValueChange={(v) => updateItem(index, 'unit', v)}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                            <SelectContent>
                              {UNITS.map((u) => (
                                <SelectItem key={u.value} value={u.value}>
                                  {u.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-24">
                          <Input
                            ref={(el) => { priceRefs.current[index] = el; }}
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateItem(index, 'unitPrice', Number(e.target.value))
                            }
                            onKeyDown={(e) => handleInputKeyDown(e, index, 'price')}
                            placeholder="Price"
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
