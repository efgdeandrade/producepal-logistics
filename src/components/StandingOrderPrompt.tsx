import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, Copy, FileText, Plus } from 'lucide-react';
import { useStandingOrders } from '@/hooks/useStandingOrders';
import { supabase } from '@/integrations/supabase/client';

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
  const { getTemplateForDay, getLastOrderForDay, DAY_NAMES } = useStandingOrders();
  const [hasStandingOrder, setHasStandingOrder] = useState(false);
  const [lastOrderInfo, setLastOrderInfo] = useState<{ orderNumber: string; date: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const dayOfWeek = new Date(deliveryDate + 'T00:00:00').getDay();
  const dayName = DAY_NAMES[dayOfWeek];

  useEffect(() => {
    if (open && deliveryDate) {
      checkAvailableOptions();
    }
  }, [open, deliveryDate]);

  const checkAvailableOptions = async () => {
    setLoading(true);
    
    // Check for standing order template
    const template = getTemplateForDay(dayOfWeek);
    setHasStandingOrder(!!template && (template.items?.length ?? 0) > 0);

    // Check for last order on this day
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

  const handleLoadStandingOrder = async () => {
    const template = getTemplateForDay(dayOfWeek);
    if (!template || !template.items) return;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            It's a {dayName}!
          </DialogTitle>
          <DialogDescription>
            How would you like to start this order?
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Checking available options...
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-4">
            {hasStandingOrder && (
              <Button
                variant="default"
                className="justify-start h-auto py-4"
                onClick={handleLoadStandingOrder}
              >
                <FileText className="mr-3 h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Load Standing Order</div>
                  <div className="text-xs opacity-80">
                    Use your saved {dayName} template
                  </div>
                </div>
              </Button>
            )}

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

            {!hasStandingOrder && !lastOrderInfo && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No standing order or previous {dayName} orders found.
                <br />
                You can create a standing order template from Settings.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
