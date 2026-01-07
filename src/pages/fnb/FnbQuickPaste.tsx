import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardPaste, Check, Loader2, MessageSquare, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useConversationImport } from '@/hooks/useConversationImport';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';

interface Product {
  id: string;
  code: string;
  name: string;
  name_pap?: string | null;
  name_nl?: string | null;
  name_es?: string | null;
  price_xcg: number;
  unit: string;
}

export default function FnbQuickPaste() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [conversationText, setConversationText] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [step, setStep] = useState<'paste' | 'review' | 'success'>('paste');
  const [deliveryDate, setDeliveryDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string | null>(null);

  // Load last used customer from localStorage
  useEffect(() => {
    const lastCustomer = localStorage.getItem('fuik_last_order_customer');
    if (lastCustomer && !customerId) {
      setCustomerId(lastCustomer);
    }
  }, []);

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['fnb-products-quick'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_products')
        .select('id, code, name, name_pap, name_nl, name_es, price_xcg, unit')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Product[];
    }
  });

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['fnb-customers-quick'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_customers')
        .select('id, name, whatsapp_phone')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch recent customers (from recent orders)
  const { data: recentCustomers = [] } = useQuery({
    queryKey: ['recent-order-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_orders')
        .select('customer_id, fnb_customers(id, name)')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      
      // Dedupe and take top 5
      const seen = new Set();
      const unique: { id: string; name: string }[] = [];
      for (const order of data || []) {
        if (order.fnb_customers && !seen.has(order.customer_id)) {
          seen.add(order.customer_id);
          unique.push(order.fnb_customers as { id: string; name: string });
          if (unique.length >= 5) break;
        }
      }
      return unique;
    }
  });

  const {
    isParsing,
    matchedItems,
    parsedData,
    parseConversation,
    updateMatchedItem,
    saveMappings,
    reset
  } = useConversationImport();

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text.trim()) {
          setConversationText(text);
          toast.success('Pasted from clipboard');
          // Auto-parse if we have customer selected
          if (customerId && text.length > 5) {
            await parseConversation(text, products, customerId);
            setStep('review');
          }
        } else {
          toast.info('Clipboard is empty');
        }
      }
    } catch (err) {
      toast.error('Could not read clipboard. Please paste manually.');
    }
  };

  const handleParse = async () => {
    if (!customerId) {
      toast.error('Please select a customer first');
      return;
    }
    if (!conversationText.trim()) {
      toast.error('Please paste the WhatsApp conversation');
      return;
    }
    await parseConversation(conversationText, products, customerId);
    setStep('review');
  };

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const validItems = matchedItems.filter(item => item.matched_product_id && item.quantity > 0);
      
      if (validItems.length === 0) {
        throw new Error('No valid items to create order');
      }

      // Generate order number
      const orderNumber = `FNB-${Date.now()}`;
      
      // Calculate total
      const total = validItems.reduce((sum, item) => {
        return sum + (item.quantity * (item.suggested_price || 0));
      }, 0);

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('fnb_orders')
        .insert({
          order_number: orderNumber,
          customer_id: customerId,
          order_date: new Date().toISOString().split('T')[0],
          delivery_date: deliveryDate,
          status: 'pending',
          total_xcg: total,
          notes: `Imported from WhatsApp`
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = validItems.map(item => ({
        order_id: order.id,
        product_id: item.matched_product_id,
        quantity: item.quantity,
        unit_price_xcg: item.suggested_price || 0,
        total_xcg: item.quantity * (item.suggested_price || 0)
      }));

      const { error: itemsError } = await supabase
        .from('fnb_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Add to picker queue
      await supabase
        .from('fnb_picker_queue')
        .insert({
          order_id: order.id,
          status: 'pending',
          priority: 0
        });

      return order;
    },
    onSuccess: (order) => {
      // Save learned mappings
      if (customerId) {
        saveMappings(customerId);
      }
      
      // Remember customer for next time
      if (customerId) {
        localStorage.setItem('fuik_last_order_customer', customerId);
      }
      
      setCreatedOrderNumber(order.order_number);
      setStep('success');
      queryClient.invalidateQueries({ queryKey: ['fnb-orders'] });
      toast.success('Order created successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to create order: ${error.message}`);
    }
  });

  const handleCreateOrder = () => {
    createOrderMutation.mutate();
  };

  const handlePasteAnother = () => {
    setConversationText('');
    setStep('paste');
    setCreatedOrderNumber(null);
    reset();
  };

  const getConfidenceBadge = (matchSource: string, confidence: string) => {
    if (matchSource === 'verified') {
      return <Badge className="bg-green-500/10 text-green-500 text-xs">Verified</Badge>;
    }
    if (matchSource === 'customer_mapping') {
      return <Badge className="bg-blue-500/10 text-blue-500 text-xs">Learned</Badge>;
    }
    if (matchSource === 'ai_match') {
      return <Badge className="bg-purple-500/10 text-purple-500 text-xs">AI Match</Badge>;
    }
    if (matchSource === 'product_name') {
      return <Badge className="bg-amber-500/10 text-amber-500 text-xs">Name Match</Badge>;
    }
    return <Badge variant="destructive" className="text-xs">Review</Badge>;
  };

  const validItemsCount = matchedItems.filter(item => item.matched_product_id && item.quantity > 0).length;
  const totalAmount = matchedItems.reduce((sum, item) => {
    if (!item.matched_product_id) return sum;
    return sum + (item.quantity * (item.suggested_price || 0));
  }, 0);

  const selectedCustomer = customers.find(c => c.id === customerId);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b px-4 py-3 safe-area-top">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-semibold">Quick Order</h1>
            <p className="text-xs text-muted-foreground">
              {step === 'paste' && 'Paste WhatsApp order'}
              {step === 'review' && `${validItemsCount} items to review`}
              {step === 'success' && 'Order created!'}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-24">
        {/* STEP 1: Paste */}
        {step === 'paste' && (
          <div className="space-y-4">
            {/* Customer Selection */}
            <Card>
              <CardContent className="p-4">
                <label className="text-sm font-medium mb-2 block">
                  <User className="inline h-4 w-4 mr-1" />
                  Customer
                </label>
                <SearchableSelect
                  options={customers.map(c => ({ value: c.id, label: c.name }))}
                  value={customerId || ''}
                  onValueChange={setCustomerId}
                  placeholder="Select customer..."
                />
                
                {/* Recent customers chips */}
                {recentCustomers.length > 0 && !customerId && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-2">Recent:</p>
                    <div className="flex flex-wrap gap-2">
                      {recentCustomers.map(c => (
                        <Button
                          key={c.id}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setCustomerId(c.id)}
                        >
                          {c.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Big Paste Button */}
            <Button
              onClick={handlePasteFromClipboard}
              className="w-full h-32 text-lg flex-col gap-2"
              size="lg"
            >
              <ClipboardPaste className="h-10 w-10" />
              <span>Tap to Paste from Clipboard</span>
            </Button>

            {/* Or divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or paste manually
                </span>
              </div>
            </div>

            {/* Manual Textarea */}
            <Textarea
              placeholder="Paste WhatsApp conversation here...&#10;&#10;Example:&#10;5 kg tomaat&#10;3 tros banana&#10;10 komkommer"
              value={conversationText}
              onChange={(e) => setConversationText(e.target.value)}
              className="min-h-[150px] text-base"
              autoFocus
            />

            {/* Parse Button */}
            <Button
              onClick={handleParse}
              disabled={!conversationText.trim() || !customerId || isParsing}
              className="w-full h-14 text-lg"
              size="lg"
            >
              {isParsing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Parse Order
                </>
              )}
            </Button>
          </div>
        )}

        {/* STEP 2: Review */}
        {step === 'review' && (
          <div className="space-y-4">
            {/* Order Summary */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{selectedCustomer?.name}</span>
                  <Badge variant="outline">
                    <Calendar className="h-3 w-3 mr-1" />
                    {format(new Date(deliveryDate), 'MMM d')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{validItemsCount} items</span>
                  <span className="font-semibold text-foreground">
                    {totalAmount.toFixed(2)} XCG
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Items List */}
            <ScrollArea className="h-[calc(100vh-350px)]">
              <div className="space-y-3">
                {matchedItems.map((item, index) => (
                  <Card key={index} className={!item.matched_product_id ? 'border-destructive/50' : ''}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm text-muted-foreground italic">
                          "{item.raw_text}"
                        </span>
                        {getConfidenceBadge(item.match_source, item.confidence)}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            updateMatchedItem(index, { quantity: parseFloat(e.target.value) || 0 });
                          }}
                          className="w-16 h-9 text-center border rounded-md bg-background"
                          min="0"
                          step="0.5"
                        />
                        <span className="text-sm text-muted-foreground">
                          {item.unit || 'pcs'}
                        </span>
                        <div className="flex-1">
                          <SearchableSelect
                            options={products.map(p => ({ 
                              value: p.id, 
                              label: `${p.code} - ${p.name}` 
                            }))}
                            value={item.matched_product_id || ''}
                            onValueChange={(value) => {
                              const product = products.find(p => p.id === value);
                              updateMatchedItem(index, { 
                                matched_product_id: value,
                                matched_product_name: product?.name || null,
                                suggested_price: product?.price_xcg || null
                              });
                            }}
                            placeholder="Select product..."
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <Button
                onClick={handleCreateOrder}
                disabled={validItemsCount === 0 || createOrderMutation.isPending}
                className="w-full h-14 text-lg"
                size="lg"
              >
                {createOrderMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5 mr-2" />
                    Create Order ({validItemsCount} items)
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep('paste')}
                className="w-full"
              >
                ← Back to Paste
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Success */}
        {step === 'success' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
              <Check className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Order Created!</h2>
            <p className="text-muted-foreground mb-1">#{createdOrderNumber}</p>
            <p className="text-muted-foreground mb-8">
              {selectedCustomer?.name} • {validItemsCount} items
            </p>

            <div className="space-y-3 w-full max-w-xs">
              <Button
                onClick={handlePasteAnother}
                className="w-full h-14 text-lg"
                size="lg"
              >
                <ClipboardPaste className="h-5 w-5 mr-2" />
                Paste Another Order
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/distribution/orders')}
                className="w-full"
              >
                View All Orders
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate('/distribution')}
                className="w-full"
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
