import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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

const statusConfig: Record<string, { label: string; color: string; description: string }> = {
  draft: { label: 'Draft', color: 'bg-yellow-100 text-yellow-800', description: 'Invoice can be edited' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800', description: 'Ready for QuickBooks sync' },
  synced: { label: 'Synced', color: 'bg-green-100 text-green-800', description: 'Invoice is in QuickBooks' },
  failed: { label: 'Failed', color: 'bg-destructive/10 text-destructive', description: 'Sync failed, retry needed' },
};

export default function FnbInvoiceDetail() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  
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

  // Initialize form when invoice loads
  useEffect(() => {
    if (invoice) {
      setInvoiceDate(new Date(invoice.invoice_date));
      setCustomerMemo(invoice.customer_memo || '');
      setNotes(invoice.notes || '');
      setItems(invoice.fnb_invoice_items || []);
      setHasChanges(false);
    }
  }, [invoice]);

  const isEditable = invoice?.status === 'draft' || invoice?.status === 'confirmed';

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Recalculate line total and O.B. tax
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

  const handleSave = async () => {
    if (!invoiceId || !invoiceDate) return;

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
  };

  const handleConfirm = async () => {
    if (!invoiceId) return;
    
    // Save any pending changes first
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
  const orderNumbers = invoice.fnb_invoice_orders?.map(o => o.fnb_orders?.order_number).filter(Boolean) || [];

  return (
    <div className="container mx-auto p-4 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/distribution/invoices')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Invoice</h1>
            <p className="text-muted-foreground">
              {invoice.fnb_customers?.name} • {orderNumbers.join(', ')}
            </p>
          </div>
        </div>
        <Badge className={cn('gap-1 text-sm', config.color)}>
          {config.label}
        </Badge>
      </div>

      {/* Status Banner */}
      {invoice.status === 'failed' && invoice.quickbooks_sync_error && (
        <Card className="border-destructive bg-destructive/5">
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
        <Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20">
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
            <CardHeader>
              <CardTitle className="text-lg">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{invoice.fnb_customers?.name}</p>
              {invoice.fnb_customers?.address && (
                <p className="text-sm text-muted-foreground">{invoice.fnb_customers.address}</p>
              )}
              {invoice.fnb_customers?.whatsapp_phone && (
                <p className="text-sm text-muted-foreground">{invoice.fnb_customers.whatsapp_phone}</p>
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

              <Button variant="outline" className="w-full" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Print Preview
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
    </div>
  );
}
