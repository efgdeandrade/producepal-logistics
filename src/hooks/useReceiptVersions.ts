import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ReceiptVersion {
  id: string;
  receipt_number: string;
  order_id: string;
  customer_id: string | null;
  customer_name: string;
  order_number: string;
  version_number: number;
  amount: number;
  delivery_date: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  is_current: boolean;
}

export interface ReceiptLineItem {
  id: string;
  receipt_version_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
  created_at: string;
}

export interface SaveReceiptVersionInput {
  receiptNumber: string;
  orderId: string;
  customerId?: string | null;
  customerName: string;
  orderNumber: string;
  amount: number;
  deliveryDate?: string;
  notes?: string;
  items: Array<{
    product_code: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    sort_order: number;
  }>;
}

export function useReceiptVersions(orderId: string | undefined) {
  const [savedReceipts, setSavedReceipts] = useState<ReceiptVersion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSavedReceipts = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('receipt_versions')
        .select('*')
        .eq('order_id', orderId)
        .eq('is_current', true)
        .order('customer_name');

      if (error) throw error;
      setSavedReceipts((data as ReceiptVersion[]) || []);
    } catch (err) {
      console.error('Error fetching saved receipts:', err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const fetchReceiptHistory = useCallback(async (receiptNumber: string) => {
    const { data, error } = await supabase
      .from('receipt_versions')
      .select('*')
      .eq('receipt_number', receiptNumber)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return (data as ReceiptVersion[]) || [];
  }, []);

  const fetchReceiptLineItems = useCallback(async (versionId: string) => {
    const { data, error } = await supabase
      .from('receipt_line_items')
      .select('*')
      .eq('receipt_version_id', versionId)
      .order('sort_order');

    if (error) throw error;
    return (data as ReceiptLineItem[]) || [];
  }, []);

  const saveReceiptVersion = useCallback(async (input: SaveReceiptVersionInput) => {
    const user = (await supabase.auth.getUser()).data.user;

    // Check if a version already exists for this receipt number
    const { data: existing } = await supabase
      .from('receipt_versions')
      .select('version_number')
      .eq('receipt_number', input.receiptNumber)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = existing && existing.length > 0 ? existing[0].version_number + 1 : 1;

    // Mark all previous versions as not current
    if (nextVersion > 1) {
      await supabase
        .from('receipt_versions')
        .update({ is_current: false })
        .eq('receipt_number', input.receiptNumber);
    }

    // Insert new version
    const { data: version, error: versionError } = await supabase
      .from('receipt_versions')
      .insert({
        receipt_number: input.receiptNumber,
        order_id: input.orderId,
        customer_id: input.customerId || null,
        customer_name: input.customerName,
        order_number: input.orderNumber,
        version_number: nextVersion,
        amount: input.amount,
        delivery_date: input.deliveryDate || null,
        notes: input.notes || null,
        created_by: user?.id || null,
        is_current: true,
      })
      .select()
      .single();

    if (versionError) throw versionError;

    // Insert line items
    if (input.items.length > 0) {
      const lineItems = input.items.map((item, idx) => ({
        receipt_version_id: version.id,
        product_code: item.product_code,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        sort_order: item.sort_order ?? idx,
      }));

      const { error: itemsError } = await supabase
        .from('receipt_line_items')
        .insert(lineItems);

      if (itemsError) throw itemsError;
    }

    return version as ReceiptVersion;
  }, []);

  return {
    savedReceipts,
    loading,
    fetchSavedReceipts,
    fetchReceiptHistory,
    fetchReceiptLineItems,
    saveReceiptVersion,
  };
}
