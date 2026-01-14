import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, startOfDay } from 'date-fns';

interface TemplateItem {
  customer_id: string;
  product_id: string;
  default_quantity: number;
  default_price_xcg: number | null;
}

interface Template {
  id: string;
  day_of_week: number;
  template_name: string;
  is_active: boolean;
}

export function useFnbStandingOrdersSync() {
  // Track which dates we've already synced to avoid duplicate calls
  const syncedDatesRef = useRef<Set<string>>(new Set());

  const generateForDateRange = useCallback(async (startDate: Date, endDate: Date): Promise<number> => {
    try {
      // Get all active templates
      const { data: templates, error: templatesError } = await supabase
        .from('distribution_standing_order_templates')
        .select('id, day_of_week, template_name, is_active')
        .eq('is_active', true);

      if (templatesError) throw templatesError;
      if (!templates || templates.length === 0) return 0;

      // Get template items
      const templateIds = (templates as any[]).map(t => t.id);
      const { data: allItems, error: itemsError } = await supabase
        .from('distribution_standing_order_items')
        .select('template_id, customer_id, product_id, default_quantity, default_price_xcg')
        .in('template_id', templateIds);

      if (itemsError) throw itemsError;

      // Get product prices for fallback
      const productIds = [...new Set(((allItems || []) as any[]).map(i => i.product_id))];
      const { data: products } = await supabase
        .from('distribution_products')
        .select('id, price_xcg')
        .in('id', productIds);

      const productPrices = ((products || []) as any[]).reduce((acc, p) => {
        acc[p.id] = p.price_xcg;
        return acc;
      }, {} as Record<string, number>);

      let ordersCreated = 0;
      const today = startOfDay(new Date());

      // Iterate through each day in the range
      let currentDate = startOfDay(startDate);
      const endDateNormalized = startOfDay(endDate);

      while (currentDate <= endDateNormalized) {
        // Skip past dates
        if (currentDate < today) {
          currentDate = addDays(currentDate, 1);
          continue;
        }

        const dateStr = format(currentDate, 'yyyy-MM-dd');
        
        // Skip if already synced this session
        if (syncedDatesRef.current.has(dateStr)) {
          currentDate = addDays(currentDate, 1);
          continue;
        }

        // Get day of week (1 = Monday, 6 = Saturday, 0/7 = Sunday)
        const jsDay = currentDate.getDay();
        const dayOfWeek = jsDay === 0 ? 7 : jsDay; // Convert Sunday from 0 to 7

        // Find template for this day
        const template = (templates as any[]).find(t => t.day_of_week === dayOfWeek);
        if (!template) {
          syncedDatesRef.current.add(dateStr);
          currentDate = addDays(currentDate, 1);
          continue;
        }

        // Get items for this template
        const templateItems = ((allItems || []) as any[]).filter(i => i.template_id === template.id);
        if (templateItems.length === 0) {
          syncedDatesRef.current.add(dateStr);
          currentDate = addDays(currentDate, 1);
          continue;
        }

        // Group by customer
        const itemsByCustomer = templateItems.reduce((acc, item) => {
          if (!acc[item.customer_id]) {
            acc[item.customer_id] = [];
          }
          acc[item.customer_id].push(item);
          return acc;
        }, {} as Record<string, TemplateItem[]>);

        // Check which customers already have orders for this date
        const customerIds = Object.keys(itemsByCustomer);
        const { data: existingOrders } = await supabase
          .from('distribution_orders')
          .select('customer_id')
          .in('customer_id', customerIds)
          .eq('delivery_date', dateStr)
          .neq('status', 'cancelled');

        const existingCustomerIds = new Set(((existingOrders || []) as any[]).map(o => o.customer_id));

        // Create orders for customers that don't have one
        for (const [customerId, items] of Object.entries(itemsByCustomer)) {
          if (existingCustomerIds.has(customerId)) continue;

          // Generate order number
          const orderNumber = `FNB-${format(new Date(), 'yyyyMMddHHmmss')}-${String(Math.random()).slice(2, 5)}`;

          // Calculate total
          const typedItems = items as TemplateItem[];
          const total = typedItems.reduce((sum, item) => {
            const price = item.default_price_xcg ?? productPrices[item.product_id] ?? 0;
            return sum + (price * item.default_quantity);
          }, 0);

          // Create the order with template reference
          const { data: newOrder, error: orderError } = await supabase
            .from('distribution_orders')
            .insert({
              order_number: orderNumber,
              customer_id: customerId,
              order_date: format(new Date(), 'yyyy-MM-dd'),
              delivery_date: dateStr,
              status: 'pending',
              total_xcg: total,
              standing_order_template_id: template.id,
              notes: `Auto-generated from standing order: ${template.template_name}`,
            })
            .select()
            .single();

          if (orderError) {
            console.error('Error creating standing order:', orderError);
            continue;
          }

          // Create order items
          const typedItemsForOrder = items as TemplateItem[];
          const orderItems = typedItemsForOrder.map(item => ({
            order_id: (newOrder as any).id,
            product_id: item.product_id,
            quantity: item.default_quantity,
            unit_price_xcg: item.default_price_xcg ?? productPrices[item.product_id] ?? 0,
            total_xcg: (item.default_price_xcg ?? productPrices[item.product_id] ?? 0) * item.default_quantity,
          }));

          await supabase.from('distribution_order_items').insert(orderItems);
          ordersCreated++;
        }

        syncedDatesRef.current.add(dateStr);
        currentDate = addDays(currentDate, 1);
      }

      return ordersCreated;
    } catch (error) {
      console.error('Error syncing standing orders:', error);
      return 0;
    }
  }, []);

  // Clear sync cache (useful when template is edited)
  const clearSyncCache = useCallback(() => {
    syncedDatesRef.current.clear();
  }, []);

  return { generateForDateRange, clearSyncCache };
}
