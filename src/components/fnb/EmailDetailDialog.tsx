import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Mail,
  User,
  Calendar as CalendarIcon,
  Package,
  CheckCircle,
  XCircle,
  Loader2,
  Paperclip,
  Send,
  AlertTriangle,
  Trash2,
  Plus,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ResponsiveSearchableSelect } from '@/components/ui/responsive-searchable-select';

interface EmailDetailDialogProps {
  email: {
    id: string;
    message_id: string;
    from_email: string;
    from_name: string | null;
    subject: string;
    body_text: string | null;
    body_html: string | null;
    received_at: string;
    status: string;
    matched_customer_id: string | null;
    linked_order_id: string | null;
    extracted_data: any;
    extraction_confidence: number | null;
    error_message: string | null;
  };
  open: boolean;
  onClose: () => void;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  confidence?: string;
}

export function EmailDetailDialog({ email, open, onClose }: EmailDetailDialogProps) {
  const queryClient = useQueryClient();
  
  // Form state
  const [customerId, setCustomerId] = useState<string>(email.matched_customer_id || '');
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(
    email.extracted_data?.delivery_date ? parseISO(email.extracted_data.delivery_date) : undefined
  );
  const [poNumber, setPoNumber] = useState<string>(email.extracted_data?.po_number || '');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['distribution-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_customers')
        .select('id, name, whatsapp_phone')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['distribution-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_products')
        .select('id, name, code, unit')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch attachments
  const { data: attachments = [] } = useQuery({
    queryKey: ['email-attachments', email.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_inbox_attachments')
        .select('*')
        .eq('email_id', email.id);
      if (error) throw error;
      return data;
    },
  });

  // Initialize order items from extracted data
  useEffect(() => {
    if (email.extracted_data?.items) {
      setOrderItems(
        email.extracted_data.items.map((item: any) => ({
          product_id: item.product_id || '',
          product_name: item.product_name || item.matched_product_name || '',
          quantity: item.quantity || 0,
          unit: item.unit || 'cs',
          unit_price: item.unit_price || 0,
          confidence: item.confidence,
        }))
      );
    }
  }, [email.extracted_data]);

  // Confirm order mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error('Please select a customer');
      if (orderItems.length === 0) throw new Error('Please add at least one item');

      setIsProcessing(true);

      // Calculate totals
      const orderItemsWithTotals = orderItems.map(item => {
        return {
          product_id: item.product_id,
          quantity: item.quantity,
          order_unit: item.unit,
          unit_price_xcg: item.unit_price,
          total_xcg: item.quantity * item.unit_price,
        };
      });

      const totalXcg = orderItemsWithTotals.reduce((sum, item) => sum + item.total_xcg, 0);

      // Create or update order
      let orderId = email.linked_order_id;

      if (!orderId) {
        // Generate order number
        const orderNumber = `EM-${Date.now().toString(36).toUpperCase()}`;

        const { data: newOrder, error: orderError } = await supabase
          .from('distribution_orders')
          .insert({
            order_number: orderNumber,
            customer_id: customerId,
            order_date: format(new Date(), 'yyyy-MM-dd'),
            delivery_date: deliveryDate ? format(deliveryDate, 'yyyy-MM-dd') : null,
            po_number: poNumber || null,
            status: 'confirmed',
            source_email_id: email.id,
            notes: `Confirmed from email: ${email.subject}`,
            total_xcg: totalXcg,
          })
          .select()
          .single();

        if (orderError) throw orderError;
        orderId = newOrder.id;
      } else {
        // Update existing order
        const { error: updateError } = await supabase
          .from('distribution_orders')
          .update({
            customer_id: customerId,
            delivery_date: deliveryDate ? format(deliveryDate, 'yyyy-MM-dd') : null,
            po_number: poNumber || null,
            status: 'confirmed',
            total_xcg: totalXcg,
          })
          .eq('id', orderId);

        if (updateError) throw updateError;

        // Delete existing items
        await supabase
          .from('distribution_order_items')
          .delete()
          .eq('order_id', orderId);
      }

      // Insert order items
      const { error: itemsError } = await supabase
        .from('distribution_order_items')
        .insert(
          orderItemsWithTotals.map(item => ({
            order_id: orderId,
            ...item,
          }))
        );

      if (itemsError) throw itemsError;

      // Update email status
      const { error: emailError } = await supabase
        .from('email_inbox')
        .update({
          status: 'confirmed',
          linked_order_id: orderId,
          matched_customer_id: customerId,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', email.id);

      if (emailError) throw emailError;

      // Send confirmation email
      try {
        await supabase.functions.invoke('send-order-confirmation', {
          body: { orderId, emailId: email.id },
        });
      } catch (e) {
        console.error('Failed to send confirmation email:', e);
        // Don't fail the whole operation
      }

      return orderId;
    },
    onSuccess: () => {
      toast.success('Order confirmed and confirmation sent!');
      queryClient.invalidateQueries({ queryKey: ['email-inbox'] });
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setIsProcessing(false);
    },
  });

  // Decline mutation
  const declineMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('email_inbox')
        .update({
          status: 'declined',
          declined_at: new Date().toISOString(),
        })
        .eq('id', email.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Email declined');
      queryClient.invalidateQueries({ queryKey: ['email-inbox'] });
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const addOrderItem = () => {
    setOrderItems([
      ...orderItems,
      { product_id: '', product_name: '', quantity: 1, unit: 'cs', unit_price: 0 },
    ]);
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: any) => {
    const updated = [...orderItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // If product changed, update name
    if (field === 'product_id') {
      const product = products.find((p: any) => p.id === value);
      if (product) {
        updated[index].product_name = (product as any).name;
        updated[index].unit = (product as any).unit || 'cs';
      }
    }
    
    setOrderItems(updated);
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const customerOptions = customers.map(c => ({
    value: c.id,
    label: c.name,
  }));

  const productOptions = products.map((p: any) => ({
    value: p.id,
    label: `${p.code} - ${p.name}`,
  }));

  const confidence = email.extraction_confidence 
    ? Math.round(email.extraction_confidence * 100) 
    : null;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {email.subject}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="order" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="order">Order Details</TabsTrigger>
            <TabsTrigger value="email">Original Email</TabsTrigger>
          </TabsList>

          <TabsContent value="order" className="flex-1 overflow-auto space-y-4 mt-4">
            {email.status === 'error' && email.error_message && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{email.error_message}</span>
              </div>
            )}

            {confidence !== null && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Extraction Confidence:</span>
                <Badge variant={confidence >= 80 ? "default" : confidence >= 50 ? "secondary" : "destructive"}>
                  {confidence}%
                </Badge>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <ResponsiveSearchableSelect
                  options={customerOptions}
                  value={customerId}
                  onValueChange={setCustomerId}
                  placeholder="Select customer..."
                />
              </div>

              <div className="space-y-2">
                <Label>Delivery Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !deliveryDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deliveryDate ? format(deliveryDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={deliveryDate}
                      onSelect={setDeliveryDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>PO Number</Label>
              <Input
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="Optional PO number"
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Order Items
                </h3>
                <Button size="sm" variant="outline" onClick={addOrderItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Product</TableHead>
                    <TableHead className="w-[15%]">Qty</TableHead>
                    <TableHead className="w-[15%]">Unit</TableHead>
                    <TableHead className="w-[15%]">Price</TableHead>
                    <TableHead className="w-[15%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <ResponsiveSearchableSelect
                          options={productOptions}
                          value={item.product_id}
                          onValueChange={(value) => updateOrderItem(index, 'product_id', value)}
                          placeholder="Select product..."
                        />
                        {item.confidence && item.confidence !== 'high' && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            {item.confidence} confidence
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateOrderItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.unit}
                          onValueChange={(value) => updateOrderItem(index, 'unit', value)}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cs">cs</SelectItem>
                            <SelectItem value="lb">lb</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="ea">ea</SelectItem>
                            <SelectItem value="pc">pc</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateOrderItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeOrderItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {orderItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No items yet. Click "Add Item" to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {orderItems.length > 0 && (
                <div className="flex justify-end">
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground">Total: </span>
                    <span className="font-semibold">
                      ${orderItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {attachments.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Attachments ({attachments.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att: any) => (
                      <Badge key={att.id} variant="secondary">
                        {att.file_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="email" className="flex-1 overflow-auto mt-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{email.from_name || email.from_email}</p>
                    <p className="text-sm text-muted-foreground">{email.from_email}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(email.received_at), 'PPpp')}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {email.body_html ? (
                    <div 
                      className="prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: email.body_html }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                      {email.body_text}
                    </pre>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4 border-t mt-4">
          <Button
            variant="outline"
            onClick={() => declineMutation.mutate()}
            disabled={isProcessing || email.status === 'confirmed' || email.status === 'declined'}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Decline
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmMutation.mutate()}
              disabled={isProcessing || email.status === 'confirmed'}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Confirm & Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
