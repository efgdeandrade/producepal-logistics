import { useState, useEffect } from 'react';
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
      
      for (const receipt of savedReceipts) {
        const lineItems = await fetchReceiptLineItems(receipt.id);
        lineItems.forEach((li, idx) => {
          allItems.push({
            id: `receipt-${li.id}`,
            customer_name: receipt.customer_name,
            product_code: li.product_code,
            quantity: li.quantity,
          });
        });
      }
      
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
