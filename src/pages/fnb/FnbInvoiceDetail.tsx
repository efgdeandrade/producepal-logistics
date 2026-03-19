import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import html2pdf from 'html2pdf.js';
import {
  ArrowLeft,
  Save,
  CheckCircle,
  Send,
  Trash2,
  Printer,
  Edit3,
  AlertCircle,
  RefreshCw,
  Download,
  Smartphone,
  FileText,
  Receipt,
  Loader2,
  History,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { MTRExportDialog } from '@/components/fnb/MTRExportDialog';
import type { MTRReceiptData } from '@/utils/mtrExportEngine';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FnbInvoicePreview } from '@/components/fnb/FnbInvoicePreview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { useFnbInvoices, InvoiceItem, calculateOBTax } from '@/hooks/useFnbInvoices';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const statusConfig: Record<string, { label: string; color: string; description: string }> = {
  draft: { label: 'Draft', color: 'bg-yellow-100 text-yellow-800', description: 'Invoice can be edited' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800', description: 'Ready for QuickBooks sync' },
  synced: { label: 'Synced', color: 'bg-green-100 text-green-800', description: 'Invoice is in QuickBooks' },
  failed: { label: 'Failed', color: 'bg-destructive/10 text-destructive', description: 'Sync failed, retry needed' },
};

interface AuditTrailEntry {
  id: string;
  invoice_id: string;
  changed_by: string;
  field_changed: string;
  original_value: string | null;
  new_value: string | null;
  change_reason: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
}

export default function FnbInvoiceDetail() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const { 
    useInvoice, 
    updateInvoice, 
    confirmInvoice, 
    deleteInvoice,
    syncToQuickBooks 
  } = useFnbInvoices();

  const { data: invoice, isLoading } = useInvoice(invoiceId);

  // Local state for editing
  const [invoiceDate, setInvoiceDate] = useState<Date | undefined>();
  const [customerMemo, setCustomerMemo] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printFormat, setPrintFormat] = useState<'80mm' | 'a4'>('80mm');
  const [showMTRDialog, setShowMTRDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [qbSyncing, setQbSyncing] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  
  const invoicePreviewRef = useRef<HTMLDivElement>(null);

  // Audit trail query
  const { data: auditTrail, isLoading: auditLoading } = useQuery({
    queryKey: ['invoice-audit-trail', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      const { data, error } = await supabase
        .from('invoice_audit_trail')
        .select('*, profiles:changed_by(full_name)')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AuditTrailEntry[];
    },
    enabled: !!invoiceId,
  });

  // Initialize form when invoice loads
  useEffect(() => {
    if (invoice) {
      setInvoiceDate(new Date(invoice.invoice_date));
      setCustomerMemo(invoice.customer_memo || '');
      setNotes(invoice.notes || '');
      setItems(invoice.distribution_invoice_items || []);
      setHasChanges(false);
      setIsEditMode(false);
    }
  }, [invoice]);

  const isEditable = isEditMode && (invoice?.status === 'draft' || invoice?.status === 'confirmed');

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      if (field === 'quantity' || field === 'unit_price_xcg') {
        const qty = field === 'quantity' ? Number(value) : updated[index].quantity;
        const price = field === 'unit_price_xcg' ? Number(value) : updated[index].unit_price_xcg;
        const lineTotal = Number((qty * price).toFixed(2));
        updated[index].line_total_xcg = lineTotal;
        updated[index].ob_tax_inclusive = updated[index].is_ob_eligible ? calculateOBTax(lineTotal) : 0;
      }
      
      return updated;
    });
    setHasChanges(true);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.line_total_xcg, 0);
    const obTax = items.reduce((sum, item) => sum + item.ob_tax_inclusive, 0);
    return { subtotal, obTax, total: subtotal };
  };

  // Build audit trail entries for changed fields
  const buildAuditEntries = () => {
    if (!invoice || !invoiceId || !user) return [];
    const entries: { field_changed: string; original_value: string; new_value: string }[] = [];

    const origDate = invoice.invoice_date;
    const newDate = invoiceDate ? format(invoiceDate, 'yyyy-MM-dd') : origDate;
    if (origDate !== newDate) {
      entries.push({ field_changed: 'invoice_date', original_value: origDate, new_value: newDate });
    }

    if ((invoice.customer_memo || '') !== customerMemo) {
      entries.push({ field_changed: 'customer_memo', original_value: invoice.customer_memo || '', new_value: customerMemo });
    }

    if ((invoice.notes || '') !== notes) {
      entries.push({ field_changed: 'notes', original_value: invoice.notes || '', new_value: notes });
    }

    return entries;
  };

  const handleSave = async () => {
    if (!invoiceId || !invoiceDate || !user) return;

    // Insert audit trail entries BEFORE updating
    const auditEntries = buildAuditEntries();
    if (auditEntries.length > 0) {
      const rows = auditEntries.map(e => ({
        invoice_id: invoiceId,
        changed_by: user.id,
        field_changed: e.field_changed,
        original_value: e.original_value,
        new_value: e.new_value,
      }));
      await supabase.from('invoice_audit_trail').insert(rows);
    }

    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 7);

    await updateInvoice.mutateAsync({
      invoiceId,
      updates: {
        invoice_date: format(invoiceDate, 'yyyy-MM-dd'),
        due_date: format(dueDate, 'yyyy-MM-dd'),
        customer_memo: customerMemo || null,
        notes: notes || null,
      },
      items,
    });
    setHasChanges(false);
    setIsEditMode(false);
    queryClient.invalidateQueries({ queryKey: ['invoice-audit-trail', invoiceId] });
  };

  const handleConfirm = async () => {
    if (!invoiceId) return;
    if (hasChanges) {
      await handleSave();
    }
    await confirmInvoice.mutateAsync(invoiceId);
    setShowConfirmDialog(false);
  };

  const handleDelete = async () => {
    if (!invoiceId) return;
    await deleteInvoice.mutateAsync(invoiceId);
    navigate('/distribution/invoices');
  };

  const handleSyncToQB = async () => {
    if (!invoiceId) return;
    await syncToQuickBooks.mutateAsync(invoiceId);
  };

  const handlePrint = () => {
    if (invoicePreviewRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Invoice - ${invoice?.distribution_customers?.name}</title>
              <style>
                body { margin: 0; padding: 20px; font-family: monospace; }
                @media print { body { padding: 0; } }
              </style>
            </head>
            <body>
              ${invoicePreviewRef.current.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }
  };

  const handleDownloadPdf = () => {
    if (invoicePreviewRef.current) {
      const element = invoicePreviewRef.current;
      const customerName = invoice?.distribution_customers?.name?.replace(/\s+/g, '-') || 'invoice';
      const dateStr = invoiceDate ? format(invoiceDate, 'yyyy-MM-dd') : 'draft';
      
      const opt = {
        margin: printFormat === '80mm' ? 2 : 10,
        filename: `invoice-${customerName}-${dateStr}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { 
          unit: 'mm' as const, 
          format: printFormat === '80mm' ? [80, 297] as [number, number] : 'a4' as const, 
          orientation: 'portrait' as const
        }
      };

      html2pdf().set(opt).from(element).save();
    }
  };

  // Enhancement 4: A4 PDF print
  const handleA4Print = () => {
    window.print();
  };

  // Enhancement 4: 80mm thermal receipt popup
  const handle80mmReceipt = () => {
    if (!invoice) return;
    const invoiceNum = invoice.fuik_invoice_number || 'DRAFT';
    const custName = invoice.distribution_customers?.name || '';
    const dateStr = invoiceDate ? format(invoiceDate, 'd MMM yyyy') : '';

    const pad = (s: string, len: number) => s.length >= len ? s.substring(0, len) : s + ' '.repeat(len - s.length);
    const rpad = (s: string, len: number) => s.length >= len ? s.substring(0, len) : ' '.repeat(len - s.length) + s;
    const line = '-'.repeat(42);

    let receipt = '';
    receipt += '       FUIK COMPANY B.V.\n';
    receipt += '         Reigerweg 21\n';
    receipt += '        Tel: 7363845\n';
    receipt += '       info@fuik.co\n';
    receipt += '      CRIB: 102649479\n';
    receipt += line + '\n';
    receipt += '          INVOICE\n';
    receipt += line + '\n';
    receipt += `No: ${invoiceNum}\n`;
    receipt += `Date: ${dateStr}\n`;
    receipt += `Customer: ${custName}\n`;
    receipt += line + '\n';
    receipt += pad('Product', 20) + rpad('Qty', 6) + rpad('Price', 8) + rpad('Total', 8) + '\n';
    receipt += line + '\n';

    items.forEach(item => {
      const name = item.product_name.length > 20 ? item.product_name.substring(0, 19) + '…' : item.product_name;
      receipt += pad(name, 20) + rpad(String(item.quantity), 6) + rpad(item.unit_price_xcg.toFixed(2), 8) + rpad(item.line_total_xcg.toFixed(2), 8) + '\n';
    });

    const { subtotal: st, total: tt } = calculateTotals();
    receipt += line + '\n';
    receipt += pad('Subtotal:', 34) + rpad(st.toFixed(2), 8) + '\n';
    receipt += pad('TOTAL:', 34) + rpad(tt.toFixed(2), 8) + '\n';
    receipt += line + '\n';
    receipt += '    Thank you for your business!\n';

    const popup = window.open('', '_blank', 'width=320,height=600,scrollbars=yes');
    if (popup) {
      popup.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><style>
        body { font-family: 'Courier New', monospace; font-size: 12px; margin: 10px; white-space: pre; line-height: 1.4; color: #000; background: #fff; }
        @media print { body { margin: 0; } }
      </style></head><body>${receipt}</body></html>`);
      popup.document.close();
      setTimeout(() => popup.print(), 500);
    }
  };

  // QuickBooks sync removed — use handleSyncToQB instead

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 pb-24">
        <div className="text-center py-12">Loading invoice...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container mx-auto p-4 pb-24">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Invoice not found</p>
          <Button variant="outline" onClick={() => navigate('/distribution/invoices')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
        </div>
      </div>
    );
  }

  const { subtotal, obTax, total } = calculateTotals();
  const config = statusConfig[invoice.status];
  const orderNumbers = invoice.distribution_invoice_orders?.map(o => o.distribution_orders?.order_number).filter(Boolean) || [];
  const displayInvoiceNumber = invoice.fuik_invoice_number || orderNumbers[0] || invoice.id.slice(0, 8);
  const canEnterEditMode = invoice.status === 'draft' || invoice.status === 'confirmed';

  return (
    <div className="px-4 md:container py-4 pb-24 space-y-6 w-full max-w-full overflow-x-hidden print:p-0 print:pb-0">
      {/* Header with FUIK number + print format selector */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/distribution/invoices')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            {/* Enhancement 1: FUIK invoice number prominently displayed */}
            <h1 className="text-2xl font-bold font-mono tracking-wide">
              {invoice.fuik_invoice_number || 'Invoice'}
            </h1>
            <p className="text-muted-foreground">
              {invoice.distribution_customers?.name} • {orderNumbers.join(', ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Enhancement 4: Print format selector buttons */}
          <Button variant="outline" size="sm" onClick={handleA4Print}>
            <FileText className="h-4 w-4 mr-1" />
            A4 PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handle80mmReceipt}>
            <Receipt className="h-4 w-4 mr-1" />
            80mm Receipt
          </Button>
          <Button variant="outline" size="sm" onClick={handleQBSync} disabled={qbSyncing}>
            {qbSyncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            QuickBooks
          </Button>
          <Badge className={cn('gap-1 text-sm ml-2', config.color)}>
            {config.label}
          </Badge>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block mb-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">FUIK COMPANY B.V.</h1>
          <p className="text-sm">Reigerweg 21 • Tel: 7363845 • info@fuik.co • CRIB: 102649479</p>
        </div>
        <div className="text-center text-xl font-bold mb-4">INVOICE</div>
        <div className="flex justify-between mb-4">
          <div>
            <strong>Bill To:</strong><br />
            {invoice.distribution_customers?.name}<br />
            {invoice.distribution_customers?.address}
          </div>
          <div className="text-right">
            <strong>{displayInvoiceNumber}</strong><br />
            Date: {invoiceDate ? format(invoiceDate, 'd MMM yyyy') : ''}<br />
            Due: {invoiceDate ? format(new Date(invoiceDate.getTime() + 7 * 86400000), 'd MMM yyyy') : ''}
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {invoice.status === 'failed' && invoice.quickbooks_sync_error && (
        <Card className="border-destructive bg-destructive/5 print:hidden">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Sync Failed</p>
                <p className="text-sm text-muted-foreground">{invoice.quickbooks_sync_error}</p>
              </div>
              <Button onClick={handleSyncToQB} disabled={syncToQuickBooks.isPending}>
                <RefreshCw className={cn("h-4 w-4 mr-2", syncToQuickBooks.isPending && "animate-spin")} />
                Retry Sync
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {invoice.status === 'synced' && (
        <Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20 print:hidden">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">
                  Synced to QuickBooks
                </p>
                {invoice.quickbooks_invoice_number && (
                  <p className="text-sm text-muted-foreground">
                    Invoice #: {invoice.quickbooks_invoice_number}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Info */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Invoice Details</CardTitle>
              {/* Enhancement 2: Edit Invoice button */}
              {canEnterEditMode && !isEditMode && (
                <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)} className="print:hidden">
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit Invoice
                </Button>
              )}
              {isEditMode && (
                <Button variant="ghost" size="sm" onClick={() => { setIsEditMode(false); if (invoice) { setInvoiceDate(new Date(invoice.invoice_date)); setCustomerMemo(invoice.customer_memo || ''); setNotes(invoice.notes || ''); setItems(invoice.distribution_invoice_items || []); setHasChanges(false); }}} className="print:hidden">
                  Cancel
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Enhancement 1: FUIK number (read-only, never editable) */}
              <div className="space-y-2">
                <Label>Invoice Number</Label>
                <div className="p-2 bg-muted rounded-md font-mono font-bold text-lg">
                  {displayInvoiceNumber}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  {isEditable ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {invoiceDate ? format(invoiceDate, 'PPP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={invoiceDate}
                          onSelect={(date) => {
                            setInvoiceDate(date);
                            setHasChanges(true);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <div className="p-2 bg-muted rounded-md">
                      {format(new Date(invoice.invoice_date), 'PPP')}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Due Date (Net 7)</Label>
                  <div className="p-2 bg-muted rounded-md">
                    {invoiceDate 
                      ? format(new Date(invoiceDate.getTime() + 7 * 24 * 60 * 60 * 1000), 'PPP')
                      : format(new Date(invoice.due_date), 'PPP')
                    }
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Customer Memo (appears on invoice)</Label>
                {isEditable ? (
                  <Textarea
                    value={customerMemo}
                    onChange={(e) => {
                      setCustomerMemo(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="e.g., Order: ORD-2026-0001"
                    rows={2}
                  />
                ) : (
                  <div className="p-2 bg-muted rounded-md min-h-[60px]">
                    {invoice.customer_memo || '-'}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Internal Notes</Label>
                {isEditable ? (
                  <Textarea
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="Internal notes (not visible to customer)"
                    rows={2}
                  />
                ) : (
                  <div className="p-2 bg-muted rounded-md min-h-[60px]">
                    {invoice.notes || '-'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Line Items
                {isEditable && <Edit3 className="h-4 w-4 text-muted-foreground" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Product</TableHead>
                      <TableHead className="min-w-[150px]">Description</TableHead>
                      <TableHead className="text-right w-24">Qty</TableHead>
                      <TableHead className="text-right w-28">Rate</TableHead>
                      <TableHead className="text-right w-28">Amount</TableHead>
                      <TableHead className="w-16 text-center">O.B.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={item.id || index}>
                        <TableCell>
                          {isEditable ? (
                            <Input
                              value={item.product_name}
                              onChange={(e) => handleItemChange(index, 'product_name', e.target.value)}
                              className="min-w-[180px]"
                            />
                          ) : (
                            item.product_name
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditable ? (
                            <Input
                              value={item.description || ''}
                              onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                              placeholder="Per piece, Per Kg..."
                            />
                          ) : (
                            item.description || '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditable ? (
                            <Input
                              type="number"
                              step="0.001"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                              className="w-20 text-right"
                            />
                          ) : (
                            item.quantity.toFixed(item.quantity % 1 === 0 ? 0 : 3)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditable ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unit_price_xcg}
                              onChange={(e) => handleItemChange(index, 'unit_price_xcg', e.target.value)}
                              className="w-24 text-right"
                            />
                          ) : (
                            `XCG ${item.unit_price_xcg.toFixed(2)}`
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          XCG {item.line_total_xcg.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.is_ob_eligible && (
                            <Badge variant="outline" className="text-xs">Incl.</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-medium">Subtotal</TableCell>
                      <TableCell className="text-right font-bold">XCG {subtotal.toFixed(2)}</TableCell>
                      <TableCell />
                    </TableRow>
                    {obTax > 0 && (
                      <TableRow className="bg-transparent">
                        <TableCell colSpan={4} className="text-right text-sm text-muted-foreground">
                          Eiland Ontvanger @ 6% (inclusive)
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          XCG {obTax.toFixed(2)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell colSpan={4} className="text-right text-lg font-bold">Total</TableCell>
                      <TableCell className="text-right text-lg font-bold">XCG {total.toFixed(2)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Enhancement 3: Change History Panel */}
          <Card className="print:hidden">
            <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {auditOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <History className="h-4 w-4" />
                    Change History
                    <Badge variant="secondary" className="ml-1">{auditTrail?.length || 0}</Badge>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  {auditLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : !auditTrail || auditTrail.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No changes recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {auditTrail.map((entry) => (
                        <div key={entry.id} className="flex items-start gap-3 text-sm border-b border-border pb-3 last:border-0">
                          <div className="text-muted-foreground text-xs whitespace-nowrap mt-0.5">
                            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                          </div>
                          <div className="flex-1">
                            <span className="font-medium">{entry.field_changed}</span>
                            <span className="text-muted-foreground">
                              {' '}was <span className="line-through">{entry.original_value || '(empty)'}</span> → now <span className="font-medium">{entry.new_value || '(empty)'}</span>
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {(entry.profiles as any)?.full_name || 'Unknown'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 print:hidden">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{invoice.distribution_customers?.name}</p>
              {invoice.distribution_customers?.address && (
                <p className="text-sm text-muted-foreground">{invoice.distribution_customers.address}</p>
              )}
              {invoice.distribution_customers?.whatsapp_phone && (
                <p className="text-sm text-muted-foreground">{invoice.distribution_customers.whatsapp_phone}</p>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isEditable && hasChanges && (
                <Button 
                  className="w-full" 
                  onClick={handleSave}
                  disabled={updateInvoice.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              )}

              {invoice.status === 'draft' && (
                <Button 
                  className="w-full" 
                  variant="default"
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={confirmInvoice.isPending || hasChanges}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Invoice
                </Button>
              )}

              {invoice.status === 'confirmed' && (
                <Button 
                  className="w-full" 
                  onClick={handleSyncToQB}
                  disabled={syncToQuickBooks.isPending}
                >
                  <Send className={cn("h-4 w-4 mr-2", syncToQuickBooks.isPending && "animate-spin")} />
                  Push to QuickBooks
                </Button>
              )}

              <Button variant="outline" className="w-full" onClick={() => setShowPrintDialog(true)}>
                <Printer className="h-4 w-4 mr-2" />
                Print / Download
              </Button>

              <Button variant="outline" className="w-full" onClick={() => setShowMTRDialog(true)}>
                <Smartphone className="h-4 w-4 mr-2" />
                MTR Export (Mobile)
              </Button>

              {invoice.status === 'draft' && (
                <>
                  <Separator />
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Invoice
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Linked Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Linked Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {orderNumbers.map((orderNum, i) => (
                  <div key={i} className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    {orderNum}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Print-only line items table */}
      <div className="hidden print:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-2">Product</th>
              <th className="text-right py-2">Qty</th>
              <th className="text-right py-2">Rate</th>
              <th className="text-right py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-1">{item.product_name}</td>
                <td className="text-right py-1">{item.quantity}</td>
                <td className="text-right py-1">XCG {item.unit_price_xcg.toFixed(2)}</td>
                <td className="text-right py-1">XCG {item.line_total_xcg.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black">
              <td colSpan={3} className="text-right font-bold py-2">Total</td>
              <td className="text-right font-bold py-2">XCG {total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="text-center mt-8 text-sm">Thank you for your business!</p>
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              Once confirmed, this invoice will be ready to push to QuickBooks. 
              You can still make edits before syncing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Confirm Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the draft invoice and unlink the associated orders. 
              The orders will become available for invoicing again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Preview Dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Print Invoice</DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center gap-4 pb-4 border-b">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Format:</span>
              <Select value={printFormat} onValueChange={(v: '80mm' | 'a4') => setPrintFormat(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="80mm">80mm Receipt</SelectItem>
                  <SelectItem value="a4">A4 Standard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
            <Button variant="outline" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
          
          <div className="flex-1 overflow-auto py-4 flex justify-center bg-muted/50 rounded-md">
            <FnbInvoicePreview
              ref={invoicePreviewRef}
              invoiceDate={invoiceDate ? format(invoiceDate, 'MMMM d, yyyy') : ''}
              dueDate={invoiceDate ? format(new Date(invoiceDate.getTime() + 7 * 24 * 60 * 60 * 1000), 'MMMM d, yyyy') : ''}
              customerName={invoice?.distribution_customers?.name || ''}
              customerAddress={invoice?.distribution_customers?.address || undefined}
              customerPhone={invoice?.distribution_customers?.whatsapp_phone || undefined}
              customerMemo={customerMemo || undefined}
              orderNumbers={orderNumbers}
              items={items.map(item => ({
                product_name: item.product_name,
                description: item.description || undefined,
                quantity: item.quantity,
                unit_price_xcg: item.unit_price_xcg,
                line_total_xcg: item.line_total_xcg,
                is_ob_eligible: item.is_ob_eligible,
                ob_tax_inclusive: item.ob_tax_inclusive,
              }))}
              subtotal={subtotal}
              obTax={obTax}
              total={total}
              format={printFormat}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* MTR Export Dialog */}
      <MTRExportDialog
        open={showMTRDialog}
        onOpenChange={setShowMTRDialog}
        receiptData={invoice ? {
          storeName: 'FUIK COMPANY B.V.',
          storeAddress: 'Reigerweg 21',
          storePhone: '7363845',
          storeEmail: 'info@fuik.co',
          storeCrib: '102649479',
          title: 'INVOICE',
          date: invoiceDate ? format(invoiceDate, 'MMMM d, yyyy') : '',
          dueDate: invoiceDate ? format(new Date(invoiceDate.getTime() + 7 * 24 * 60 * 60 * 1000), 'MMMM d, yyyy') : undefined,
          paymentTerms: 'Due on Receipt',
          customerName: invoice.distribution_customers?.name || '',
          customerAddress: invoice.distribution_customers?.address || undefined,
          customerPhone: invoice.distribution_customers?.whatsapp_phone || undefined,
          customerMemo: customerMemo || undefined,
          items: items.map(item => ({
            name: item.product_name,
            qty: item.quantity,
            rate: item.unit_price_xcg,
            amount: item.line_total_xcg,
            obEligible: item.is_ob_eligible,
          })),
          subtotal,
          obTax,
          total,
          orderRefs: orderNumbers,
        } : null}
        filename={`invoice-${invoice?.distribution_customers?.name?.replace(/\s+/g, '-') || 'draft'}-${invoiceDate ? format(invoiceDate, 'yyyy-MM-dd') : 'draft'}`}
      />
    </div>
  );
}
