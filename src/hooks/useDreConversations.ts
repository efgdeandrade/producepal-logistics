import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DreConversation {
  id: string;
  phone_number: string;
  customer_id: string | null;
  customer_name: string | null;
  assigned_to: string | null;
  is_taken_over: boolean;
  takeover_reason: string | null;
  taken_over_at: string | null;
  status: 'active' | 'resolved' | 'waiting' | 'escalated';
  priority: 'normal' | 'high' | 'urgent';
  last_message_text: string | null;
  last_message_direction: 'inbound' | 'outbound' | null;
  last_activity_at: string;
  detected_mood: string | null;
  detected_language: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
  // Joined data
  assigned_user?: {
    full_name: string;
  } | null;
}

export interface ConversationNote {
  id: string;
  conversation_id: string;
  user_id: string;
  note_text: string;
  is_pinned: boolean;
  created_at: string;
  user?: {
    full_name: string;
  } | null;
}

export interface DreResponseFeedback {
  id: string;
  message_id: string;
  conversation_id: string | null;
  original_response: string;
  corrected_response: string | null;
  rating: 'good' | 'needs_improvement' | 'wrong';
  feedback_type: 'tone' | 'accuracy' | 'product_match' | 'language' | 'other' | null;
  feedback_notes: string | null;
  corrected_by: string;
  created_at: string;
}

export function useDreConversations() {
  const queryClient = useQueryClient();

  const { data: conversations, isLoading, error } = useQuery({
    queryKey: ['dre-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .order('last_activity_at', { ascending: false });

      if (error) throw error;
      
      // Fetch assigned user names separately if needed
      const conversationsWithUsers = await Promise.all(
        (data || []).map(async (conv) => {
          let assignedUser = null;
          if (conv.assigned_to) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', conv.assigned_to)
              .single();
            assignedUser = profile;
          }
          return { ...conv, assigned_user: assignedUser } as DreConversation;
        })
      );
      
      return conversationsWithUsers;
    },
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('dre-conversations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_conversations',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dre-conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { conversations, isLoading, error };
}

export function useConversationNotes(conversationId: string | null) {
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useQuery({
    queryKey: ['conversation-notes', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('whatsapp_conversation_notes')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch user names separately
      const notesWithUsers = await Promise.all(
        (data || []).map(async (note) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', note.user_id)
            .single();
          return { ...note, user: profile } as ConversationNote;
        })
      );
      
      return notesWithUsers;
    },
    enabled: !!conversationId,
  });

  const addNote = useMutation({
    mutationFn: async ({ conversationId, noteText }: { conversationId: string; noteText: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('whatsapp_conversation_notes')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          note_text: noteText,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-notes', conversationId] });
    },
  });

  const togglePin = useMutation({
    mutationFn: async ({ noteId, isPinned }: { noteId: string; isPinned: boolean }) => {
      const { error } = await supabase
        .from('whatsapp_conversation_notes')
        .update({ is_pinned: !isPinned })
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-notes', conversationId] });
    },
  });

  return { notes, isLoading, addNote, togglePin };
}

export function useConversationActions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const takeOver = useMutation({
    mutationFn: async ({ conversationId, reason }: { conversationId: string; reason?: string }) => {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({
          is_taken_over: true,
          assigned_to: user?.id,
          takeover_reason: reason || 'Manual takeover',
          taken_over_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dre-conversations'] });
    },
  });

  const returnToDre = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({
          is_taken_over: false,
          assigned_to: null,
          takeover_reason: null,
          taken_over_at: null,
        })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dre-conversations'] });
    },
  });

  const updatePriority = useMutation({
    mutationFn: async ({ conversationId, priority }: { conversationId: string; priority: 'normal' | 'high' | 'urgent' }) => {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ priority })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dre-conversations'] });
    },
  });

  const markResolved = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ 
          status: 'resolved',
          is_taken_over: false,
          assigned_to: null,
        })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dre-conversations'] });
    },
  });

  return { takeOver, returnToDre, updatePriority, markResolved };
}

export function useResponseFeedback() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const submitFeedback = useMutation({
    mutationFn: async (feedback: {
      messageId: string;
      conversationId?: string;
      originalResponse: string;
      correctedResponse?: string;
      rating: 'good' | 'needs_improvement' | 'wrong';
      feedbackType?: 'tone' | 'accuracy' | 'product_match' | 'language' | 'other';
      feedbackNotes?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('dre_response_feedback')
        .insert({
          message_id: feedback.messageId,
          conversation_id: feedback.conversationId || null,
          original_response: feedback.originalResponse,
          corrected_response: feedback.correctedResponse || null,
          rating: feedback.rating,
          feedback_type: feedback.feedbackType || null,
          feedback_notes: feedback.feedbackNotes || null,
          corrected_by: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dre-feedback'] });
    },
  });

  return { submitFeedback };
}

export function useSendTeamMessage() {
  const { user } = useAuth();

  const sendMessage = useMutation({
    mutationFn: async ({ phoneNumber, messageText, customerId }: { 
      phoneNumber: string; 
      messageText: string;
      customerId?: string;
    }) => {
      // Call the WhatsApp API via edge function
      const { data, error } = await supabase.functions.invoke('send-team-whatsapp', {
        body: {
          phone_number: phoneNumber,
          message_text: messageText,
          sent_by_user_id: user?.id,
        },
      });

      if (error) throw error;

      // Log the message
      await supabase.from('whatsapp_messages').insert({
        direction: 'outbound',
        phone_number: phoneNumber,
        message_text: messageText,
        customer_id: customerId || null,
        sent_by_user_id: user?.id,
        is_human_response: true,
        status: 'sent',
      });

      return data;
    },
  });

  return { sendMessage };
}
