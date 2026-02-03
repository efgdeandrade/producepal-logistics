import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CIFProductResult {
  productCode: string;
  productName: string;
  quantity: number;
  costUSD: number;
  freightShare: number;
  cifUSD: number;
  cifXCG: number;
  cifPerUnit: number;
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  adjustmentFactor?: number;
  adjustmentConfidence?: number;
}

export interface CIFEstimateSummary {
  totalFreightUSD: number;
  totalChargeableWeightKg: number;
  totalActualWeightKg: number;
  totalVolumetricWeightKg: number;
  limitingFactor: 'actual' | 'volumetric';
  productsCount: number;
  aiAdjustmentsApplied: number;
  aiAdjustmentsSuggested: number;
}

export interface CIFEstimateResponse {
  success: boolean;
  snapshotId?: string;
  message?: string;
  summary?: CIFEstimateSummary;
  products?: CIFProductResult[];
  error?: string;
}

export interface CIFSnapshot {
  id: string;
  order_id: string;
  snapshot_type: 'estimate' | 'actual';
  total_freight_usd: number | null;
  freight_exterior_usd: number | null;
  freight_local_usd: number | null;
  local_logistics_usd: number | null;
  labor_xcg: number | null;
  bank_charges_usd: number | null;
  supplier_fixed_costs_usd: number | null;
  distribution_method: string | null;
  blend_ratio: number | null;
  exchange_rate: number | null;
  total_chargeable_weight_kg: number | null;
  total_actual_weight_kg: number | null;
  total_volumetric_weight_kg: number | null;
  products_data: CIFProductResult[] | null;
  ai_adjustments_applied: any[] | null;
  notes: string | null;
  created_at: string | null;
  created_by: string | null;
}

/**
 * Hook to generate CIF estimate for an order
 */
export function useGenerateCIFEstimate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, forceRecalculate = false }: { orderId: string; forceRecalculate?: boolean }): Promise<CIFEstimateResponse> => {
      const { data, error } = await supabase.functions.invoke('cif-auto-estimate', {
        body: { orderId, forceRecalculate }
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate CIF estimate');
      }

      return data;
    },
    onSuccess: (data, variables) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['cif-snapshot', variables.orderId] });
        queryClient.invalidateQueries({ queryKey: ['cif-snapshots', variables.orderId] });
        
        if (data.summary) {
          const appliedCount = data.summary.aiAdjustmentsApplied;
          const suggestedCount = data.summary.aiAdjustmentsSuggested;
          
          let message = `CIF estimate generated for ${data.summary.productsCount} products.`;
          if (appliedCount > 0) {
            message += ` AI adjustments applied: ${appliedCount}.`;
          }
          if (suggestedCount > 0) {
            message += ` Suggestions available: ${suggestedCount}.`;
          }
          
          toast.success(message);
        }
      }
    },
    onError: (error: Error) => {
      console.error('CIF estimate error:', error);
      toast.error(`Failed to generate estimate: ${error.message}`);
    }
  });
}

/**
 * Hook to fetch CIF snapshot(s) for an order
 */
export function useCIFSnapshot(orderId: string | undefined, snapshotType?: 'estimate' | 'actual') {
  return useQuery({
    queryKey: ['cif-snapshot', orderId, snapshotType],
    queryFn: async (): Promise<CIFSnapshot | null> => {
      if (!orderId) return null;

      let query = supabase
        .from('cif_calculation_snapshots')
        .select('*')
        .eq('order_id', orderId);

      if (snapshotType) {
        query = query.eq('snapshot_type', snapshotType);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching CIF snapshot:', error);
        throw error;
      }

      if (!data) return null;

      // Cast the products_data to the correct type
      return {
        ...data,
        products_data: (data.products_data as unknown) as CIFProductResult[] | null,
        ai_adjustments_applied: (data.ai_adjustments_applied as unknown) as any[] | null,
        snapshot_type: data.snapshot_type as 'estimate' | 'actual',
      } as CIFSnapshot;
    },
    enabled: !!orderId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch all CIF snapshots for an order (both estimate and actual)
 */
export function useCIFSnapshots(orderId: string | undefined) {
  return useQuery({
    queryKey: ['cif-snapshots', orderId],
    queryFn: async (): Promise<{ estimate: CIFSnapshot | null; actual: CIFSnapshot | null }> => {
      if (!orderId) return { estimate: null, actual: null };

      const { data, error } = await supabase
        .from('cif_calculation_snapshots')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching CIF snapshots:', error);
        throw error;
      }

      const snapshots = (data || []).map(s => ({
        ...s,
        products_data: s.products_data as unknown as CIFProductResult[],
      })) as CIFSnapshot[];

      return {
        estimate: snapshots.find(s => s.snapshot_type === 'estimate') || null,
        actual: snapshots.find(s => s.snapshot_type === 'actual') || null,
      };
    },
    enabled: !!orderId,
    staleTime: 1000 * 60 * 5,
  });
}
