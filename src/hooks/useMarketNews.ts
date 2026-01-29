import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MarketNewsItem {
  id: string;
  headline: string;
  summary: string | null;
  source_url: string | null;
  source_name: string | null;
  country_code: string | null;
  impact_level: 'high' | 'medium' | 'low' | null;
  impact_type: 'opportunity' | 'risk' | 'neutral' | null;
  affected_products: string[] | null;
  affected_suppliers: string[] | null;
  financial_impact_estimate: number | null;
  financial_impact_direction: 'gain' | 'loss' | 'neutral' | null;
  ai_recommendation: string | null;
  ai_action_items: Array<{ action: string; priority: string; contact?: string }> | null;
  published_at: string | null;
  fetched_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface MarketNewsResponse {
  success: boolean;
  news: MarketNewsItem[];
  source: 'cache' | 'fresh';
  fetched_at?: string;
  cached_at?: string;
  error?: string;
}

const COUNTRY_FLAGS: Record<string, string> = {
  COL: '🇨🇴',
  USA: '🇺🇸',
  NLD: '🇳🇱',
  CHL: '🇨🇱',
  PER: '🇵🇪',
  BRA: '🇧🇷',
  VEN: '🇻🇪',
};

const COUNTRY_NAMES: Record<string, string> = {
  COL: 'Colombia',
  USA: 'United States',
  NLD: 'Holland',
  CHL: 'Chile',
  PER: 'Peru',
  BRA: 'Brazil',
  VEN: 'Venezuela',
};

export function getCountryFlag(code: string | null): string {
  if (!code) return '🌍';
  return COUNTRY_FLAGS[code] || '🌍';
}

export function getCountryName(code: string | null): string {
  if (!code) return 'Global';
  return COUNTRY_NAMES[code] || code;
}

export function useMarketNews() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['market-news'],
    queryFn: async (): Promise<MarketNewsItem[]> => {
      console.log('Fetching market news...');
      
      const { data, error } = await supabase.functions.invoke<MarketNewsResponse>(
        'market-news-intelligence',
        { body: { forceRefresh: false } }
      );

      if (error) {
        console.error('Market news fetch error:', error);
        throw new Error(error.message || 'Failed to fetch market news');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch market news');
      }

      console.log(`Received ${data.news?.length || 0} news items from ${data.source}`);
      return data.news || [];
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const refresh = async () => {
    try {
      toast({
        title: "Refreshing news...",
        description: "Fetching latest market intelligence",
      });

      const { data, error } = await supabase.functions.invoke<MarketNewsResponse>(
        'market-news-intelligence',
        { body: { forceRefresh: true } }
      );

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Refresh failed');
      }

      queryClient.setQueryData(['market-news'], data.news || []);
      
      toast({
        title: "News refreshed",
        description: `Found ${data.news?.length || 0} relevant market updates`,
      });
    } catch (error) {
      console.error('Refresh error:', error);
      toast({
        title: "Refresh failed",
        description: error instanceof Error ? error.message : 'Could not refresh news',
        variant: "destructive",
      });
    }
  };

  // Summary stats for executive dashboard
  const stats = {
    totalNews: query.data?.length || 0,
    highImpact: query.data?.filter(n => n.impact_level === 'high').length || 0,
    opportunities: query.data?.filter(n => n.impact_type === 'opportunity').length || 0,
    risks: query.data?.filter(n => n.impact_type === 'risk').length || 0,
    topStory: query.data?.[0] || null,
  };

  return {
    news: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refresh,
    stats,
  };
}
