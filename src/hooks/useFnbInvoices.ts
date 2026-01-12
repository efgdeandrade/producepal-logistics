import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  order_item_id?: string;
  product_id?: string;
  product_name: string;
  description: string | null;
  quantity: number;
  unit_price_xcg: number;
  line_total_xcg: number;
  is_ob_eligible: boolean;
  ob_tax_inclusive: number;
}

export interface Invoice {
  id: string;
  status: 'draft' | 'confirmed' | 'synced' | 'failed';
  invoice_date: string;
  due_date: string;
  customer_id: string;
  subtotal_xcg: number;
  ob_tax_amount: number;
  total_xcg: number;
  notes: string | null;
  customer_memo: string | null;
  created_by: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  quickbooks_invoice_id: string | null;
  quickbooks_invoice_number: string | null;
  quickbooks_sync_status: 'pending' | 'synced' | 'failed';
  quickbooks_sync_error: string | null;
  quickbooks_synced_at: string | null;
  created_at: string;
  updated_at: string;
  fnb_customers?: {
    id: string;
    name: string;
    whatsapp_phone: string;
    address: string | null;
  };
  fnb_invoice_items?: InvoiceItem[];
  fnb_invoice_orders?: { order_id: string; fnb_orders?: { order_number: string } }[];
}

export interface ReadyOrder {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  total_xcg: number;
  delivery_date: string;
  status: string;
  items: {
    id: string;
    product_id: string;
    product_name: string;
    product_code: string;
    quantity: number;
    picked_quantity: number | null;
    unit_price_xcg: number;
    is_ob_eligible: boolean;
  }[];
}

// Calculate O.B. tax (6% inclusive)
export function calculateOBTax(lineTotal: number): number {
  return Number((lineTotal * (6 / 106)).toFixed(2));
}

export function useFnbInvoices() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch all invoices with optional status filter
  const useInvoices = (statusFilter?: string) => {
    return useQuery({
      queryKey: ['fnb-invoices', statusFilter],
      queryFn: async () => {
        let query = supabase
          .from('fnb_invoices')
          .select(`
            *,
            fnb_customers (id, name, whatsapp_phone, address),
            fnb_invoice_items (*),
            fnb_invoice_orders (order_id, fnb_orders (order_number))
          `)
          .order('created_at', { ascending: false });

        if (statusFilter && statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as Invoice[];
      },
    });
  };

  // Fetch single invoice by ID
  const useInvoice = (invoiceId: string | undefined) => {
    return useQuery({
      queryKey: ['fnb-invoice', invoiceId],
      queryFn: async () => {
        if (!invoiceId) return null;

        const { data, error } = await supabase
          .from('fnb_invoices')
          .select(`
            *,
            fnb_customers (id, name, whatsapp_phone, address),
            fnb_invoice_items (*),
            fnb_invoice_orders (order_id, fnb_orders (order_number))
          `)
          .eq('id', invoiceId)
          .single();

        if (error) throw error;
        return data as Invoice;
      },
      enabled: !!invoiceId,
    });
  };

  // Fetch orders ready for invoicing (status = 'ready' and no invoice_id)
  const useReadyOrders = () => {
    return useQuery({
      queryKey: ['fnb-orders-ready-for-invoice'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('fnb_orders')
          .select(`
            id,
            order_number,
            customer_id,
            total_xcg,
            delivery_date,
            status,
            fnb_customers (name),
            fnb_order_items (
              id,
              quantity,
              picked_quantity,
              unit_price_xcg,
              fnb_products (id, name, code, is_ob_eligible)
            )
          `)
          .eq('status', 'ready')
          .is('invoice_id', null)
          .order('delivery_date', { ascending: true });

        if (error) throw error;

        return (data || []).map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          customer_id: order.customer_id,
          customer_name: order.fnb_customers?.name || 'Unknown',
          total_xcg: order.total_xcg || 0,
          delivery_date: order.delivery_date,
          status: order.status,
          items: (order.fnb_order_items || []).map((item: any) => ({
            id: item.id,
            product_id: item.fnb_products?.id,
            product_name: item.fnb_products?.name || 'Unknown',
            product_code: item.fnb_products?.code || '',
            quantity: item.quantity,
            picked_quantity: item.picked_quantity,
            unit_price_xcg: item.unit_price_xcg,
            is_ob_eligible: item.fnb_products?.is_ob_eligible || false,
          })),
        })) as ReadyOrder[];
      },
    });
  };

  // Create invoice from selected orders
  const createInvoice = useMutation({
    mutationFn: async (orderIds: string[]) => {
      if (orderIds.length === 0) throw new Error('No orders selected');

      // Get order details
      const { data: orders, error: ordersError } = await supabase
        .from('fnb_orders')
        .select(`
          id,
          order_number,
          customer_id,
          fnb_order_items (
            id,
            quantity,
            picked_quantity,
            unit_price_xcg,
            fnb_products (id, name, code, is_ob_eligible)
          )
        `)
        .in('id', orderIds);

      if (ordersError) throw ordersError;
      if (!orders || orders.length === 0) throw new Error('Orders not found');

      // Validate all orders are for the same customer
      const customerIds = [...new Set(orders.map((o: any) => o.customer_id))];
      if (customerIds.length > 1) {
        throw new Error('All orders must be for the same customer');
      }

      const customerId = customerIds[0];
      const orderNumbers = orders.map((o: any) => o.order_number);
      const customerMemo = orderNumbers.length === 1
        ? `Order: ${orderNumbers[0]}`
        : `Orders: ${orderNumbers.join(', ')}`;

      // Build invoice items from order items
      const invoiceItems: Omit<InvoiceItem, 'id' | 'invoice_id'>[] = [];
      
      orders.forEach((order: any) => {
        (order.fnb_order_items || []).forEach((item: any) => {
          const qty = item.picked_quantity ?? item.quantity;
          const lineTotal = Number((qty * item.unit_price_xcg).toFixed(2));
          const isOBEligible = item.fnb_products?.is_ob_eligible || false;
          
          invoiceItems.push({
            order_item_id: item.id,
            product_id: item.fnb_products?.id,
            product_name: item.fnb_products?.name || 'Unknown Product',
            description: null,
            quantity: qty,
            unit_price_xcg: item.unit_price_xcg,
            line_total_xcg: lineTotal,
            is_ob_eligible: isOBEligible,
            ob_tax_inclusive: isOBEligible ? calculateOBTax(lineTotal) : 0,
          });
        });
      });

      // Calculate totals
      const subtotal = invoiceItems.reduce((sum, item) => sum + item.line_total_xcg, 0);
      const obTaxAmount = invoiceItems.reduce((sum, item) => sum + item.ob_tax_inclusive, 0);
      const today = new Date();
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + 7);

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('fnb_invoices')
        .insert({
          status: 'draft',
          invoice_date: today.toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
          customer_id: customerId,
          subtotal_xcg: Number(subtotal.toFixed(2)),
          ob_tax_amount: Number(obTaxAmount.toFixed(2)),
          total_xcg: Number(subtotal.toFixed(2)),
          customer_memo: customerMemo,
          created_by: user?.id,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const itemsToInsert = invoiceItems.map((item) => ({
        ...item,
        invoice_id: invoice.id,
      }));

      const { error: itemsError } = await supabase
        .from('fnb_invoice_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Link orders to invoice
      const orderLinks = orderIds.map((orderId) => ({
        invoice_id: invoice.id,
        order_id: orderId,
      }));

      const { error: linkError } = await supabase
        .from('fnb_invoice_orders')
        .insert(orderLinks);

      if (linkError) throw linkError;

      // Update orders with invoice_id
      const { error: updateError } = await supabase
        .from('fnb_orders')
        .update({ invoice_id: invoice.id })
        .in('id', orderIds);

      if (updateError) throw updateError;

      // Log activity
      await supabase.from('fnb_invoice_activity').insert({
        invoice_id: invoice.id,
        action: 'created',
        details: { order_ids: orderIds, order_numbers: orderNumbers },
        performed_by: user?.id,
      });

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-orders-ready-for-invoice'] });
      toast.success('Invoice created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create invoice');
    },
  });

  // Update invoice
  const updateInvoice = useMutation({
    mutationFn: async ({
      invoiceId,
      updates,
      items,
    }: {
      invoiceId: string;
      updates: Partial<Invoice>;
      items?: InvoiceItem[];
    }) => {
      // Recalculate totals if items provided
      if (items) {
        const subtotal = items.reduce((sum, item) => sum + item.line_total_xcg, 0);
        const obTaxAmount = items.reduce((sum, item) => sum + item.ob_tax_inclusive, 0);
        updates.subtotal_xcg = Number(subtotal.toFixed(2));
        updates.ob_tax_amount = Number(obTaxAmount.toFixed(2));
        updates.total_xcg = Number(subtotal.toFixed(2));
      }

      const { error: updateError } = await supabase
        .from('fnb_invoices')
        .update(updates)
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      // Update items if provided
      if (items) {
        // Delete existing items and re-insert
        await supabase.from('fnb_invoice_items').delete().eq('invoice_id', invoiceId);
        
        const itemsToInsert = items.map((item) => ({
          ...item,
          id: undefined,
          invoice_id: invoiceId,
        }));

        const { error: itemsError } = await supabase
          .from('fnb_invoice_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Log activity
      await supabase.from('fnb_invoice_activity').insert({
        invoice_id: invoiceId,
        action: 'updated',
        details: { updates: Object.keys(updates) },
        performed_by: user?.id,
      });
    },
    onSuccess: (_, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: ['fnb-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-invoice', invoiceId] });
      toast.success('Invoice updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update invoice');
    },
  });

  // Confirm invoice (ready for QB sync)
  const confirmInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from('fnb_invoices')
        .update({
          status: 'confirmed',
          confirmed_by: user?.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) throw error;

      await supabase.from('fnb_invoice_activity').insert({
        invoice_id: invoiceId,
        action: 'confirmed',
        performed_by: user?.id,
      });
    },
    onSuccess: (_, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['fnb-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-invoice', invoiceId] });
      toast.success('Invoice confirmed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to confirm invoice');
    },
  });

  // Delete draft invoice
  const deleteInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      // Get linked order IDs first
      const { data: links } = await supabase
        .from('fnb_invoice_orders')
        .select('order_id')
        .eq('invoice_id', invoiceId);

      const orderIds = (links || []).map((l) => l.order_id);

      // Clear invoice_id from orders
      if (orderIds.length > 0) {
        await supabase
          .from('fnb_orders')
          .update({ invoice_id: null })
          .in('id', orderIds);
      }

      // Delete invoice (cascade will handle items, orders, activity)
      const { error } = await supabase
        .from('fnb_invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-orders-ready-for-invoice'] });
      toast.success('Invoice deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete invoice');
    },
  });

  // Push to QuickBooks
  const syncToQuickBooks = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.functions.invoke('quickbooks-invoice-sync', {
        body: { invoice_id: invoiceId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['fnb-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-invoice', invoiceId] });
      if (data?.quickbooks_invoice_number) {
        toast.success(`Synced to QuickBooks: ${data.quickbooks_invoice_number}`);
      } else {
        toast.success('Synced to QuickBooks');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to sync to QuickBooks');
    },
  });

  return {
    useInvoices,
    useInvoice,
    useReadyOrders,
    createInvoice,
    updateInvoice,
    confirmInvoice,
    deleteInvoice,
    syncToQuickBooks,
  };
}
