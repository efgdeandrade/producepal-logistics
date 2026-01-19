import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Plus, 
  FileText, 
  Send, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  RefreshCw,
  ChevronRight,
  Package,
  Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { useFnbInvoices, Invoice, ReadyOrder } from '@/hooks/useFnbInvoices';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', icon: <Clock className="h-3 w-3" /> },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', icon: <CheckCircle className="h-3 w-3" /> },
  synced: { label: 'Synced', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', icon: <Send className="h-3 w-3" /> },
  failed: { label: 'Failed', color: 'bg-destructive/10 text-destructive', icon: <AlertCircle className="h-3 w-3" /> },
};

export default function FnbInvoices() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<string | null>(null);

  const { 
    useInvoices, 
    useReadyOrders, 
    createInvoice, 
    deleteInvoice,
    syncToQuickBooks 
  } = useFnbInvoices();

  const { data: readyOrders, isLoading: loadingOrders } = useReadyOrders();
  const { data: invoices, isLoading: loadingInvoices } = useInvoices();

  // Group orders by customer for easier selection
  const ordersByCustomer = (readyOrders || []).reduce((acc, order) => {
    if (!acc[order.customer_id]) {
      acc[order.customer_id] = {
        customerName: order.customer_name,
        orders: [],
      };
    }
    acc[order.customer_id].orders.push(order);
    return acc;
  }, {} as Record<string, { customerName: string; orders: ReadyOrder[] }>);

  const handleSelectOrder = (orderId: string, customerOrders: ReadyOrder[]) => {
    const order = customerOrders.find(o => o.id === orderId);
    if (!order) return;

    setSelectedOrders(prev => {
      const isSelected = prev.includes(orderId);
      if (isSelected) {
        return prev.filter(id => id !== orderId);
      }
      // When selecting, ensure only orders from same customer are selected
      const otherCustomerOrders = prev.filter(id => {
        const o = readyOrders?.find(ro => ro.id === id);
        return o?.customer_id === order.customer_id;
      });
      return [...otherCustomerOrders, orderId];
    });
  };

  const handleSelectAllForCustomer = (customerId: string, customerOrders: ReadyOrder[]) => {
    const customerOrderIds = customerOrders.map(o => o.id);
    const allSelected = customerOrderIds.every(id => selectedOrders.includes(id));
    
    if (allSelected) {
      setSelectedOrders(prev => prev.filter(id => !customerOrderIds.includes(id)));
    } else {
      // Clear other customer selections and select all for this customer
      setSelectedOrders(customerOrderIds);
    }
  };

  const handleCreateInvoice = async () => {
    if (selectedOrders.length === 0) {
      toast.error('Please select at least one order');
      return;
    }
    
    const result = await createInvoice.mutateAsync(selectedOrders);
    setSelectedOrders([]);
    // Navigate to edit the new invoice
    navigate(`/distribution/invoices/${result.id}`);
  };

  const getInvoicesByStatus = (status: string) => {
    if (status === 'all') return invoices || [];
    return (invoices || []).filter(inv => inv.status === status);
  };

  const draftInvoices = getInvoicesByStatus('draft');
  const confirmedInvoices = getInvoicesByStatus('confirmed');
  const syncedInvoices = getInvoicesByStatus('synced');
  const failedInvoices = getInvoicesByStatus('failed');

  const renderInvoiceRow = (invoice: Invoice) => {
    const config = statusConfig[invoice.status];
    const orderNumbers = invoice.distribution_invoice_orders?.map(o => o.distribution_orders?.order_number).filter(Boolean) || [];

    return (
      <TableRow 
        key={invoice.id} 
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => navigate(`/distribution/invoices/${invoice.id}`)}
      >
        <TableCell>
          <div className="font-medium">{invoice.distribution_customers?.name || 'Unknown'}</div>
          <div className="text-xs text-muted-foreground">
            {orderNumbers.length} order{orderNumbers.length !== 1 ? 's' : ''}
          </div>
        </TableCell>
        <TableCell>{format(new Date(invoice.invoice_date), 'MMM d, yyyy')}</TableCell>
        <TableCell>{format(new Date(invoice.due_date), 'MMM d, yyyy')}</TableCell>
        <TableCell className="text-right font-medium">
          XCG {invoice.total_xcg.toFixed(2)}
        </TableCell>
        <TableCell>
          <Badge className={cn('gap-1', config.color)}>
            {config.icon}
            {config.label}
          </Badge>
        </TableCell>
        <TableCell>
          {invoice.quickbooks_invoice_number && (
            <span className="text-sm text-muted-foreground">
              QB: {invoice.quickbooks_invoice_number}
            </span>
          )}
        </TableCell>
        <TableCell>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </TableCell>
      </TableRow>
    );
  };

  const renderEmptyState = (message: string) => (
    <div className="text-center py-12 text-muted-foreground">
      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p>{message}</p>
    </div>
  );

  return (
    <div className="px-4 md:container py-4 pb-24 space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Create and manage customer invoices</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ready for Invoice</p>
                <p className="text-2xl font-bold">{readyOrders?.length || 0}</p>
              </div>
              <Package className="h-8 w-8 text-orange-500 opacity-75" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Drafts</p>
                <p className="text-2xl font-bold">{draftInvoices.length}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500 opacity-75" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Awaiting Sync</p>
                <p className="text-2xl font-bold">{confirmedInvoices.length}</p>
              </div>
              <Send className="h-8 w-8 text-blue-500 opacity-75" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Synced</p>
                <p className="text-2xl font-bold">{syncedInvoices.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-75" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pending" className="gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Pending</span>
            {(readyOrders?.length || 0) > 0 && (
              <Badge variant="secondary" className="ml-1">{readyOrders?.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="draft" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Drafts</span>
            {draftInvoices.length > 0 && (
              <Badge variant="secondary" className="ml-1">{draftInvoices.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="confirmed" className="gap-2">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Confirmed</span>
            {confirmedInvoices.length > 0 && (
              <Badge variant="secondary" className="ml-1">{confirmedInvoices.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="synced" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Synced</span>
          </TabsTrigger>
          <TabsTrigger value="failed" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Failed</span>
            {failedInvoices.length > 0 && (
              <Badge variant="destructive" className="ml-1">{failedInvoices.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pending Orders Tab */}
        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg">Orders Ready for Invoicing</CardTitle>
              <Button 
                onClick={handleCreateInvoice}
                disabled={selectedOrders.length === 0 || createInvoice.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice ({selectedOrders.length})
              </Button>
            </CardHeader>
            <CardContent>
              {loadingOrders ? (
                <div className="text-center py-8">Loading...</div>
              ) : Object.keys(ordersByCustomer).length === 0 ? (
                renderEmptyState('No orders ready for invoicing')
              ) : (
                <div className="space-y-6">
                  {Object.entries(ordersByCustomer).map(([customerId, { customerName, orders }]) => {
                    const allSelected = orders.every(o => selectedOrders.includes(o.id));
                    const someSelected = orders.some(o => selectedOrders.includes(o.id));
                    const totalValue = orders.reduce((sum, o) => sum + o.total_xcg, 0);

                    return (
                      <div key={customerId} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={allSelected}
                              // @ts-ignore - indeterminate is valid
                              indeterminate={someSelected && !allSelected}
                              onCheckedChange={() => handleSelectAllForCustomer(customerId, orders)}
                            />
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{customerName}</span>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {orders.length} order{orders.length !== 1 ? 's' : ''} • XCG {totalValue.toFixed(2)}
                          </div>
                        </div>
                        <div className="space-y-2 ml-8">
                          {orders.map(order => (
                            <div 
                              key={order.id}
                              className={cn(
                                "flex items-center justify-between p-2 rounded-md border transition-colors",
                                selectedOrders.includes(order.id) ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={selectedOrders.includes(order.id)}
                                  onCheckedChange={() => handleSelectOrder(order.id, orders)}
                                />
                                <div>
                                  <span className="font-mono text-sm">{order.order_number}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {format(new Date(order.delivery_date), 'MMM d')}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-sm text-muted-foreground">
                                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                                </span>
                                <span className="font-medium">XCG {order.total_xcg.toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Draft Invoices Tab */}
        <TabsContent value="draft" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {loadingInvoices ? (
                <div className="text-center py-8">Loading...</div>
              ) : draftInvoices.length === 0 ? (
                renderEmptyState('No draft invoices')
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>QB #</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draftInvoices.map(renderInvoiceRow)}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Confirmed Invoices Tab */}
        <TabsContent value="confirmed" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {loadingInvoices ? (
                <div className="text-center py-8">Loading...</div>
              ) : confirmedInvoices.length === 0 ? (
                renderEmptyState('No confirmed invoices awaiting sync')
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>QB #</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {confirmedInvoices.map(renderInvoiceRow)}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Synced Invoices Tab */}
        <TabsContent value="synced" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {loadingInvoices ? (
                <div className="text-center py-8">Loading...</div>
              ) : syncedInvoices.length === 0 ? (
                renderEmptyState('No synced invoices yet')
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>QB #</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncedInvoices.map(renderInvoiceRow)}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Failed Invoices Tab */}
        <TabsContent value="failed" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {loadingInvoices ? (
                <div className="text-center py-8">Loading...</div>
              ) : failedInvoices.length === 0 ? (
                renderEmptyState('No failed syncs')
              ) : (
                <div className="space-y-4">
                  {failedInvoices.map(invoice => (
                    <div 
                      key={invoice.id}
                      className="border border-destructive/30 rounded-lg p-4 bg-destructive/5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{invoice.distribution_customers?.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(invoice.invoice_date), 'MMM d, yyyy')} • XCG {invoice.total_xcg.toFixed(2)}
                          </div>
                          {invoice.quickbooks_sync_error && (
                            <div className="text-sm text-destructive mt-1">
                              Error: {invoice.quickbooks_sync_error}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => syncToQuickBooks.mutate(invoice.id)}
                            disabled={syncToQuickBooks.isPending}
                          >
                            <RefreshCw className={cn("h-4 w-4 mr-2", syncToQuickBooks.isPending && "animate-spin")} />
                            Retry
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/distribution/invoices/${invoice.id}`)}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteInvoiceId} onOpenChange={() => setDeleteInvoiceId(null)}>
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
              onClick={() => {
                if (deleteInvoiceId) {
                  deleteInvoice.mutate(deleteInvoiceId);
                  setDeleteInvoiceId(null);
                }
              }}
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
