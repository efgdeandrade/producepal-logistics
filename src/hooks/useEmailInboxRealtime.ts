import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, any>;
  old: Record<string, any>;
}

interface UseEmailInboxRealtimeOptions {
  onNewEmail?: (email: any) => void;
  onEmailUpdate?: (email: any) => void;
  onEmailDelete?: (id: string) => void;
  showNotifications?: boolean;
}

export function useEmailInboxRealtime(options: UseEmailInboxRealtimeOptions = {}) {
  const { onNewEmail, onEmailUpdate, onEmailDelete, showNotifications = true } = options;
  const { toast } = useToast();

  const handleChange = useCallback((payload: RealtimePayload) => {
    console.log('Email inbox realtime change:', payload);

    switch (payload.eventType) {
      case 'INSERT':
        onNewEmail?.(payload.new);
        if (showNotifications) {
          toast({
            title: 'New Email',
            description: `From: ${payload.new.from_name || payload.new.from_email}`,
          });
        }
        break;
      case 'UPDATE':
        onEmailUpdate?.(payload.new);
        break;
      case 'DELETE':
        onEmailDelete?.(payload.old.id);
        break;
    }
  }, [onNewEmail, onEmailUpdate, onEmailDelete, showNotifications, toast]);

  useEffect(() => {
    const channel = supabase
      .channel('email-inbox-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_inbox',
        },
        (payload) => handleChange(payload as unknown as RealtimePayload)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleChange]);

  return null;
}
