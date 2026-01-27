import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TeamMember {
  userId: string;
  fullName: string;
  status: 'online' | 'away' | 'busy';
  currentConversationId: string | null;
  lastActiveAt: string;
}

export function useTeamPresence() {
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Track current conversation being viewed
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Initialize presence channel
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel('dre-team-presence', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const members: TeamMember[] = [];

        for (const [userId, presences] of Object.entries(state)) {
          const presence = (presences as any[])[0];
          if (presence) {
            members.push({
              userId,
              fullName: presence.fullName || 'Unknown',
              status: presence.status || 'online',
              currentConversationId: presence.currentConversationId || null,
              lastActiveAt: presence.lastActiveAt || new Date().toISOString(),
            });
          }
        }

        setTeamMembers(members);
        setIsConnected(true);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('Team member joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('Team member left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Get user profile for display name
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

          await channel.track({
            fullName: profile?.full_name || user.email || 'Unknown',
            status: 'online',
            currentConversationId: null,
            lastActiveAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.email]);

  // Update presence when viewing a conversation
  const updatePresence = useCallback(async (conversationId: string | null, status: 'online' | 'away' | 'busy' = 'online') => {
    if (!user?.id) return;

    setCurrentConversationId(conversationId);

    const channel = supabase.channel('dre-team-presence');
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    await channel.track({
      fullName: profile?.full_name || user.email || 'Unknown',
      status,
      currentConversationId: conversationId,
      lastActiveAt: new Date().toISOString(),
    });
  }, [user?.id, user?.email]);

  // Get who else is viewing a specific conversation
  const getViewersForConversation = useCallback((conversationId: string) => {
    return teamMembers.filter(m => 
      m.currentConversationId === conversationId && 
      m.userId !== user?.id
    );
  }, [teamMembers, user?.id]);

  // Check if current user is viewing a conversation
  const isViewingConversation = useCallback((conversationId: string) => {
    return currentConversationId === conversationId;
  }, [currentConversationId]);

  return {
    teamMembers,
    isConnected,
    updatePresence,
    getViewersForConversation,
    isViewingConversation,
    onlineCount: teamMembers.filter(m => m.status === 'online').length,
  };
}
