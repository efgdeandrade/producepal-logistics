import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Info, Plus, Trash2 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-muted text-intake-text-muted',
  parsed: 'bg-intake-info text-white',
  manual_review: 'bg-intake-warning text-white',
  failed: 'bg-intake-danger text-white',
  approved: 'bg-intake-brand text-white',
  confirmed: 'bg-intake-brand text-white',
};

export default function IntakeEmailPO() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [slideOpen, setSlideOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  // Form state
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formPoNumber, setFormPoNumber] = useState('');
  const [formDeliveryDate, setFormDeliveryDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formLineItems, setFormLineItems] = useState<Array<{ product_id: string; quantity: number; unit: string; confidence?: number }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEmails();
    fetchCustomers();
    fetchProducts();
  }, []);

  const fetchEmails = async () => {
    const { data } = await supabase
      .from('email_inbox')
      .select('*, distribution_customers:matched_customer_id(name)')
      .order('received_at', { ascending: false });
    setEmails(data || []);
    setLoading(false);
  };

  const fetchCustomers = async () => {
    const { data } = await supabase.from('distribution_customers').select('id, name').order('name');
    setCustomers(data || []);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('distribution_products').select('id, name, code').eq('is_active', true).order('name');
    setProducts(data || []);
  };

  const openReview = (email: any) => {
    setSelectedEmail(email);
    setFormCustomerId(email.matched_customer_id || '');
    setFormPoNumber(email.extracted_po_number || '');
    setFormDeliveryDate(email.extracted_delivery_date || '');
    setFormNotes('');
    
    // Parse line items from extracted_data
    const extracted = email.extracted_data as any;
    if (extracted?.line_items && Array.isArray(extracted.line_items)) {
      setFormLineItems(extracted.line_items.map((li: any) => ({
        product_id: li.product_id || '',
        quantity: li.quantity || 0,
        unit: li.unit || 'kg',
        confidence: li.confidence,
      })));
    } else {
      setFormLineItems([{ product_id: '', quantity: 0, unit: 'kg' }]);
    }
    setSlideOpen(true);
  };

  const addLineItem = () => {
    setFormLineItems([...formLineItems, { product_id: '', quantity: 0, unit: 'kg' }]);
  };

  const removeLineItem = (idx: number) => {
    setFormLineItems(formLineItems.filter((_, i) => i !== idx));
  };

  const updateLineItem = (idx: number, field: string, value: any) => {
    const updated = [...formLineItems];
    (updated[idx] as any)[field] = value;
    setFormLineItems(updated);
  };

  const confidenceBorder = (confidence?: number) => {
    if (confidence === undefined) return '';
    if (confidence < 0.85) return 'border-intake-warning';
    return '';
  };

  const handleApprove = async () => {
    if (!formCustomerId || !formPoNumber || !formDeliveryDate || formLineItems.length === 0) {
      toast({ title: 'Missing fields', description: 'Customer, PO number, delivery date, and at least one line item are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);

    // Generate FUIK invoice number
    const { data: invoiceNum } = await supabase.rpc('generate_fuik_invoice_number');

    // Create order
    const orderNumber = `ORD-${Date.now()}`;
    const { data: order, error: orderError } = await supabase.from('distribution_orders').insert({
      customer_id: formCustomerId,
      source_channel: 'email_po',
      status: 'confirmed',
      delivery_date: formDeliveryDate,
      order_number: orderNumber,
      po_number: formPoNumber,
      notes: formNotes || null,
      source_email_id: selectedEmail.id,
    }).select().single();

    if (orderError) {
      toast({ title: 'Error creating order', description: orderError.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    // Create order items
    for (const item of formLineItems) {
      if (item.product_id && item.quantity > 0) {
        await supabase.from('distribution_order_items').insert({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          order_unit: item.unit,
          unit_price_xcg: 0,
          total_xcg: 0,
        });
      }
    }

    // Create invoice
    const { data: invoice } = await supabase.from('distribution_invoices').insert({
      customer_id: formCustomerId,
      fuik_invoice_number: invoiceNum,
      status: 'draft',
      subtotal_xcg: 0,
      total_xcg: 0,
      ob_tax_amount: 0,
    }).select().single();

    if (invoice) {
      await supabase.from('distribution_invoice_orders').insert({
        invoice_id: invoice.id,
        order_id: order.id,
      });
      await supabase.from('distribution_orders').update({ invoice_id: invoice.id }).eq('id', order.id);
    }

    // Update email record
    await supabase.from('email_inbox').update({
      status: 'confirmed',
      linked_order_id: order.id,
      confirmed_by: user?.id,
      confirmed_at: new Date().toISOString(),
    }).eq('id', selectedEmail.id);

    setSaving(false);
    setSlideOpen(false);
    toast({ title: 'Order approved', description: `Invoice ${invoiceNum} created.` });
    fetchEmails();
  };

  const handleFailed = async () => {
    await supabase.from('email_inbox').update({
      status: 'failed',
      declined_by: user?.id,
      declined_at: new Date().toISOString(),
    }).eq('id', selectedEmail.id);
    setSlideOpen(false);
    toast({ title: 'Marked as failed' });
    fetchEmails();
  };

  const handleSaveProgress = async () => {
    setSaving(true);
    await supabase.from('email_inbox').update({
      extracted_data: {
        ...(selectedEmail.extracted_data as any || {}),
        line_items: formLineItems,
      },
      matched_customer_id: formCustomerId || null,
      extracted_po_number: formPoNumber,
      extracted_delivery_date: formDeliveryDate,
    }).eq('id', selectedEmail.id);
    setSaving(false);
    toast({ title: 'Progress saved' });
    fetchEmails();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-intake-text mb-6">Email PO Inbox</h1>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className="border rounded-lg bg-intake-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PO Number</TableHead>
                <TableHead>Customer Match</TableHead>
                <TableHead>Delivery Date</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-intake-text-muted">
                    No email POs received yet
                  </TableCell>
                </TableRow>
              ) : (
                emails.map((email) => (
                  <TableRow key={email.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openReview(email)}>
                    <TableCell className="text-xs">{format(new Date(email.received_at), 'dd MMM yyyy HH:mm')}</TableCell>
                    <TableCell className="text-xs truncate max-w-[150px]">{email.from_name || email.from_email}</TableCell>
                    <TableCell className="text-xs truncate max-w-[200px]">{email.subject}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${STATUS_COLORS[email.status] || ''}`}>{email.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{email.extracted_po_number || '—'}</TableCell>
                    <TableCell className="text-xs">{(email.distribution_customers as any)?.name || '—'}</TableCell>
                    <TableCell className="text-xs">{email.extracted_delivery_date || '—'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="h-7 text-xs">Review</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Review Slide-over */}
      <Sheet open={slideOpen} onOpenChange={setSlideOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[90vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Review Email PO</SheetTitle>
          </SheetHeader>
          {selectedEmail && (
            <div className="grid grid-cols-2 gap-6 mt-4">
              {/* Left: PDF viewer */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-intake-text">Original Email</h3>
                <div className="border rounded-md p-4 bg-muted min-h-[400px]">
                  <p className="text-xs text-intake-text-muted mb-2">From: {selectedEmail.from_name || selectedEmail.from_email}</p>
                  <p className="text-xs text-intake-text-muted mb-2">Subject: {selectedEmail.subject}</p>
                  <div className="text-sm" dangerouslySetInnerHTML={{ __html: selectedEmail.body_html || selectedEmail.body_text || 'No content' }} />
                </div>
              </div>

              {/* Right: Parsed fields */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-intake-text">Parsed Fields</h3>

                <div>
                  <Label className="flex items-center gap-1">
                    Customer *
                    {selectedEmail.extraction_confidence && selectedEmail.extraction_confidence < 0.85 && (
                      <Tooltip>
                        <TooltipTrigger><Info className="h-3 w-3 text-intake-warning" /></TooltipTrigger>
                        <TooltipContent>Confidence: {Math.round((selectedEmail.extraction_confidence || 0) * 100)}%</TooltipContent>
                      </Tooltip>
                    )}
                  </Label>
                  <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                    <SelectTrigger className={`${!formCustomerId ? 'border-intake-danger' : confidenceBorder(selectedEmail.extraction_confidence)}`}>
                      <SelectValue placeholder="Select customer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>PO Number *</Label>
                  <Input value={formPoNumber} onChange={(e) => setFormPoNumber(e.target.value)} className={confidenceBorder()} />
                </div>

                <div>
                  <Label>Delivery Date *</Label>
                  <Input type="date" value={formDeliveryDate} onChange={(e) => setFormDeliveryDate(e.target.value)} />
                </div>

                <div>
                  <Label>Line Items</Label>
                  <div className="space-y-2 mt-1">
                    {formLineItems.map((item, idx) => (
                      <div key={idx} className={`flex gap-2 items-center ${item.confidence !== undefined && item.confidence < 0.85 ? 'bg-[hsl(33,100%,94%)] p-1.5 rounded' : ''}`}>
                        <Select value={item.product_id} onValueChange={(v) => updateLineItem(idx, 'product_id', v)}>
                          <SelectTrigger className="flex-1 h-8 text-xs">
                            <SelectValue placeholder="Product..." />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 text-xs"
                          placeholder="Qty"
                        />
                        <Select value={item.unit} onValueChange={(v) => updateLineItem(idx, 'unit', v)}>
                          <SelectTrigger className="w-20 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {['kg', 'case', 'piece', 'bag', 'box', 'bunch'].map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeLineItem(idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-intake-danger" />
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addLineItem}>
                      <Plus className="h-3 w-3 mr-1" /> Add line item
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="h-20" />
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button className="bg-intake-brand hover:bg-intake-accent text-white" onClick={handleApprove} disabled={saving}>
                    {saving ? 'Processing...' : 'Approve Order'}
                  </Button>
                  <Button variant="outline" className="border-intake-danger text-intake-danger hover:bg-intake-danger hover:text-white" onClick={handleFailed}>
                    Mark as Failed
                  </Button>
                  <Button variant="outline" onClick={handleSaveProgress} disabled={saving}>
                    Save Progress
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
