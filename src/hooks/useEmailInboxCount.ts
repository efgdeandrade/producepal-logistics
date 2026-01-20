import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Statuses that count as "unread" / actionable
const UNREAD_STATUSES = ['new', 'pending', 'pending_review', 'error'];

export function useEmailInboxCount() {
  const queryClient = useQueryClient();

  const { data: unreadCount = 0, isLoading, refetch } = useQuery({
    queryKey: ['email-inbox-unread-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('email_inbox')
        .select('*', { count: 'exact', head: true })
        .in('status', UNREAD_STATUSES);

      if (error) {
        console.error('Error fetching email inbox count:', error);
        return 0;
      }

      return count || 0;
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  // Subscribe to realtime changes on email_inbox
  useEffect(() => {
    const channel = supabase
      .channel('email-inbox-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_inbox',
        },
        () => {
          // Invalidate and refetch count on any change
          queryClient.invalidateQueries({ queryKey: ['email-inbox-unread-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { unreadCount, isLoading, refetch };
}
