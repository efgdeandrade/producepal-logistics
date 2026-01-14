import { useMemo, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Package, ChevronDown, ChevronUp, Eye, EyeOff, Printer, Download, Users, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import html2pdf from 'html2pdf.js';

interface QueueItem {
  id: string;
  order_id: string;
  status: string;
  fnb_orders?: {
    id: string;
    order_number: string;
    fnb_customers?: {
      name: string;
      delivery_zone?: string;
    };
  };
}

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  picked_quantity: number | null;
  picked_by: string | null;
  order_unit: string | null;
  fnb_products?: {
    id: string;
    code: string;
    name: string;
    unit: string;
  };
  fnb_orders?: {
    id: string;
    order_number: string;
    fnb_customers?: {
      name: string;
      delivery_zone?: string;
    };
  };
}

interface ItemsOverviewTableProps {
  queueItems: QueueItem[];
  allOrderItems: OrderItem[];
  isLoading?: boolean;
}

interface CustomerInfo {
  name: string;
  zone?: string;
  orderNumber: string;
  quantity: number;
  isPicked: boolean;
}

interface AggregatedItem {
  productId: string;
  productName: string;
  productCode: string;
  unit: string;
  totalOrdered: number;
  totalPicked: number;
  orderCount: number;
  itemsPicked: number;
  itemsTotal: number;
  completionPercentage: number;
  customers: CustomerInfo[];
}

export function ItemsOverviewTable({ queueItems, allOrderItems, isLoading }: ItemsOverviewTableProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isPrinting, setIsPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Aggregate items by product - count items picked (checkbox checked) vs total items
  const aggregatedItems = useMemo(() => {
    if (!allOrderItems || allOrderItems.length === 0) return [];

    const itemMap = new Map<string, AggregatedItem>();

    allOrderItems.forEach((item) => {
      const productId = item.product_id;
      const product = item.fnb_products;
      if (!productId || !product) return;

      const existing = itemMap.get(productId);
      const ordered = Number(item.quantity) || 0;
      const isPicked = item.picked_by !== null;
      
      // Extract customer info
      const customerInfo: CustomerInfo = {
        name: item.fnb_orders?.fnb_customers?.name || 'Unknown',
        zone: item.fnb_orders?.fnb_customers?.delivery_zone,
        orderNumber: item.fnb_orders?.order_number || '',
        quantity: ordered,
        isPicked,
      };

      if (existing) {
        existing.totalOrdered += ordered;
        existing.orderCount += 1;
        existing.itemsTotal += 1;
        existing.itemsPicked += isPicked ? 1 : 0;
        existing.completionPercentage = existing.itemsTotal > 0 
          ? (existing.itemsPicked / existing.itemsTotal) * 100 
          : 0;
        existing.customers.push(customerInfo);
      } else {
        itemMap.set(productId, {
          productId,
          productName: product.name,
          productCode: product.code,
          unit: item.order_unit || product.unit || 'pcs',
          totalOrdered: ordered,
          totalPicked: 0,
          orderCount: 1,
          itemsTotal: 1,
          itemsPicked: isPicked ? 1 : 0,
          completionPercentage: isPicked ? 100 : 0,
          customers: [customerInfo],
        });
      }
    });

    // Convert to array and sort by total ordered (descending)
    return Array.from(itemMap.values()).sort((a, b) => b.totalOrdered - a.totalOrdered);
  }, [allOrderItems]);

  // Filter out completed items if requested
  const displayedItems = useMemo(() => {
    if (!hideCompleted) return aggregatedItems;
    return aggregatedItems.filter((item) => item.completionPercentage < 100);
  }, [aggregatedItems, hideCompleted]);

  // Summary stats
  const stats = useMemo(() => {
    const total = aggregatedItems.length;
    const completed = aggregatedItems.filter((item) => item.completionPercentage >= 100).length;
    const totalOrders = queueItems?.length || 0;
    return { total, completed, totalOrders };
  }, [aggregatedItems, queueItems]);

  // Handle opening print dialog
  const handleOpenPrintDialog = () => {
    setSelectedItems(new Set(aggregatedItems.map(i => i.productId)));
    setShowPrintDialog(true);
  };

  // Handle PDF generation
  const handlePrintPDF = async () => {
    if (!printRef.current || selectedItems.size === 0) return;
    
    setIsPrinting(true);
    try {
      const opt = {
        margin: 5,
        filename: `picking-list-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: {
          unit: 'mm' as const,
          format: [80, 297] as [number, number],
          orientation: 'portrait' as const
        }
      };
      
      await html2pdf().set(opt).from(printRef.current).save();
      setShowPrintDialog(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  // Get items to print
  const itemsToPrint = useMemo(() => {
    return aggregatedItems.filter(item => selectedItems.has(item.productId));
  }, [aggregatedItems, selectedItems]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading items overview...
        </CardContent>
      </Card>
    );
  }

  if (aggregatedItems.length === 0) {
    return null;
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CardHeader className="py-3">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer hover:opacity-80">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Items Overview
                  <Badge variant="secondary" className="ml-1">
                    {stats.total} products
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground hidden sm:inline">
                    {stats.completed} complete • {stats.totalOrders} orders
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {/* Toggle completed items and Print button */}
              <div className="flex justify-end gap-2 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenPrintDialog}
                  className="text-xs h-7"
                >
                  <Printer className="h-3 w-3 mr-1" />
                  Print
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHideCompleted(!hideCompleted)}
                  className="text-xs h-7"
                >
                  {hideCompleted ? (
                    <>
                      <Eye className="h-3 w-3 mr-1" />
                      Show completed
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3 w-3 mr-1" />
                      Hide completed
                    </>
                  )}
                </Button>
              </div>

              <div className="max-h-[300px] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[40%]">Product</TableHead>
                      <TableHead className="text-right">Total Qty</TableHead>
                      <TableHead className="text-center">Orders</TableHead>
                      <TableHead className="w-[25%]">Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedItems.map((item) => {
                      const isComplete = item.completionPercentage >= 100;
                      const isPartial = item.completionPercentage > 0 && item.completionPercentage < 100;
                      
                      return (
                        <TableRow 
                          key={item.productId}
                          className={cn(
                            isComplete && 'bg-green-50 dark:bg-green-950/20',
                            isPartial && 'bg-amber-50 dark:bg-amber-950/20'
                          )}
                        >
                          <TableCell className="py-2">
                            <div className="font-medium text-sm truncate max-w-[200px]">
                              {item.productName}
                            </div>
                            <div className="text-xs text-muted-foreground">{item.productCode}</div>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <span className="font-semibold">{item.totalOrdered}</span>
                            <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <Badge variant="outline" className="text-xs cursor-help hover:bg-accent">
                                  {item.orderCount}
                                </Badge>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-72" side="left">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm font-medium border-b pb-2">
                                    <Users className="h-4 w-4" />
                                    Customers ({item.customers.length})
                                  </div>
                                  <div className="divide-y max-h-48 overflow-y-auto">
                                    {item.customers.map((customer, idx) => (
                                      <div key={idx} className="py-1.5 flex justify-between text-sm">
                                        <div>
                                          <div className="font-medium">{customer.name}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {customer.orderNumber} • {customer.zone || 'No zone'}
                                          </div>
                                        </div>
                                        <div className="text-right flex items-center gap-1">
                                          <span>{customer.quantity} {item.unit}</span>
                                          {customer.isPicked && (
                                            <Check className="h-3 w-3 text-green-600" />
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={Math.min(item.completionPercentage, 100)} 
                                className={cn(
                                  "h-2 flex-1",
                                  isComplete && "[&>div]:bg-green-500",
                                  isPartial && "[&>div]:bg-amber-500"
                                )}
                              />
                              <span className="text-xs w-10 text-right text-muted-foreground">
                                {Math.round(item.completionPercentage)}%
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {item.itemsPicked}/{item.itemsTotal} picked
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Print Dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Print Items Overview</DialogTitle>
          </DialogHeader>
          
          {/* Select/Deselect All */}
          <div className="flex items-center gap-2 pb-2 border-b">
            <Checkbox 
              checked={selectedItems.size === aggregatedItems.length}
              onCheckedChange={(checked) => {
                if (checked) {
                  setSelectedItems(new Set(aggregatedItems.map(i => i.productId)));
                } else {
                  setSelectedItems(new Set());
                }
              }}
            />
            <span className="text-sm">Select All ({selectedItems.size}/{aggregatedItems.length})</span>
          </div>
          
          {/* Item List with Checkboxes */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {aggregatedItems.map(item => (
              <div key={item.productId} className="flex items-center gap-2">
                <Checkbox
                  checked={selectedItems.has(item.productId)}
                  onCheckedChange={(checked) => {
                    const newSet = new Set(selectedItems);
                    if (checked) newSet.add(item.productId);
                    else newSet.delete(item.productId);
                    setSelectedItems(newSet);
                  }}
                />
                <span className="text-sm flex-1 truncate">{item.productName}</span>
                <span className="text-xs text-muted-foreground">
                  {item.totalOrdered} {item.unit}
                </span>
              </div>
            ))}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrintDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePrintPDF} disabled={selectedItems.size === 0 || isPrinting}>
              <Download className="h-4 w-4 mr-1" />
              {isPrinting ? 'Generating...' : 'Download PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden print template */}
      <div className="fixed left-[-9999px]">
        <div ref={printRef} className="p-6 bg-white text-black" style={{ width: '80mm' }}>
          <div className="text-center mb-4">
            <h1 className="text-lg font-bold">PICKING LIST</h1>
            <p className="text-sm">{format(new Date(), 'PPpp')}</p>
          </div>
          
          <div className="border-t border-b border-dashed py-2 mb-3">
            <p className="text-sm">Total Orders: {stats.totalOrders}</p>
            <p className="text-sm">Items Listed: {selectedItems.size}</p>
          </div>
          
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1">Item</th>
                <th className="text-right py-1">Qty</th>
                <th className="text-right py-1">Orders</th>
              </tr>
            </thead>
            <tbody>
              {itemsToPrint.map(item => (
                <tr key={item.productId} className="border-b border-dotted">
                  <td className="py-1">
                    <div className="font-medium">{item.productName}</div>
                    <div className="text-xs opacity-70">{item.productCode}</div>
                  </td>
                  <td className="text-right py-1">{item.totalOrdered} {item.unit}</td>
                  <td className="text-right py-1">{item.orderCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="mt-4 pt-2 border-t border-dashed text-center text-xs opacity-70">
            Generated by Distribution System
          </div>
        </div>
      </div>
    </>
  );
}
