import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardPaste, Check, Loader2, MessageSquare, Calendar as CalendarIcon, User, MessageCircle, RotateCcw, ExternalLink, Brain, Sparkles, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { MobileProductCard } from '@/components/mobile/MobileProductCard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useConversationImport } from '@/hooks/useConversationImport';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { openWhatsApp, generateOrderConfirmation, vibrateSuccess, vibrateTap, openWhatsAppGeneral } from '@/utils/whatsappUtils';

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
  const [clipboardContent, setClipboardContent] = useState<string | null>(null);
  const [clipboardChecked, setClipboardChecked] = useState(false);
  const [correctionsCount, setCorrectionsCount] = useState(0);

  // Check clipboard on mount (without auto-pasting)
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        if (navigator.clipboard?.readText) {
          const text = await navigator.clipboard.readText();
          if (text?.trim().length > 10) {
            setClipboardContent(text);
          }
        }
      } catch (e) {
        // Clipboard access denied - user will paste manually
      }
      setClipboardChecked(true);
    };
    
    const timer = setTimeout(checkClipboard, 100);
    return () => clearTimeout(timer);
  }, []);

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
    parseStage,
    matchedItems,
    parsedData,
    learnedCount,
    parseConversation,
    updateMatchedItem,
    removeMatchedItem,
    saveMappings,
    reset
  } = useConversationImport();

  const handlePasteFromClipboard = async () => {
    vibrateTap();
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text.trim()) {
          setConversationText(text);
          toast.success('Pasted from clipboard');
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
    vibrateTap();
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

      const orderNumber = `FNB-${Date.now()}`;
      const total = validItems.reduce((sum, item) => {
        return sum + (item.quantity * (item.suggested_price || 0));
      }, 0);

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

      await supabase
        .from('fnb_picker_queue')
        .insert({
          order_id: order.id,
          status: 'pending',
          priority: 0
        });

      return order;
    },
    onSuccess: async (order) => {
      vibrateSuccess();
      
      let corrections = 0;
      if (customerId) {
        corrections = await saveMappings(customerId, order.id) || 0;
        setCorrectionsCount(corrections);
        localStorage.setItem('fuik_last_order_customer', customerId);
      }
      
      setCreatedOrderNumber(order.order_number);
      setStep('success');
      queryClient.invalidateQueries({ queryKey: ['fnb-orders'] });
      queryClient.invalidateQueries({ queryKey: ['ai-training-stats'] });
      
      if (corrections > 0) {
        toast.success(`Order created! AI learned ${corrections} new term${corrections > 1 ? 's' : ''}`);
      } else {
        toast.success('Order created successfully!');
      }
    },
    onError: (error) => {
      toast.error(`Failed to create order: ${error.message}`);
    }
  });

  const handleCreateOrder = () => {
    vibrateTap();
    createOrderMutation.mutate();
  };

  const handlePasteAnother = () => {
    vibrateTap();
    setConversationText('');
    setStep('paste');
    setCreatedOrderNumber(null);
    setClipboardContent(null);
    setClipboardChecked(false);
    setCorrectionsCount(0);
    reset();
  };

  const handleReplyWhatsApp = () => {
    vibrateTap();
    const customer = customers.find(c => c.id === customerId);
    
    if (customer?.whatsapp_phone && createdOrderNumber) {
      const message = generateOrderConfirmation(
        createdOrderNumber,
        customer.name,
        format(new Date(deliveryDate), 'MMM d, yyyy'),
        validItemsCount,
        totalAmount
      );
      openWhatsApp(customer.whatsapp_phone, message);
    } else {
      openWhatsAppGeneral();
    }
  };

  const handleBackToWhatsApp = () => {
    vibrateTap();
    openWhatsAppGeneral();
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
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">Quick Order</h1>
            <p className="text-xs text-muted-foreground truncate">
              {step === 'paste' && (clipboardContent ? '📋 Clipboard ready!' : 'Paste WhatsApp order')}
              {step === 'review' && `${validItemsCount} items to review`}
              {step === 'success' && 'Order created!'}
            </p>
          </div>
          {step === 'paste' && (
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleBackToWhatsApp}
              className="shrink-0"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto pb-safe">
        {/* STEP 1: Paste */}
        {step === 'paste' && (
          <div className="p-4 space-y-4">
            {/* Customer Selection - Full width, stacked */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Customer
                </label>
                <SearchableSelect
                  options={customers.map(c => ({ value: c.id, label: c.name }))}
                  value={customerId || ''}
                  onValueChange={(val) => {
                    vibrateTap();
                    setCustomerId(val);
                  }}
                  placeholder="Select customer..."
                  className="w-full"
                />
                
                {/* Recent customers - horizontal scroll chips */}
                {recentCustomers.length > 0 && !customerId && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Recent:</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                      {recentCustomers.map(c => (
                        <Button
                          key={c.id}
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs shrink-0"
                          onClick={() => {
                            vibrateTap();
                            setCustomerId(c.id);
                          }}
                        >
                          {c.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Clipboard Ready Card - One-tap paste & parse */}
            {clipboardChecked && clipboardContent && (
              <Card 
                className="border-primary/50 bg-primary/5 cursor-pointer active:scale-[0.98] transition-transform touch-manipulation"
                onClick={async () => {
                  if (!customerId) {
                    toast.error('Please select a customer first');
                    return;
                  }
                  vibrateTap();
                  setConversationText(clipboardContent);
                  await parseConversation(clipboardContent, products, customerId);
                  setStep('review');
                }}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ClipboardPaste className="h-5 w-5 text-primary shrink-0" />
                    <span className="font-medium text-primary">Clipboard Ready</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {clipboardContent.substring(0, 100)}...
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {clipboardContent.split('\n').filter(l => l.trim()).length} lines detected
                    </span>
                    <Badge variant="default" className="shrink-0">
                      {customerId ? 'Tap to Paste & Parse' : 'Select customer first'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Alternative: Manual Paste Button */}
            {(!clipboardContent || !clipboardChecked) && (
              <Button
                onClick={handlePasteFromClipboard}
                className="w-full h-28 text-lg flex-col gap-2"
                size="lg"
              >
                <ClipboardPaste className="h-8 w-8" />
                <span>Paste from Clipboard</span>
              </Button>
            )}

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or paste manually
                </span>
              </div>
            </div>

            {/* Manual Textarea - Full width */}
            <Textarea
              placeholder="Paste WhatsApp conversation here...&#10;&#10;Example:&#10;5 kg tomaat&#10;3 tros banana&#10;10 komkommer"
              value={conversationText}
              onChange={(e) => setConversationText(e.target.value)}
              className="min-h-[140px] text-base w-full"
            />

            {/* Parse Button - Full width, large touch target */}
            <Button
              onClick={handleParse}
              disabled={!conversationText.trim() || !customerId || isParsing}
              className="w-full h-14 text-lg"
              size="lg"
            >
              {isParsing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {parseStage || 'Parsing...'}
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

        {/* STEP 2: Review - Vertical stacked cards */}
        {step === 'review' && (
          <div className="flex flex-col h-full">
            {/* Order Summary - Sticky */}
            <div className="sticky top-0 z-10 bg-background border-b p-4 space-y-2">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium truncate">{selectedCustomer?.name}</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Badge variant="outline" className="shrink-0 cursor-pointer hover:bg-accent transition-colors">
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {format(new Date(deliveryDate), 'MMM d')}
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Badge>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <div className="flex gap-1 p-2 border-b">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setDeliveryDate(format(new Date(), 'yyyy-MM-dd'))}
                          >
                            Today
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setDeliveryDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
                          >
                            Tomorrow
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setDeliveryDate(format(addDays(new Date(), 2), 'yyyy-MM-dd'))}
                          >
                            {format(addDays(new Date(), 2), 'EEE')}
                          </Button>
                        </div>
                        <Calendar
                          mode="single"
                          selected={new Date(deliveryDate)}
                          onSelect={(date) => date && setDeliveryDate(format(date, 'yyyy-MM-dd'))}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{validItemsCount} items</span>
                    <span className="font-semibold text-foreground">
                      ƒ{totalAmount.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
              
              {/* AI Learning Status */}
              {learnedCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>AI recognized {learnedCount} items from learned patterns</span>
                </div>
              )}
            </div>

            {/* Items List - Scrollable, vertical only */}
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 py-4">
                {matchedItems.map((item, index) => (
                  <MobileProductCard
                    key={index}
                    rawText={item.raw_text}
                    quantity={item.quantity}
                    unit={item.unit || 'pcs'}
                    matchedProductId={item.matched_product_id}
                    matchSource={item.match_source}
                    suggestedPrice={item.suggested_price}
                    products={products}
                    onQuantityChange={(qty) => updateMatchedItem(index, { quantity: qty })}
                    onProductChange={(id, name, price) => updateMatchedItem(index, {
                      matched_product_id: id,
                      matched_product_name: name,
                      suggested_price: price
                    })}
                    onRemove={() => removeMatchedItem(index)}
                  />
                ))}
              </div>
            </ScrollArea>

            {/* Action Buttons - Fixed at bottom */}
            <div className="sticky bottom-0 bg-background border-t p-4 space-y-2 pb-safe">
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
                    Create Order ({validItemsCount})
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  vibrateTap();
                  setStep('paste');
                }}
                className="w-full"
              >
                ← Back
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Success */}
        {step === 'success' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
              <Check className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Order Created!</h2>
            <p className="text-muted-foreground mb-1">#{createdOrderNumber}</p>
            <p className="text-muted-foreground mb-4">
              {selectedCustomer?.name} • {validItemsCount} items
            </p>
            
            {/* AI Learning Feedback */}
            {correctionsCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 rounded-full px-4 py-2 mb-6">
                <Brain className="h-4 w-4" />
                <span>AI learned {correctionsCount} new term{correctionsCount > 1 ? 's' : ''} from your corrections</span>
              </div>
            )}

            <div className="space-y-3 w-full max-w-xs">
              <Button
                onClick={handleReplyWhatsApp}
                className="w-full h-14 text-lg gap-2 bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <MessageCircle className="h-5 w-5" />
                Reply on WhatsApp
              </Button>

              <Button
                onClick={handlePasteAnother}
                variant="outline"
                className="w-full h-12 gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Paste Another Order
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  vibrateTap();
                  navigate('/distribution/orders');
                }}
                className="w-full gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View Orders
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
