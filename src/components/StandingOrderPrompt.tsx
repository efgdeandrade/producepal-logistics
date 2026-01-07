import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Calendar, Copy, FileText, Plus, Users, Package } from 'lucide-react';
import { useStandingOrders, DayTemplate } from '../hooks/useStandingOrders';
import { supabase } from '../integrations/supabase/client';
import { ScrollArea } from './ui/scroll-area';

interface CustomerOrderData {
  customerId: string;
  customerName: string;
  products: Array<{
    productCode: string;
    quantity: number;
  }>;
}

interface StandingOrderPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryDate: string;
  onLoadStandingOrder: (data: CustomerOrderData[]) => void;
  onCloneLastOrder: (data: CustomerOrderData[]) => void;
  onStartFresh: () => void;
}

export function StandingOrderPrompt({
  open,
  onOpenChange,
  deliveryDate,
  onLoadStandingOrder,
  onCloneLastOrder,
  onStartFresh,
}: StandingOrderPromptProps) {
  const { templates, loading: templatesLoading, getLastOrderForDay, DAY_NAMES } = useStandingOrders();
  const [lastOrderInfo, setLastOrderInfo] = useState<{ orderNumber: string; date: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const dayOfWeek = new Date(deliveryDate + 'T00:00:00').getDay();
  const dayName = DAY_NAMES[dayOfWeek];

  // Filter to only active templates with items
  const availableTemplates = templates.filter(t => t.is_active && (t.items?.length ?? 0) > 0);

  useEffect(() => {
    if (open && deliveryDate) {
      checkLastOrder();
    }
  }, [open, deliveryDate]);

  const checkLastOrder = async () => {
    setLoading(true);
    const lastOrder = await getLastOrderForDay(dayOfWeek);
    if (lastOrder) {
      setLastOrderInfo({
        orderNumber: lastOrder.order.order_number,
        date: lastOrder.order.delivery_date,
      });
    } else {
      setLastOrderInfo(null);
    }
    setLoading(false);
  };

  const getTemplateStats = (template: DayTemplate) => {
    const items = template.items || [];
    const uniqueCustomers = new Set(items.map(i => i.customer_id)).size;
    const totalProducts = items.length;
    return { uniqueCustomers, totalProducts };
  };

  const handleLoadTemplate = (template: DayTemplate) => {
    if (!template.items) return;

    // Group items by customer
    const customerMap = new Map<string, CustomerOrderData>();
    
    template.items.forEach(item => {
      const existing = customerMap.get(item.customer_id);
      if (existing) {
        existing.products.push({
          productCode: item.product_code,
          quantity: item.default_quantity,
        });
      } else {
        customerMap.set(item.customer_id, {
          customerId: item.customer_id,
          customerName: item.customer_name,
          products: [{
            productCode: item.product_code,
            quantity: item.default_quantity,
          }],
        });
      }
    });

    onLoadStandingOrder(Array.from(customerMap.values()));
    onOpenChange(false);
  };

  const handleCloneLastOrder = async () => {
    const lastOrder = await getLastOrderForDay(dayOfWeek);
    if (!lastOrder) return;

    // Get customer IDs from names
    const customerNames = [...new Set(lastOrder.items.map(item => item.customer_name))];
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name')
      .in('name', customerNames);

    const customerMap = new Map(customers?.map(c => [c.name, c.id]) || []);

    // Group items by customer
    const orderDataMap = new Map<string, CustomerOrderData>();
    
    lastOrder.items.forEach(item => {
      const customerId = customerMap.get(item.customer_name);
      if (!customerId) return;

      const existing = orderDataMap.get(customerId);
      if (existing) {
        existing.products.push({
          productCode: item.product_code,
          quantity: item.quantity,
        });
      } else {
        orderDataMap.set(customerId, {
          customerId,
          customerName: item.customer_name,
          products: [{
            productCode: item.product_code,
            quantity: item.quantity,
          }],
        });
      }
    });

    onCloneLastOrder(Array.from(orderDataMap.values()));
    onOpenChange(false);
  };

  const handleStartFresh = () => {
    onStartFresh();
    onOpenChange(false);
  };

  const isLoading = loading || templatesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Starting a New Order
          </DialogTitle>
          <DialogDescription>
            How would you like to start this order for {dayName}?
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading options...
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-4">
            {/* Standing Order Templates Section */}
            {availableTemplates.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Load from Standing Order
                </p>
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-2 pr-4">
                    {availableTemplates.map((template) => {
                      const stats = getTemplateStats(template);
                      return (
                        <Button
                          key={template.id}
                          variant="outline"
                          className="w-full justify-start h-auto py-3 px-4"
                          onClick={() => handleLoadTemplate(template)}
                        >
                          <div className="flex items-start justify-between w-full gap-3">
                            <div className="text-left flex-1">
                              <div className="font-semibold">{template.name}</div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {stats.uniqueCustomers} customers
                                </span>
                                <span className="flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  {stats.totalProducts} products
                                </span>
                              </div>
                            </div>
                            <Badge variant="secondary" className="shrink-0">
                              {DAY_NAMES[template.day_of_week]}
                            </Badge>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Clone from Last Order */}
            {lastOrderInfo && (
              <Button
                variant="outline"
                className="justify-start h-auto py-4"
                onClick={handleCloneLastOrder}
              >
                <Copy className="mr-3 h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Clone from Last {dayName}</div>
                  <div className="text-xs text-muted-foreground">
                    Copy from {lastOrderInfo.orderNumber} ({lastOrderInfo.date})
                  </div>
                </div>
              </Button>
            )}

            {/* Start Fresh */}
            <Button
              variant="ghost"
              className="justify-start h-auto py-4"
              onClick={handleStartFresh}
            >
              <Plus className="mr-3 h-5 w-5" />
              <div className="text-left">
                <div className="font-semibold">Start Fresh</div>
                <div className="text-xs text-muted-foreground">
                  Create a new order from scratch
                </div>
              </div>
            </Button>

            {/* No options message */}
            {availableTemplates.length === 0 && !lastOrderInfo && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No standing order templates or previous orders found.
                <br />
                You can create templates from the Standing Orders page.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
