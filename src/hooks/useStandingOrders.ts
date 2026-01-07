import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from './use-toast';

interface TemplateItem {
  id: string;
  template_id: string;
  customer_id: string;
  customer_name: string;
  product_code: string;
  default_quantity: number;
  sort_order: number;
}

export interface DayTemplate {
  id: string;
  day_of_week: number;
  name: string;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: TemplateItem[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function useStandingOrders() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<DayTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data: templatesData, error: templatesError } = await supabase
        .from('day_order_templates')
        .select('*')
        .order('day_of_week');

      if (templatesError) throw templatesError;

      // Fetch items for each template
      const templatesWithItems = await Promise.all(
        (templatesData || []).map(async (template) => {
          const { data: items, error: itemsError } = await supabase
            .from('day_order_template_items')
            .select('*')
            .eq('template_id', template.id)
            .order('sort_order');

          if (itemsError) {
            console.error('Error fetching template items:', itemsError);
            return { ...template, items: [] };
          }

          return { ...template, items: items || [] };
        })
      );

      setTemplates(templatesWithItems);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({ title: 'Error', description: 'Failed to load standing orders', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const getTemplateForDay = useCallback((dayOfWeek: number) => {
    return templates.find(t => t.day_of_week === dayOfWeek && t.is_active);
  }, [templates]);

  const createOrUpdateTemplate = async (
    dayOfWeek: number,
    name: string,
    items: Omit<TemplateItem, 'id' | 'template_id'>[],
    notes?: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check if template exists for this day
      const existingTemplate = templates.find(t => t.day_of_week === dayOfWeek);

      let templateId: string;

      if (existingTemplate) {
        // Update existing template
        const { error: updateError } = await supabase
          .from('day_order_templates')
          .update({ name, notes, is_active: true })
          .eq('id', existingTemplate.id);

        if (updateError) throw updateError;
        templateId = existingTemplate.id;

        // Delete existing items
        const { error: deleteError } = await supabase
          .from('day_order_template_items')
          .delete()
          .eq('template_id', templateId);

        if (deleteError) throw deleteError;
      } else {
        // Create new template
        const { data: newTemplate, error: createError } = await supabase
          .from('day_order_templates')
          .insert({
            day_of_week: dayOfWeek,
            name,
            notes,
            is_active: true,
            created_by: user?.id,
          })
          .select()
          .single();

        if (createError) throw createError;
        templateId = newTemplate.id;
      }

      // Insert new items
      if (items.length > 0) {
        const itemsToInsert = items.map((item, index) => ({
          template_id: templateId,
          customer_id: item.customer_id,
          customer_name: item.customer_name,
          product_code: item.product_code,
          default_quantity: item.default_quantity,
          sort_order: item.sort_order ?? index,
        }));

        const { error: itemsError } = await supabase
          .from('day_order_template_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      await fetchTemplates();
      toast({ title: 'Success', description: `Standing order for ${DAY_NAMES[dayOfWeek]} saved!` });
      return true;
    } catch (error) {
      console.error('Error saving template:', error);
      toast({ title: 'Error', description: 'Failed to save standing order', variant: 'destructive' });
      return false;
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('day_order_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      await fetchTemplates();
      toast({ title: 'Success', description: 'Standing order deleted' });
      return true;
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({ title: 'Error', description: 'Failed to delete standing order', variant: 'destructive' });
      return false;
    }
  };

  const getLastOrderForDay = async (dayOfWeek: number) => {
    try {
      // Get orders where the delivery date falls on the specified day of week
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, delivery_date, order_number')
        .eq('status', 'active')
        .order('delivery_date', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Find the most recent order that was on the specified day
      const matchingOrder = orders?.find(order => {
        const date = new Date(order.delivery_date + 'T00:00:00');
        return date.getDay() === dayOfWeek;
      });

      if (!matchingOrder) return null;

      // Get the order items
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', matchingOrder.id);

      if (itemsError) throw itemsError;

      return {
        order: matchingOrder,
        items: items || [],
      };
    } catch (error) {
      console.error('Error fetching last order:', error);
      return null;
    }
  };

  const generateTemplateFromLastOrder = async (dayOfWeek: number) => {
    const lastOrder = await getLastOrderForDay(dayOfWeek);
    
    if (!lastOrder || lastOrder.items.length === 0) {
      toast({ 
        title: 'No orders found', 
        description: `No previous ${DAY_NAMES[dayOfWeek]} orders found to generate template from`,
        variant: 'destructive' 
      });
      return null;
    }

    // Get customer IDs from names
    const customerNames = [...new Set(lastOrder.items.map(item => item.customer_name))];
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name')
      .in('name', customerNames);

    const customerMap = new Map(customers?.map(c => [c.name, c.id]) || []);

    // Transform order items to template items format
    const templateItems: Omit<TemplateItem, 'id' | 'template_id'>[] = [];
    let sortOrder = 0;
    
    lastOrder.items.forEach(item => {
      const customerId = customerMap.get(item.customer_name);
      if (customerId) {
        templateItems.push({
          customer_id: customerId,
          customer_name: item.customer_name,
          product_code: item.product_code,
          default_quantity: item.quantity,
          sort_order: sortOrder++,
        });
      }
    });

    return {
      name: `${DAY_NAMES[dayOfWeek]} Orders`,
      items: templateItems,
      sourceOrder: lastOrder.order.order_number,
    };
  };

  return {
    templates,
    loading,
    fetchTemplates,
    getTemplateForDay,
    createOrUpdateTemplate,
    deleteTemplate,
    getLastOrderForDay,
    generateTemplateFromLastOrder,
    DAY_NAMES,
  };
}
