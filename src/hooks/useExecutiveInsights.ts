import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ExecutiveInsight {
  type: 'opportunity' | 'warning' | 'improvement' | 'success';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  metric?: string;
}

export interface ExecutiveInsightsData {
  insights: ExecutiveInsight[];
  summary: string;
  metrics: {
    weeklyRevenue: number;
    deliveredOrders: number;
    pendingOrders: number;
    aiAccuracy: string;
    pendingShortages: number;
    pendingAnomalies: number;
    totalCustomers: number;
    averageOrderValue: number;
  };
  generatedAt: string;
}

export function useExecutiveInsights() {
  return useQuery({
    queryKey: ['executive-insights'],
    queryFn: async (): Promise<ExecutiveInsightsData> => {
      const { data, error } = await supabase.functions.invoke('executive-insights');
      
      if (error) {
        console.error('Failed to fetch executive insights:', error);
        throw error;
      }
      
      return data;
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 2 * 60 * 1000, // Consider stale after 2 minutes
    retry: 2,
  });
}
