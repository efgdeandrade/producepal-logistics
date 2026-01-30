import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isYesterday, startOfWeek, isWithinInterval, subDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

export interface DreMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  phone_number: string;
  message_id: string | null;
  message_text: string;
  message_type: string | null;
  status: string | null;
  customer_id: string | null;
  order_id: string | null;
  metadata: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  read_at: string | null;
  read_by: string | null;
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

export interface DreConversation {
  phone_number: string;
  customer_name: string | null;
  customer_id: string | null;
  last_message: string;
  last_message_at: string;
  last_message_direction: 'inbound' | 'outbound';
  unread_count: number;
  messages: DreMessage[];
  has_pending_order: boolean;
  is_escalated: boolean;
  customer_mood?: string;
}

export interface ConversationGroup {
  label: string;
  conversations: DreConversation[];
}

export type FilterType = 'all' | 'unread' | 'pending_order' | 'escalated' | 'today_orders';

export function useDreInbox(limit = 500) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: messages, isLoading, error, refetch } = useQuery({
    queryKey: ['dre-inbox-messages', limit],
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
      return (data || []) as DreMessage[];
    },
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('dre-inbox-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dre-inbox-messages'] });
          queryClient.invalidateQueries({ queryKey: ['dre-unread-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Mark messages as read
  const markAsRead = useMutation({
    mutationFn: async (phoneNumber: string) => {
      if (!user?.id) return;
      
      const { error } = await supabase
        .from('whatsapp_messages')
        .update({ 
          read_at: new Date().toISOString(),
          read_by: user.id
        })
        .eq('phone_number', phoneNumber)
        .eq('direction', 'inbound')
        .is('read_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dre-inbox-messages'] });
      queryClient.invalidateQueries({ queryKey: ['dre-unread-count'] });
    }
  });

  // Build conversations from messages
  const buildConversations = useCallback((msgs: DreMessage[]): DreConversation[] => {
    const conversationMap = new Map<string, DreConversation>();

    for (const msg of msgs) {
      const phone = msg.phone_number;
      
      if (!conversationMap.has(phone)) {
        conversationMap.set(phone, {
          phone_number: phone,
          customer_name: msg.customer?.name || null,
          customer_id: msg.customer_id,
          last_message: msg.message_text,
          last_message_at: msg.created_at,
          last_message_direction: msg.direction,
          unread_count: 0,
          messages: [],
          has_pending_order: false,
          is_escalated: false,
          customer_mood: undefined,
        });
      }

      const conv = conversationMap.get(phone)!;
      conv.messages.push(msg);

      // Count unread (inbound messages without read_at)
      if (msg.direction === 'inbound' && !msg.read_at) {
        conv.unread_count++;
      }

      // Check for pending order or escalation
      if (msg.detected_intent === 'order' || msg.order_id) {
        conv.has_pending_order = true;
      }
      if (msg.detected_mood === 'frustrated' || msg.detected_intent === 'complaint') {
        conv.is_escalated = true;
      }
      if (msg.detected_mood) {
        conv.customer_mood = msg.detected_mood;
      }
    }

    // Sort messages within each conversation chronologically
    conversationMap.forEach((conv) => {
      conv.messages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    // Convert to array and sort by last message time
    const conversations = Array.from(conversationMap.values());
    conversations.sort((a, b) => 
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );

    return conversations;
  }, []);

  // Group conversations by date
  const groupConversations = useCallback((conversations: DreConversation[]): ConversationGroup[] => {
    const groups: Record<string, DreConversation[]> = {
      'Today': [],
      'Yesterday': [],
      'This Week': [],
      'Older': [],
    };

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });

    for (const conv of conversations) {
      const date = new Date(conv.last_message_at);
      
      if (isToday(date)) {
        groups['Today'].push(conv);
      } else if (isYesterday(date)) {
        groups['Yesterday'].push(conv);
      } else if (isWithinInterval(date, { start: weekStart, end: subDays(now, 2) })) {
        groups['This Week'].push(conv);
      } else {
        groups['Older'].push(conv);
      }
    }

    return Object.entries(groups)
      .filter(([, convs]) => convs.length > 0)
      .map(([label, convs]) => ({ label, conversations: convs }));
  }, []);

  // Filter conversations
  const filterConversations = useCallback((
    conversations: DreConversation[], 
    filter: FilterType,
    searchQuery: string
  ): DreConversation[] => {
    let filtered = conversations;

    // Apply filter
    switch (filter) {
      case 'unread':
        filtered = filtered.filter(c => c.unread_count > 0);
        break;
      case 'pending_order':
        filtered = filtered.filter(c => c.has_pending_order);
        break;
      case 'escalated':
        filtered = filtered.filter(c => c.is_escalated);
        break;
      case 'today_orders':
        filtered = filtered.filter(c => 
          c.has_pending_order && isToday(new Date(c.last_message_at))
        );
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.phone_number.toLowerCase().includes(query) ||
        (c.customer_name?.toLowerCase().includes(query) ?? false) ||
        c.last_message.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, []);

  const conversations = messages ? buildConversations(messages) : [];
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return {
    messages,
    conversations,
    groupConversations,
    filterConversations,
    isLoading,
    error,
    refetch,
    markAsRead: markAsRead.mutate,
    totalUnread,
  };
}

// Separate hook for unread count (for badges)
export function useDreUnreadCount() {
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['dre-unread-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
        .eq('direction', 'inbound')
        .is('read_at', null);

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('dre-unread-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        (payload) => {
          // Only refresh if it's an inbound message
          if (payload.new && (payload.new as { direction?: string }).direction === 'inbound') {
            // Trigger a refetch
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return unreadCount;
}
