import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ProductPickingUnit {
  product_id: string;
  picking_unit: string;
  usage_count: number;
}

/**
 * Hook to manage product picking units with global learning.
 * Tracks the most commonly used unit for each product and suggests it as default.
 */
export function useProductPickingUnits() {
  const queryClient = useQueryClient();

  // Fetch all learned picking units
  const { data: learnedUnits, isLoading } = useQuery({
    queryKey: ['product-picking-units'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('distribution_product_picking_units')
        .select('product_id, picking_unit, usage_count')
        .order('usage_count', { ascending: false });
      
      if (error) {
        console.error('Error fetching picking units:', error);
        return {};
      }

      // Create a map of product_id -> most common unit
      const unitMap: Record<string, string> = {};
      data?.forEach((row: ProductPickingUnit) => {
        // Only set if not already set (first one is the most used due to ordering)
        if (!unitMap[row.product_id]) {
          unitMap[row.product_id] = row.picking_unit;
        }
      });

      return unitMap;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Record a unit choice (for learning)
  const recordUnitMutation = useMutation({
    mutationFn: async ({ productId, unit }: { productId: string; unit: string }) => {
      // First, try to get existing record
      const { data: existing } = await (supabase as any)
        .from('distribution_product_picking_units')
        .select('id, usage_count')
        .eq('product_id', productId)
        .eq('picking_unit', unit)
        .maybeSingle();

      if (existing) {
        // Update usage count
        const { error } = await (supabase as any)
          .from('distribution_product_picking_units')
          .update({
            usage_count: existing.usage_count + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await (supabase as any)
          .from('distribution_product_picking_units')
          .insert({
            product_id: productId,
            picking_unit: unit,
            usage_count: 1,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-picking-units'] });
    },
  });

  /**
   * Get the suggested picking unit for a product.
   * Returns the most commonly used unit, or null if no history.
   */
  const getSuggestedUnit = (productId: string): string | null => {
    return learnedUnits?.[productId] || null;
  };

  /**
   * Record that a specific unit was used for a product.
   * This updates the learning data.
   */
  const recordUnitUsage = (productId: string, unit: string) => {
    recordUnitMutation.mutate({ productId, unit });
  };

  return {
    learnedUnits: learnedUnits || {},
    isLoading,
    getSuggestedUnit,
    recordUnitUsage,
    isRecording: recordUnitMutation.isPending,
  };
}
