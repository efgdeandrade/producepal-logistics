import { useQuery } from "@tanstack/react-query";
import { supabase } from "../integrations/supabase/client";

export interface OrderSuggestion {
  productId: string;
  productName: string;
  productCode: string;
  avgQuantity: number;
  orderCount: number;
  lastOrderedAt: string;
  suggestedPrice: number;
  suggestedUnit: string;
  source: 'pattern' | 'standing' | 'last_order';
}

export function useFnbOrderSuggestions(customerId: string | null) {
  // Fetch customer patterns
  const { data: patterns } = useQuery({
    queryKey: ['fnb-customer-patterns', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('fnb_customer_patterns')
        .select(`
          product_id,
          order_count,
          avg_quantity,
          last_ordered_at,
          fnb_products (
            id,
            name,
            code,
            price_xcg,
            unit
          )
        `)
        .eq('customer_id', customerId)
        .order('order_count', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
  });

  // Fetch standing order items for today
  const { data: standingItems } = useQuery({
    queryKey: ['fnb-standing-suggestions', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const dayOfWeek = new Date().getDay();
      
      const { data, error } = await supabase
        .from('fnb_standing_order_templates')
        .select(`
          id,
          fnb_standing_order_items (
            product_id,
            customer_id,
            default_quantity,
            default_price_xcg,
            fnb_products (
              id,
              name,
              code,
              price_xcg,
              unit
            )
          )
        `)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .single();
      
      if (error) return [];
      
      // Filter items for this customer
      return data?.fnb_standing_order_items?.filter(
        item => item.customer_id === customerId
      ) || [];
    },
    enabled: !!customerId,
  });

  // Fetch last order items
  const { data: lastOrderItems } = useQuery({
    queryKey: ['fnb-last-order', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      // Get the most recent order for this customer
      const { data: lastOrder, error: orderError } = await supabase
        .from('fnb_orders')
        .select('id')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (orderError || !lastOrder) return [];
      
      // Get items from that order
      const { data, error } = await supabase
        .from('fnb_order_items')
        .select(`
          product_id,
          quantity,
          unit_price_xcg,
          order_unit,
          fnb_products (
            id,
            name,
            code,
            price_xcg,
            unit
          )
        `)
        .eq('order_id', lastOrder.id);
      
      if (error) return [];
      return data || [];
    },
    enabled: !!customerId,
  });

  // Combine and deduplicate suggestions
  const suggestions: OrderSuggestion[] = [];
  const seenProducts = new Set<string>();

  // Add standing order items first (highest priority)
  standingItems?.forEach(item => {
    if (item.product_id && item.fnb_products && !seenProducts.has(item.product_id)) {
      seenProducts.add(item.product_id);
      suggestions.push({
        productId: item.product_id,
        productName: item.fnb_products.name,
        productCode: item.fnb_products.code,
        avgQuantity: Number(item.default_quantity),
        orderCount: 0,
        lastOrderedAt: '',
        suggestedPrice: Number(item.default_price_xcg) || Number(item.fnb_products.price_xcg) || 0,
        suggestedUnit: item.fnb_products.unit || 'pcs',
        source: 'standing',
      });
    }
  });

  // Add pattern-based suggestions
  patterns?.forEach(pattern => {
    if (pattern.product_id && pattern.fnb_products && !seenProducts.has(pattern.product_id)) {
      seenProducts.add(pattern.product_id);
      suggestions.push({
        productId: pattern.product_id,
        productName: pattern.fnb_products.name,
        productCode: pattern.fnb_products.code,
        avgQuantity: Math.round(Number(pattern.avg_quantity)),
        orderCount: pattern.order_count,
        lastOrderedAt: pattern.last_ordered_at,
        suggestedPrice: Number(pattern.fnb_products.price_xcg) || 0,
        suggestedUnit: pattern.fnb_products.unit || 'pcs',
        source: 'pattern',
      });
    }
  });

  // Function to get last order as suggestions
  const getLastOrderSuggestions = (): OrderSuggestion[] => {
    return (lastOrderItems || [])
      .filter(item => item.product_id && item.fnb_products)
      .map(item => ({
        productId: item.product_id!,
        productName: item.fnb_products!.name,
        productCode: item.fnb_products!.code,
        avgQuantity: Number(item.quantity),
        orderCount: 1,
        lastOrderedAt: '',
        suggestedPrice: Number(item.unit_price_xcg) || Number(item.fnb_products!.price_xcg) || 0,
        suggestedUnit: item.order_unit || item.fnb_products!.unit || 'pcs',
        source: 'last_order' as const,
      }));
  };

  return {
    suggestions: suggestions.slice(0, 8),
    lastOrderSuggestions: getLastOrderSuggestions(),
    hasStandingOrder: (standingItems?.length || 0) > 0,
    isLoading: false,
  };
}
