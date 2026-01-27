import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface IntegrationStatus {
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'disconnected';
  message: string;
  lastChecked?: string;
}

export function useIntegrationHealth() {
  return useQuery({
    queryKey: ['integration-health'],
    queryFn: async (): Promise<IntegrationStatus[]> => {
      const integrations: IntegrationStatus[] = [];

      // 1. WhatsApp Health
      const { data: whatsappHealth } = await supabase
        .from('whatsapp_health_checks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (whatsappHealth) {
        const status = whatsappHealth.status as string;
        integrations.push({
          name: 'WhatsApp API',
          status: status === 'healthy' ? 'healthy' : status === 'degraded' ? 'warning' : 'error',
          message: status === 'healthy' 
            ? `Quality: ${whatsappHealth.phone_number_status || 'OK'}` 
            : whatsappHealth.error_message || 'Connection issue',
          lastChecked: whatsappHealth.created_at,
        });
      } else {
        integrations.push({
          name: 'WhatsApp API',
          status: 'disconnected',
          message: 'No health data available',
        });
      }

      // 2. Gmail Health
      const { data: gmailCredentials } = await supabase
        .from('gmail_credentials')
        .select('email_address, is_active, needs_reauth, last_error, last_sync_at, watch_expiration')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (gmailCredentials) {
        let gmailStatus: IntegrationStatus['status'] = 'healthy';
        let gmailMessage = `Connected: ${gmailCredentials.email_address}`;

        if (gmailCredentials.needs_reauth) {
          gmailStatus = 'error';
          gmailMessage = 'Re-authentication required';
        } else if (gmailCredentials.last_error) {
          gmailStatus = 'warning';
          gmailMessage = gmailCredentials.last_error;
        } else if (gmailCredentials.watch_expiration) {
          const watchExpiry = new Date(gmailCredentials.watch_expiration);
          const hoursUntilExpiry = (watchExpiry.getTime() - Date.now()) / (1000 * 60 * 60);
          if (hoursUntilExpiry < 0) {
            gmailStatus = 'warning';
            gmailMessage = 'Watch expired - awaiting renewal';
          } else if (hoursUntilExpiry < 24) {
            gmailStatus = 'warning';
            gmailMessage = `Watch expiring in ${Math.round(hoursUntilExpiry)}h`;
          }
        }

        integrations.push({
          name: 'Gmail',
          status: gmailStatus,
          message: gmailMessage,
          lastChecked: gmailCredentials.last_sync_at || undefined,
        });
      } else {
        integrations.push({
          name: 'Gmail',
          status: 'disconnected',
          message: 'Not connected',
        });
      }

      // 3. QuickBooks Health
      const { data: qbTokens } = await supabase
        .from('quickbooks_tokens')
        .select('realm_id, expires_at, updated_at')
        .limit(1)
        .single();

      if (qbTokens) {
        const expiresAt = new Date(qbTokens.expires_at);
        const isExpired = expiresAt < new Date();
        const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);

        let qbStatus: IntegrationStatus['status'] = 'healthy';
        let qbMessage = 'Connected';

        if (isExpired) {
          qbStatus = 'error';
          qbMessage = 'Token expired - reconnect required';
        } else if (hoursUntilExpiry < 1) {
          qbStatus = 'warning';
          qbMessage = 'Token expiring soon';
        }

        integrations.push({
          name: 'QuickBooks',
          status: qbStatus,
          message: qbMessage,
          lastChecked: qbTokens.updated_at,
        });
      } else {
        integrations.push({
          name: 'QuickBooks',
          status: 'disconnected',
          message: 'Not connected',
        });
      }

      return integrations;
    },
    refetchInterval: 60000, // Refetch every minute
  });
}
