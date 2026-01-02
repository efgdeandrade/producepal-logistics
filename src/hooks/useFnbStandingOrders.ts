import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfWeek, addDays, parseISO, isBefore, startOfDay } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

// Helper function to get the next occurrence of a weekday
function getNextOccurrence(dayOfWeek: number): Date {
  const today = startOfDay(new Date());
  const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Convert our day_of_week (1 = Monday, 6 = Saturday) to JS day (0 = Sunday)
  const targetJsDay = dayOfWeek === 7 ? 0 : dayOfWeek; // Handle Sunday if needed
  
  let daysToAdd = targetJsDay - currentDayOfWeek;
  
  // If today is that day or it's in the past, go to next week
  if (daysToAdd <= 0) {
    daysToAdd += 7;
  }
  
  return addDays(today, daysToAdd);
}

export interface StandingOrderItem {
  id: string;
  template_id: string;
  customer_id: string;
  product_id: string;
  default_quantity: number;
  default_price_xcg: number | null;
  sort_order: number;
  customer?: {
    id: string;
    name: string;
    whatsapp_phone: string;
  };
  product?: {
    id: string;
    code: string;
    name: string;
    price_xcg: number;
    unit: string;
  };
}

export interface StandingOrderTemplate {
  id: string;
  day_of_week: number; // 1 = Monday, 6 = Saturday
  template_name: string;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items: StandingOrderItem[];
}

interface TemplateItemInput {
  customer_id: string;
  product_id: string;
  default_quantity: number;
  default_price_xcg?: number | null;
  sort_order?: number;
}

export function useFnbStandingOrders() {
  const [templates, setTemplates] = useState<StandingOrderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      
      // Fetch templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('fnb_standing_order_templates')
        .select('*')
        .order('day_of_week', { ascending: true });

      if (templatesError) throw templatesError;

      // Fetch items with customer and product details
      const { data: itemsData, error: itemsError } = await supabase
        .from('fnb_standing_order_items')
        .select(`
          *,
          fnb_customers(id, name, whatsapp_phone),
          fnb_products(id, code, name, price_xcg, unit)
        `)
        .order('sort_order', { ascending: true });

      if (itemsError) throw itemsError;

      // Combine templates with their items
      const templatesWithItems: StandingOrderTemplate[] = (templatesData || []).map(template => ({
        ...template,
        items: (itemsData || [])
          .filter(item => item.template_id === template.id)
          .map(item => ({
            ...item,
            customer: item.fnb_customers,
            product: item.fnb_products,
          })),
      }));

      setTemplates(templatesWithItems);
    } catch (error: any) {
      console.error('Error fetching standing order templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load standing order templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const getTemplateForDay = (dayOfWeek: number): StandingOrderTemplate | undefined => {
    return templates.find(t => t.day_of_week === dayOfWeek && t.is_active);
  };

  const createOrUpdateTemplate = async (
    dayOfWeek: number,
    name: string,
    items: TemplateItemInput[],
    notes?: string
  ): Promise<boolean> => {
    try {
      const existingTemplate = templates.find(t => t.day_of_week === dayOfWeek);

      let templateId: string;

      if (existingTemplate) {
        // Update existing template
        const { error: updateError } = await supabase
          .from('fnb_standing_order_templates')
          .update({
            template_name: name,
            notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingTemplate.id);

        if (updateError) throw updateError;
        templateId = existingTemplate.id;

        // Delete existing items
        const { error: deleteError } = await supabase
          .from('fnb_standing_order_items')
          .delete()
          .eq('template_id', templateId);

        if (deleteError) throw deleteError;
      } else {
        // Create new template
        const { data: newTemplate, error: createError } = await supabase
          .from('fnb_standing_order_templates')
          .insert({
            day_of_week: dayOfWeek,
            template_name: name,
            notes,
            created_by: user?.id,
          })
          .select()
          .single();

        if (createError) throw createError;
        templateId = newTemplate.id;
      }

      // Insert items
      if (items.length > 0) {
        const itemsToInsert = items.map((item, index) => ({
          template_id: templateId,
          customer_id: item.customer_id,
          product_id: item.product_id,
          default_quantity: item.default_quantity,
          default_price_xcg: item.default_price_xcg,
          sort_order: item.sort_order ?? index,
        }));

        const { error: itemsError } = await supabase
          .from('fnb_standing_order_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Auto-generate orders for the next occurrence of this weekday
      let ordersCreated = 0;
      if (items.length > 0) {
        const nextDate = getNextOccurrence(dayOfWeek);
        const nextDateStr = format(nextDate, 'yyyy-MM-dd');

        // Group items by customer
        const itemsByCustomer = items.reduce((acc, item) => {
          if (!acc[item.customer_id]) {
            acc[item.customer_id] = [];
          }
          acc[item.customer_id].push(item);
          return acc;
        }, {} as Record<string, TemplateItemInput[]>);

        // Fetch product details for pricing
        const productIds = [...new Set(items.map(i => i.product_id))];
        const { data: products } = await supabase
          .from('fnb_products')
          .select('id, price_xcg')
          .in('id', productIds);

        const productPrices = (products || []).reduce((acc, p) => {
          acc[p.id] = p.price_xcg;
          return acc;
        }, {} as Record<string, number>);

        // Create an order for each customer
        for (const [customerId, customerItems] of Object.entries(itemsByCustomer)) {
          // Check if order already exists for this customer on this date
          const { data: existingOrder } = await supabase
            .from('fnb_orders')
            .select('id')
            .eq('customer_id', customerId)
            .eq('delivery_date', nextDateStr)
            .neq('status', 'cancelled')
            .maybeSingle();

          if (existingOrder) {
            continue; // Skip - order already exists
          }

          // Generate order number
          const orderNumber = `FNB-${format(new Date(), 'yyyyMMddHHmmss')}-${String(ordersCreated + 1).padStart(3, '0')}`;

          // Calculate total
          const total = customerItems.reduce((sum, item) => {
            const price = item.default_price_xcg ?? productPrices[item.product_id] ?? 0;
            return sum + (price * item.default_quantity);
          }, 0);

          // Create the order
          const { data: newOrder, error: orderError } = await supabase
            .from('fnb_orders')
            .insert({
              order_number: orderNumber,
              customer_id: customerId,
              order_date: format(new Date(), 'yyyy-MM-dd'),
              delivery_date: nextDateStr,
              status: 'pending',
              total_xcg: total,
              notes: `Auto-generated from standing order: ${name}`,
            })
            .select()
            .single();

          if (orderError) throw orderError;

          // Create order items
          const orderItemsToInsert = customerItems.map(item => ({
            order_id: newOrder.id,
            product_id: item.product_id,
            quantity: item.default_quantity,
            unit_price_xcg: item.default_price_xcg ?? productPrices[item.product_id] ?? 0,
            total_xcg: (item.default_price_xcg ?? productPrices[item.product_id] ?? 0) * item.default_quantity,
          }));

          const { error: orderItemsError } = await supabase
            .from('fnb_order_items')
            .insert(orderItemsToInsert);

          if (orderItemsError) throw orderItemsError;

          ordersCreated++;
        }
      }

      const dayName = getDayName(dayOfWeek);
      if (ordersCreated > 0) {
        toast({
          title: 'Success',
          description: `Standing order saved and ${ordersCreated} order(s) created for next ${dayName}`,
        });
      } else {
        toast({
          title: 'Success',
          description: `Standing order template saved for ${dayName}`,
        });
      }

      await fetchTemplates();
      return true;
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: 'Error',
        description: 'Failed to save standing order template',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteTemplate = async (templateId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('fnb_standing_order_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Standing order template deleted',
      });

      await fetchTemplates();
      return true;
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        variant: 'destructive',
      });
      return false;
    }
  };

  const generateOrdersForWeek = async (weekStart: Date): Promise<number> => {
    try {
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');

      // Check if week already generated
      const { data: existingGeneration } = await supabase
        .from('fnb_week_generations')
        .select('*')
        .eq('week_start_date', weekStartStr)
        .single();

      if (existingGeneration) {
        toast({
          title: 'Already Generated',
          description: `Orders for week of ${format(weekStart, 'MMM d')} were already generated on ${format(parseISO(existingGeneration.generated_at), 'MMM d, h:mm a')}`,
        });
        return 0;
      }

      // Get all active templates with items
      const activeTemplates = templates.filter(t => t.is_active && t.items.length > 0);

      if (activeTemplates.length === 0) {
        toast({
          title: 'No Templates',
          description: 'No active standing order templates found. Please set up templates first.',
          variant: 'destructive',
        });
        return 0;
      }

      let ordersCreated = 0;

      for (const template of activeTemplates) {
        // Calculate the delivery date for this day of week
        const deliveryDate = addDays(weekStart, template.day_of_week - 1); // day_of_week 1 = Monday = weekStart
        const deliveryDateStr = format(deliveryDate, 'yyyy-MM-dd');

        // Group items by customer
        const itemsByCustomer = template.items.reduce((acc, item) => {
          if (!acc[item.customer_id]) {
            acc[item.customer_id] = [];
          }
          acc[item.customer_id].push(item);
          return acc;
        }, {} as Record<string, StandingOrderItem[]>);

        // Create an order for each customer
        for (const [customerId, customerItems] of Object.entries(itemsByCustomer)) {
          // Check if order already exists for this customer on this date
          const { data: existingOrder } = await supabase
            .from('fnb_orders')
            .select('id')
            .eq('customer_id', customerId)
            .eq('delivery_date', deliveryDateStr)
            .neq('status', 'cancelled')
            .single();

          if (existingOrder) {
            continue; // Skip - order already exists
          }

          // Generate order number
          const orderNumber = `FNB-${format(new Date(), 'yyyyMMdd')}-${String(ordersCreated + 1).padStart(3, '0')}`;

          // Calculate total
          const total = customerItems.reduce((sum, item) => {
            const price = item.default_price_xcg ?? item.product?.price_xcg ?? 0;
            return sum + (price * item.default_quantity);
          }, 0);

          // Create the order
          const { data: newOrder, error: orderError } = await supabase
            .from('fnb_orders')
            .insert({
              order_number: orderNumber,
              customer_id: customerId,
              order_date: format(new Date(), 'yyyy-MM-dd'),
              delivery_date: deliveryDateStr,
              status: 'pending',
              total_xcg: total,
              notes: `Auto-generated from standing order: ${template.template_name}`,
            })
            .select()
            .single();

          if (orderError) throw orderError;

          // Create order items
          const orderItems = customerItems.map(item => ({
            order_id: newOrder.id,
            product_id: item.product_id,
            quantity: item.default_quantity,
            unit_price_xcg: item.default_price_xcg ?? item.product?.price_xcg ?? 0,
            total_xcg: (item.default_price_xcg ?? item.product?.price_xcg ?? 0) * item.default_quantity,
          }));

          const { error: itemsError } = await supabase
            .from('fnb_order_items')
            .insert(orderItems);

          if (itemsError) throw itemsError;

          ordersCreated++;
        }
      }

      // Record the generation
      await supabase
        .from('fnb_week_generations')
        .insert({
          week_start_date: weekStartStr,
          generated_by: user?.id,
          orders_created: ordersCreated,
        });

      toast({
        title: 'Week Generated',
        description: `Created ${ordersCreated} orders for the week of ${format(weekStart, 'MMM d')}`,
      });

      return ordersCreated;
    } catch (error: any) {
      console.error('Error generating orders for week:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate orders for the week',
        variant: 'destructive',
      });
      return 0;
    }
  };

  const getWeekGeneration = async (weekStart: Date) => {
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const { data } = await supabase
      .from('fnb_week_generations')
      .select('*')
      .eq('week_start_date', weekStartStr)
      .single();
    return data;
  };

  const generateTemplateFromLastWeek = async (dayOfWeek: number): Promise<TemplateItemInput[]> => {
    try {
      // Find the last week's date for this day
      const today = new Date();
      const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
      const lastWeekStart = addDays(currentWeekStart, -7);
      const targetDate = addDays(lastWeekStart, dayOfWeek - 1);
      const targetDateStr = format(targetDate, 'yyyy-MM-dd');

      // Get orders from that day
      const { data: orders, error } = await supabase
        .from('fnb_orders')
        .select(`
          id,
          customer_id,
          fnb_order_items(
            product_id,
            quantity,
            unit_price_xcg
          )
        `)
        .eq('delivery_date', targetDateStr)
        .neq('status', 'cancelled');

      if (error) throw error;

      if (!orders || orders.length === 0) {
        toast({
          title: 'No Orders Found',
          description: `No orders found for last ${getDayName(dayOfWeek)}`,
          variant: 'destructive',
        });
        return [];
      }

      // Convert to template items
      const items: TemplateItemInput[] = [];
      let sortOrder = 0;

      for (const order of orders) {
        for (const item of order.fnb_order_items || []) {
          items.push({
            customer_id: order.customer_id,
            product_id: item.product_id,
            default_quantity: item.quantity,
            default_price_xcg: item.unit_price_xcg,
            sort_order: sortOrder++,
          });
        }
      }

      toast({
        title: 'Template Generated',
        description: `Found ${items.length} items from last ${getDayName(dayOfWeek)}`,
      });

      return items;
    } catch (error: any) {
      console.error('Error generating template from last week:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate template from last week',
        variant: 'destructive',
      });
      return [];
    }
  };

  return {
    templates,
    loading,
    fetchTemplates,
    getTemplateForDay,
    createOrUpdateTemplate,
    deleteTemplate,
    generateOrdersForWeek,
    getWeekGeneration,
    generateTemplateFromLastWeek,
  };
}

function getDayName(dayOfWeek: number): string {
  const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || '';
}
