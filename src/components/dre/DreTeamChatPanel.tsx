import { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { Send, Hash, Pin, MoreVertical, AtSign, Smile, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TeamChannel, TeamMessage, DirectMessage, TeamPresence } from '@/hooks/useDreTeamChat';
import { useAuth } from '@/contexts/AuthContext';

type ChatMessage = TeamMessage | DirectMessage;

interface DreTeamChatPanelProps {
  mode: 'channel' | 'dm';
  channel?: TeamChannel | null;
  messages: ChatMessage[];
  dmRecipient?: TeamPresence | null;
  onSendMessage: (text: string) => Promise<boolean | void>;
}

export function DreTeamChatPanel({
  mode,
  channel,
  messages,
  dmRecipient,
  onSendMessage,
}: DreTeamChatPanelProps) {
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;
    
    setIsSending(true);
    const success = await onSendMessage(newMessage.trim());
    if (success !== false) {
      setNewMessage('');
    }
    setIsSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = format(new Date(msg.created_at), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(msg);
    return groups;
  }, {} as Record<string, ChatMessage[]>);

  const getMessageTypeStyle = (msg: ChatMessage) => {
    if ('message_type' in msg) {
      switch (msg.message_type) {
        case 'escalation':
          return 'border-l-4 border-l-destructive bg-destructive/5';
        case 'system':
          return 'bg-muted/50 italic';
        case 'ai_summary':
          return 'border-l-4 border-l-primary bg-primary/5';
        default:
          return '';
      }
    }
    return '';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          {mode === 'channel' && channel ? (
            <>
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Hash className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{channel.name}</h3>
                <p className="text-xs text-muted-foreground">{channel.description}</p>
              </div>
            </>
          ) : dmRecipient ? (
            <>
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {dmRecipient.user?.full_name?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">
                  {dmRecipient.user?.full_name || dmRecipient.user?.email}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {dmRecipient.status === 'online' ? (
                    <span className="text-primary">Online</span>
                  ) : (
                    `Last seen ${formatDistanceToNow(new Date(dmRecipient.last_seen_at), { addSuffix: true })}`
                  )}
                </p>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Select a channel or conversation</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pin className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {Object.entries(groupedMessages).map(([date, dayMessages]) => (
          <div key={date}>
            {/* Date separator */}
            <div className="flex items-center gap-4 my-4">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground font-medium">
                {format(new Date(date), 'EEEE, MMMM d')}
              </span>
              <Separator className="flex-1" />
            </div>

            {/* Messages for this day */}
            <div className="space-y-4">
              {dayMessages.map((msg, index) => {
                const isOwn = msg.sender_id === user?.id;
                const sender = 'sender' in msg ? msg.sender : null;
                const messageType = 'message_type' in msg ? msg.message_type : 'text';
                const isPinned = 'is_pinned' in msg ? msg.is_pinned : false;

                // Check if this is a continuation from same sender
                const prevMsg = dayMessages[index - 1];
                const isContinuation = prevMsg && 
                  prevMsg.sender_id === msg.sender_id &&
                  new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 300000; // 5 minutes

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "group relative",
                      getMessageTypeStyle(msg)
                    )}
                  >
                    {!isContinuation && (
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {sender?.full_name?.charAt(0) || sender?.email?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-sm">
                          {sender?.full_name || sender?.email?.split('@')[0] || 'Unknown'}
                          {isOwn && <span className="text-muted-foreground ml-1">(you)</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(msg.created_at), 'h:mm a')}
                        </span>
                        {isPinned && (
                          <Pin className="h-3 w-3 text-primary" />
                        )}
                        {messageType === 'escalation' && (
                          <Badge variant="outline" className="text-[10px] h-5 bg-destructive/10 text-destructive">
                            Escalation
                          </Badge>
                        )}
                        {messageType === 'ai_summary' && (
                          <Badge variant="outline" className="text-[10px] h-5 bg-primary/10 text-primary">
                            AI Summary
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className={cn("pl-10", isContinuation && "pl-10")}>
                      <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Hash className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Be the first to say something!</p>
          </div>
        )}
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 border-t bg-background">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
            <Paperclip className="h-4 w-4" />
          </Button>
          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                mode === 'channel' && channel
                  ? `Message #${channel.name}`
                  : dmRecipient
                  ? `Message ${dmRecipient.user?.full_name || 'user'}`
                  : 'Type a message...'
              }
              className="pr-20"
              disabled={isSending}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <AtSign className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Smile className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button 
            onClick={handleSend} 
            disabled={!newMessage.trim() || isSending}
            size="icon"
            className="h-9 w-9 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
