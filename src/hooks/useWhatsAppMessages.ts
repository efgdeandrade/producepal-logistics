import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WhatsAppMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  phone_number: string;
  message_id: string | null;
  message_text: string;
  message_type: string | null;
  status: string | null;
  customer_id: string | null;
  order_id: string | null;
  metadata: Record<string, any> | null;
  error_message: string | null;
  created_at: string;
  sent_by_user_id?: string | null;
  is_human_response?: boolean;
  detected_mood?: string | null;
  detected_intent?: string | null;
  customer?: {
    id: string;
    name: string;
    whatsapp_phone: string;
  } | null;
}

export interface ConversationThread {
  phone_number: string;
  customer_name: string | null;
  customer_id: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  messages: WhatsAppMessage[];
}

export function useWhatsAppMessages(limit = 100) {
  const queryClient = useQueryClient();

  const { data: messages, isLoading, error } = useQuery({
    queryKey: ['whatsapp-messages', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select(`
          *,
          customer:distribution_customers(id, name, whatsapp_phone)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as WhatsAppMessage[];
    },
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Group messages into conversation threads by phone number
  const threads: ConversationThread[] = [];
  const threadMap = new Map<string, ConversationThread>();

  (messages || []).forEach((msg) => {
    const phone = msg.phone_number;
    if (!threadMap.has(phone)) {
      threadMap.set(phone, {
        phone_number: phone,
        customer_name: msg.customer?.name || null,
        customer_id: msg.customer_id,
        last_message: msg.message_text,
        last_message_at: msg.created_at,
        unread_count: 0,
        messages: [],
      });
    }
    const thread = threadMap.get(phone)!;
    thread.messages.push(msg);
    
    // Count unread (inbound messages in last hour that haven't been responded to)
    if (msg.direction === 'inbound') {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (new Date(msg.created_at) > oneHourAgo) {
        thread.unread_count++;
      }
    }
  });

  threadMap.forEach((thread) => {
    // Sort messages within thread chronologically
    thread.messages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    threads.push(thread);
  });

  // Sort threads by last message time
  threads.sort((a, b) => 
    new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );

  return {
    messages,
    threads,
    isLoading,
    error,
    totalUnread: threads.reduce((sum, t) => sum + t.unread_count, 0),
  };
}

export function useWhatsAppUnreadCount() {
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['whatsapp-unread-count'],
    queryFn: async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
        .eq('direction', 'inbound')
        .gte('created_at', oneHourAgo);

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-unread-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-unread-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return unreadCount;
}
