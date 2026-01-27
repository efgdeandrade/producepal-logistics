import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, MessageSquare, Users } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';

interface TeamMessage {
  id: string;
  user_id: string;
  message_text: string;
  conversation_id: string | null;
  created_at: string;
  user?: {
    full_name: string;
  } | null;
}

interface DreTeamChatProps {
  conversationId?: string | null;
  minimal?: boolean;
}

export function DreTeamChat({ conversationId, minimal = false }: DreTeamChatProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messageInput, setMessageInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch team messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['dre-team-chat', conversationId],
    queryFn: async () => {
      let query = supabase
        .from('dre_team_chat')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

      if (conversationId) {
        query = query.eq('conversation_id', conversationId);
      } else {
        query = query.is('conversation_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch user names
      const messagesWithUsers = await Promise.all(
        (data || []).map(async (msg) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', msg.user_id)
            .single();
          return { ...msg, user: profile } as TeamMessage;
        })
      );

      return messagesWithUsers;
    },
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('dre-team-chat-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dre_team_chat',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dre-team-chat', conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, conversationId]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase.from('dre_team_chat').insert({
        user_id: user.id,
        message_text: text,
        conversation_id: conversationId || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['dre-team-chat', conversationId] });
    },
  });

  const handleSend = () => {
    if (!messageInput.trim()) return;
    sendMessage.mutate(messageInput.trim());
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Yesterday ' + format(date, 'HH:mm');
    }
    return format(date, 'MMM d, HH:mm');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (minimal) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {conversationId ? 'Thread Notes' : 'Team Chat'}
          </span>
          {messages.length > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {messages.length} messages
            </span>
          )}
        </div>

        <ScrollArea ref={scrollRef} className="flex-1 p-3">
          <div className="space-y-3">
            {messages.map((msg) => {
              const isOwn = msg.user_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-2',
                    isOwn && 'flex-row-reverse'
                  )}
                >
                  <Avatar className="h-7 w-7 flex-shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(msg.user?.full_name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn('max-w-[80%]', isOwn && 'text-right')}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {isOwn ? 'You' : msg.user?.full_name || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatMessageTime(msg.created_at)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'mt-1 p-2 rounded-lg text-sm',
                        isOwn
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      {msg.message_text}
                    </div>
                  </div>
                </div>
              );
            })}

            {messages.length === 0 && !isLoading && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No messages yet</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t bg-background">
          <div className="flex gap-2">
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!messageInput.trim() || sendMessage.isPending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Full version for larger screens
  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b bg-card">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">
          {conversationId ? 'Thread Discussion' : 'Team Chat'}
        </h3>
        {messages.length > 0 && (
          <span className="text-sm text-muted-foreground ml-auto">
            {messages.length} messages
          </span>
        )}
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg) => {
            const isOwn = msg.user_id === user?.id;
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-3',
                  isOwn && 'flex-row-reverse'
                )}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {getInitials(msg.user?.full_name || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className={cn('max-w-[75%]', isOwn && 'text-right')}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {isOwn ? 'You' : msg.user?.full_name || 'Unknown'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatMessageTime(msg.created_at)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'p-3 rounded-xl text-sm',
                      isOwn
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-muted rounded-tl-sm'
                    )}
                  >
                    {msg.message_text}
                  </div>
                </div>
              </div>
            );
          })}

          {messages.length === 0 && !isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No messages yet</p>
              <p className="text-sm mt-1">
                Start a conversation with your team
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-card">
        <div className="flex gap-2">
          <Input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type a message to your team..."
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!messageInput.trim() || sendMessage.isPending}
          >
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
