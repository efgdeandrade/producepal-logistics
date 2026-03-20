import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CustomerPackingSlip } from '@/components/CustomerPackingSlip';
import { Badge } from '@/components/ui/badge';
import type { ReceiptVersion, ReceiptLineItem } from '@/hooks/useReceiptVersions';

interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
  po_number?: string;
  stock_quantity?: number | null;
}

interface Order {
  id: string;
  order_number: string;
  week_number: number;
  delivery_date: string;
  placed_by: string;
}

interface Props {
  order: Order;
  orderItems: OrderItem[];
  savedReceipts: ReceiptVersion[];
  format: 'a4' | 'receipt';
  fetchReceiptLineItems: (versionId: string) => Promise<ReceiptLineItem[]>;
}

/**
 * Renders packing slips using receipt data when receipts exist,
 * otherwise falls back to order items.
 */
export const PackingSlipFromReceipts = ({
  order,
  orderItems,
  savedReceipts,
  format,
  fetchReceiptLineItems,
}: Props) => {
  const [receiptItems, setReceiptItems] = useState<OrderItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (savedReceipts.length > 0) {
      loadReceiptItems();
    }
  }, [savedReceipts]);

  const loadReceiptItems = async () => {
    setLoading(true);
    try {
      const allItems: OrderItem[] = [];
      
      // Load original order_items to get stock_quantity for each customer+product
      const { data: originalOrderItems } = await supabase
        .from('order_items')
        .select('customer_name, product_code, quantity, stock_quantity')
        .eq('order_id', order.id);

      // Build a lookup map: "CUSTOMER_NAME:PRODUCT_CODE" → stock_quantity
      const stockQtyMap = new Map<string, number>();
      (originalOrderItems || []).forEach((oi: any) => {
        const key = `${oi.customer_name}:${oi.product_code}`;
        stockQtyMap.set(key, oi.stock_quantity ?? 0);
      });

      for (const receipt of savedReceipts) {
        const lineItems = await fetchReceiptLineItems(receipt.id);
        lineItems.forEach((li) => {
          const key = `${receipt.customer_name}:${li.product_code}`;
          const stockQty = stockQtyMap.get(key) ?? 0;
          allItems.push({
            id: `receipt-${li.id}`,
            customer_name: receipt.customer_name,
            product_code: li.product_code,
            quantity: li.quantity,
            stock_quantity: stockQty,
          });
        });
      }
      
      // Add stock-only items that have no receipt line item at all
      (originalOrderItems || []).forEach((oi: any) => {
        if ((oi.stock_quantity ?? 0) > 0 && (oi.quantity ?? 0) === 0) {
          const alreadyIncluded = allItems.some(
            item => item.customer_name === oi.customer_name &&
                     item.product_code === oi.product_code
          );
          if (!alreadyIncluded) {
            allItems.push({
              id: `stock-${oi.customer_name}-${oi.product_code}`,
              customer_name: oi.customer_name,
              product_code: oi.product_code,
              quantity: 0,
              stock_quantity: oi.stock_quantity,
            });
          }
        }
      });

      setReceiptItems(allItems);
    } catch (err) {
      console.error('Error loading receipt items for packing slips:', err);
      // Fall back to order items
      setReceiptItems(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading receipt data for packing slips...</div>;
  }

  const hasReceipts = savedReceipts.length > 0 && receiptItems;
  const itemsToUse = hasReceipts ? receiptItems : orderItems;

  return (
    <div>
      {hasReceipts && (
        <div className="mb-4 p-3 bg-muted rounded-lg flex items-center gap-2">
          <Badge variant="outline" className="text-xs">From Receipts</Badge>
          <span className="text-xs text-muted-foreground">
            Packing slips reflect the latest receipt data ({savedReceipts.length} receipt{savedReceipts.length !== 1 ? 's' : ''})
          </span>
        </div>
      )}
      <CustomerPackingSlip
        order={order}
        orderItems={itemsToUse}
        format={format}
      />
    </div>
  );
};
