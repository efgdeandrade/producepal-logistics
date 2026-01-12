import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Package, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

interface ItemsOverviewTableProps {
  queueItems: QueueItem[];
  allOrderItems: OrderItem[];
  isLoading?: boolean;
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
}

export function ItemsOverviewTable({ queueItems, allOrderItems, isLoading }: ItemsOverviewTableProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(false);

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

      if (existing) {
        existing.totalOrdered += ordered;
        existing.orderCount += 1;
        existing.itemsTotal += 1;
        existing.itemsPicked += isPicked ? 1 : 0;
        existing.completionPercentage = existing.itemsTotal > 0 
          ? (existing.itemsPicked / existing.itemsTotal) * 100 
          : 0;
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
            {/* Toggle completed items */}
            <div className="flex justify-end mb-2">
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
                          <Badge variant="outline" className="text-xs">
                            {item.orderCount}
                          </Badge>
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
  );
}
