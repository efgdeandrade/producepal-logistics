import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FileText, Printer, Download, Eye, Search, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Invoice } from '@/components/Invoice';
import html2pdf from 'html2pdf.js';

interface InvoiceData {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  subtotal: number;
  total: number;
  adjusted_total: number;
  status: string;
  delivery_id: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
}

const Invoices = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState<'80mm' | 'a4'>('80mm');
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      
      // Fetch invoices with customer info
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .order('invoice_date', { ascending: false });

      if (invoicesError) throw invoicesError;

      // Fetch related data
      const { data: customers } = await supabase.from('customers').select('*');
      const { data: deliveryItems } = await supabase.from('delivery_items').select('*');
      const { data: products } = await supabase.from('products').select('*');

      const customerMap = new Map(customers?.map(c => [c.id, c]) || []);
      const productMap = new Map(products?.map(p => [p.code, p]) || []);

      const enrichedInvoices = (invoicesData || []).map(invoice => {
        const customer = customerMap.get(invoice.customer_id);
        const items = (deliveryItems || [])
          .filter(item => item.delivery_id === invoice.delivery_id)
          .map(item => {
            const product = productMap.get(item.product_code);
            return {
              product_name: product?.name || item.product_code,
              quantity: item.delivered_quantity || item.planned_quantity,
              unit_price: product?.wholesale_price_xcg_per_unit || 0,
              line_total: (item.delivered_quantity || item.planned_quantity) * (product?.wholesale_price_xcg_per_unit || 0),
            };
          });

        return {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          customer_id: invoice.customer_id,
          customer_name: customer?.name || 'Unknown',
          customer_address: customer?.address || '',
          customer_phone: customer?.phone || '',
          subtotal: invoice.subtotal,
          total: invoice.adjusted_total,
          adjusted_total: invoice.adjusted_total,
          status: invoice.status,
          delivery_id: invoice.delivery_id,
          items,
        };
      });

      setInvoices(enrichedInvoices);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = (invoice: InvoiceData) => {
    setSelectedInvoice(invoice);
    setPreviewOpen(true);
  };

  const handlePrint = () => {
    if (invoiceRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Invoice</title>');
        printWindow.document.write('<style>body { margin: 0; padding: 20px; }</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(invoiceRef.current.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const handleDownload = async () => {
    if (!invoiceRef.current || !selectedInvoice) return;

    const opt = {
      margin: printFormat === '80mm' ? 5 : 10,
      filename: `${selectedInvoice.invoice_number}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: {
        unit: 'mm' as const,
        format: (printFormat === '80mm' ? [80, 297] : 'a4') as [number, number] | 'a4',
        orientation: 'portrait' as const,
      },
    };

    try {
      await html2pdf().set(opt).from(invoiceRef.current).save();
      toast({
        title: 'Success',
        description: 'Invoice downloaded successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to download invoice',
        variant: 'destructive',
      });
    }
  };

  const filteredInvoices = invoices.filter(
    invoice =>
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Invoices</h1>
            <p className="text-muted-foreground">View, print, and download customer invoices</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoice List
              </span>
              <div className="flex items-center gap-4">
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search invoices..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 animate-pulse text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Loading invoices...</p>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No invoices found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total (XCG)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>{format(new Date(invoice.invoice_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{invoice.customer_name}</TableCell>
                      <TableCell className="text-right font-bold">
                        EC$ {invoice.total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewInvoice(invoice)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Invoice Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Invoice Preview</DialogTitle>
              <DialogDescription>
                View and print invoice {selectedInvoice?.invoice_number}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label>Print Format</Label>
                  <Select value={printFormat} onValueChange={(v) => setPrintFormat(v as '80mm' | 'a4')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="80mm">80mm Receipt</SelectItem>
                      <SelectItem value="a4">A4 Standard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-6">
                  <Button onClick={handlePrint} variant="outline">
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                  <Button onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-gray-50 flex justify-center overflow-x-auto">
                {selectedInvoice && (
                  <Invoice
                    ref={invoiceRef}
                    invoiceNumber={selectedInvoice.invoice_number}
                    invoiceDate={format(new Date(selectedInvoice.invoice_date), 'MMM d, yyyy')}
                    customerName={selectedInvoice.customer_name}
                    customerAddress={selectedInvoice.customer_address}
                    customerPhone={selectedInvoice.customer_phone}
                    items={selectedInvoice.items}
                    subtotal={selectedInvoice.total}
                    total={selectedInvoice.total}
                    format={printFormat}
                  />
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Invoices;
