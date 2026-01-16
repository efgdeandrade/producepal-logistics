import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ThreadEmail {
  id: string;
  message_id: string;
  thread_id: string | null;
  from_email: string;
  from_name: string | null;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  is_reply: boolean;
  reply_sent_at: string | null;
  parent_email_id: string | null;
}

export function useEmailThread(threadId: string | null) {
  const [emails, setEmails] = useState<ThreadEmail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!threadId) {
      setEmails([]);
      return;
    }

    const fetchThread = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('email_inbox')
          .select('id, message_id, thread_id, from_email, from_name, subject, body_text, body_html, received_at, is_reply, reply_sent_at, parent_email_id')
          .eq('thread_id', threadId)
          .order('received_at', { ascending: true });

        if (error) throw error;
        setEmails(data || []);
      } catch (error) {
        console.error('Error fetching thread:', error);
        setEmails([]);
      } finally {
        setLoading(false);
      }
    };

    fetchThread();
  }, [threadId]);

  return { emails, loading };
}
