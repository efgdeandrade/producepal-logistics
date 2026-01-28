import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface TeamChannel {
  id: string;
  name: string;
  channel_type: 'department' | 'general' | 'direct';
  department: string | null;
  description: string | null;
  is_archived: boolean;
  created_at: string;
}

export interface TeamMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  message_text: string;
  message_type: 'text' | 'escalation' | 'system' | 'ai_summary';
  related_conversation_id: string | null;
  related_customer_id: string | null;
  metadata: Record<string, unknown>;
  is_pinned: boolean;
  created_at: string;
  sender?: {
    full_name: string;
    email: string;
  };
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  message_text: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    full_name: string;
    email: string;
  };
}

export interface TeamPresence {
  id: string;
  user_id: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  current_view: string | null;
  active_conversations: number;
  last_seen_at: string;
  user?: {
    full_name: string;
    email: string;
  };
}

export function useDreTeamChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [channels, setChannels] = useState<TeamChannel[]>([]);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [teamPresence, setTeamPresence] = useState<TeamPresence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedDmUserId, setSelectedDmUserId] = useState<string | null>(null);

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    const { data, error } = await supabase
      .from('dre_team_channels')
      .select('*')
      .eq('is_archived', false)
      .order('name');

    if (error) {
      console.error('Error fetching channels:', error);
      return;
    }
    
    const typedData = (data || []).map(c => ({
      ...c,
      channel_type: c.channel_type as TeamChannel['channel_type'],
    }));
    
    setChannels(typedData);
    if (typedData.length > 0 && !selectedChannelId) {
      setSelectedChannelId(typedData[0].id);
    }
  }, [selectedChannelId]);

  // Fetch messages for selected channel
  const fetchMessages = useCallback(async (channelId: string) => {
    const { data, error } = await supabase
      .from('dre_team_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    // Fetch sender profiles separately
    const senderIds = [...new Set((data || []).map(m => m.sender_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', senderIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    const typedData = (data || []).map(m => ({
      ...m,
      message_type: m.message_type as TeamMessage['message_type'],
      metadata: m.metadata as Record<string, unknown>,
      sender: profileMap.get(m.sender_id),
    }));
    
    setMessages(typedData);
  }, []);

  // Fetch direct messages with a specific user
  const fetchDirectMessages = useCallback(async (otherUserId: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('dre_direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error fetching DMs:', error);
      return;
    }

    // Fetch sender profiles separately
    const senderIds = [...new Set((data || []).map(m => m.sender_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', senderIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    const typedData = (data || []).map(m => ({
      ...m,
      sender: profileMap.get(m.sender_id),
    }));
    
    setDirectMessages(typedData);
  }, [user]);

  // Fetch team presence
  const fetchTeamPresence = useCallback(async () => {
    const { data, error } = await supabase
      .from('dre_team_presence')
      .select('*');

    if (error) {
      console.error('Error fetching presence:', error);
      return;
    }

    // Fetch user profiles separately
    const userIds = (data || []).map(p => p.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    const typedData = (data || []).map(p => ({
      ...p,
      status: p.status as TeamPresence['status'],
      user: profileMap.get(p.user_id),
    }));
    
    setTeamPresence(typedData);
  }, []);

  // Update own presence
  const updatePresence = useCallback(async (status: 'online' | 'away' | 'busy' | 'offline', currentView?: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('dre_team_presence')
      .upsert({
        user_id: user.id,
        status,
        current_view: currentView || null,
        last_seen_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error updating presence:', error);
    }
  }, [user]);

  // Send channel message
  const sendChannelMessage = useCallback(async (
    channelId: string, 
    messageText: string, 
    messageType: 'text' | 'escalation' | 'system' | 'ai_summary' = 'text',
    metadata?: Record<string, unknown>
  ) => {
    if (!user) return;

    const { error } = await supabase
      .from('dre_team_messages')
      .insert([{
        channel_id: channelId,
        sender_id: user.id,
        message_text: messageText,
        message_type: messageType,
        metadata: (metadata || {}) as unknown as Record<string, never>,
      }]);

    if (error) {
      toast({
        title: 'Error sending message',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
    return true;
  }, [user, toast]);

  // Send direct message
  const sendDirectMessage = useCallback(async (recipientId: string, messageText: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('dre_direct_messages')
      .insert([{
        sender_id: user.id,
        recipient_id: recipientId,
        message_text: messageText,
      }]);

    if (error) {
      toast({
        title: 'Error sending message',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
    return true;
  }, [user, toast]);

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchChannels(), fetchTeamPresence()]);
      setIsLoading(false);
    };
    init();
  }, [fetchChannels, fetchTeamPresence]);

  // Fetch messages when channel changes
  useEffect(() => {
    if (selectedChannelId) {
      fetchMessages(selectedChannelId);
    }
  }, [selectedChannelId, fetchMessages]);

  // Fetch DMs when selected DM user changes
  useEffect(() => {
    if (selectedDmUserId) {
      fetchDirectMessages(selectedDmUserId);
    }
  }, [selectedDmUserId, fetchDirectMessages]);

  // Set up realtime subscriptions
  useEffect(() => {
    const channelSub = supabase
      .channel('team-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dre_team_messages' },
        (payload) => {
          const newMsg = payload.new as { channel_id: string };
          if (newMsg.channel_id === selectedChannelId) {
            fetchMessages(selectedChannelId);
          }
        }
      )
      .subscribe();

    const dmSub = supabase
      .channel('direct-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dre_direct_messages' },
        () => {
          if (selectedDmUserId) {
            fetchDirectMessages(selectedDmUserId);
          }
        }
      )
      .subscribe();

    const presenceSub = supabase
      .channel('team-presence')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dre_team_presence' },
        () => {
          fetchTeamPresence();
        }
      )
      .subscribe();

    return () => {
      channelSub.unsubscribe();
      dmSub.unsubscribe();
      presenceSub.unsubscribe();
    };
  }, [selectedChannelId, selectedDmUserId, fetchMessages, fetchDirectMessages, fetchTeamPresence]);

  // Update presence on mount and periodically
  useEffect(() => {
    updatePresence('online', 'command_center');

    const interval = setInterval(() => {
      updatePresence('online', 'command_center');
    }, 60000); // Every minute

    return () => {
      clearInterval(interval);
      updatePresence('offline');
    };
  }, [updatePresence]);

  return {
    channels,
    messages,
    directMessages,
    teamPresence,
    isLoading,
    selectedChannelId,
    setSelectedChannelId,
    selectedDmUserId,
    setSelectedDmUserId,
    sendChannelMessage,
    sendDirectMessage,
    updatePresence,
    fetchMessages,
    fetchDirectMessages,
  };
}
