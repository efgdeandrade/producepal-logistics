import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WhatsAppHealthCheck {
  id: string;
  check_type: string;
  status: 'healthy' | 'degraded' | 'failed';
  response_time_ms: number | null;
  error_message: string | null;
  error_code: string | null;
  token_valid: boolean | null;
  phone_number_status: string | null;
  created_at: string;
}

export function useWhatsAppHealth() {
  return useQuery({
    queryKey: ['whatsapp-health'],
    queryFn: async (): Promise<WhatsAppHealthCheck | null> => {
      const { data, error } = await supabase
        .from('whatsapp_health_checks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // No data yet is not an error
        if (error.code === 'PGRST116') return null;
        console.error('Error fetching WhatsApp health:', error);
        return null;
      }

      return data as WhatsAppHealthCheck;
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useWhatsAppHealthHistory(limit = 24) {
  return useQuery({
    queryKey: ['whatsapp-health-history', limit],
    queryFn: async (): Promise<WhatsAppHealthCheck[]> => {
      const { data, error } = await supabase
        .from('whatsapp_health_checks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching WhatsApp health history:', error);
        return [];
      }

      return data as WhatsAppHealthCheck[];
    },
    refetchInterval: 60000,
  });
}
