import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ExternalIntegration {
  id: string;
  name: string;
  type: 'whatsapp' | 'quickbooks' | 'custom_api' | 'email' | 'sms';
  config: Record<string, any>;
  is_active: boolean;
  last_sync_at: string | null;
  sync_status: 'idle' | 'syncing' | 'success' | 'error';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  headers: Record<string, string>;
  is_active: boolean;
  retry_count: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, any>;
  response_status: number | null;
  response_body: string | null;
  duration_ms: number | null;
  attempt_number: number;
  error_message: string | null;
  created_at: string;
}

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<ExternalIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('external_integrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIntegrations(data as ExternalIntegration[] || []);
    } catch (error: any) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const createIntegration = async (integration: Omit<ExternalIntegration, 'id' | 'created_at' | 'updated_at' | 'last_sync_at' | 'sync_status' | 'error_message'>) => {
    try {
      const { data, error } = await supabase
        .from('external_integrations')
        .insert(integration)
        .select()
        .single();

      if (error) throw error;
      
      toast({ title: 'Integration created successfully' });
      await fetchIntegrations();
      return data;
    } catch (error: any) {
      toast({ title: 'Error creating integration', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const updateIntegration = async (id: string, updates: Partial<ExternalIntegration>) => {
    try {
      const { error } = await supabase
        .from('external_integrations')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: 'Integration updated' });
      await fetchIntegrations();
    } catch (error: any) {
      toast({ title: 'Error updating integration', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const deleteIntegration = async (id: string) => {
    try {
      const { error } = await supabase
        .from('external_integrations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: 'Integration deleted' });
      await fetchIntegrations();
    } catch (error: any) {
      toast({ title: 'Error deleting integration', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  return {
    integrations,
    loading,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    refetch: fetchIntegrations,
  };
}

export function useWebhooks() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchWebhooks = async () => {
    try {
      const { data, error } = await supabase
        .from('webhook_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWebhooks(data as WebhookConfig[] || []);
    } catch (error: any) {
      console.error('Error fetching webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (webhookId?: string) => {
    try {
      let query = supabase
        .from('webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (webhookId) {
        query = query.eq('webhook_id', webhookId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data as WebhookLog[] || []);
    } catch (error: any) {
      console.error('Error fetching webhook logs:', error);
    }
  };

  const createWebhook = async (webhook: Omit<WebhookConfig, 'id' | 'created_at' | 'updated_at' | 'last_triggered_at'>) => {
    try {
      const { data, error } = await supabase
        .from('webhook_configs')
        .insert(webhook)
        .select()
        .single();

      if (error) throw error;
      
      toast({ title: 'Webhook created successfully' });
      await fetchWebhooks();
      return data;
    } catch (error: any) {
      toast({ title: 'Error creating webhook', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const updateWebhook = async (id: string, updates: Partial<WebhookConfig>) => {
    try {
      const { error } = await supabase
        .from('webhook_configs')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: 'Webhook updated' });
      await fetchWebhooks();
    } catch (error: any) {
      toast({ title: 'Error updating webhook', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const deleteWebhook = async (id: string) => {
    try {
      const { error } = await supabase
        .from('webhook_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: 'Webhook deleted' });
      await fetchWebhooks();
    } catch (error: any) {
      toast({ title: 'Error deleting webhook', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const generateSecret = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  useEffect(() => {
    fetchWebhooks();
    fetchLogs();
  }, []);

  return {
    webhooks,
    logs,
    loading,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    generateSecret,
    refetch: fetchWebhooks,
    refetchLogs: fetchLogs,
  };
}

export function useWhatsAppMessages() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async (customerId?: string) => {
    try {
      let query = supabase
        .from('whatsapp_messages')
        .select('*, distribution_customers(name)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      console.error('Error fetching WhatsApp messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  return {
    messages,
    loading,
    refetch: fetchMessages,
  };
}
