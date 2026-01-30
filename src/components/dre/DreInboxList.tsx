import { format, isToday, isYesterday } from 'date-fns';
import { MessageSquare, User, AlertTriangle, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { DreConversation, ConversationGroup } from '@/hooks/useDreInbox';

interface DreInboxListProps {
  groups: ConversationGroup[];
  selectedPhone: string | null;
  onSelectConversation: (conversation: DreConversation) => void;
  isLoading?: boolean;
}

export function DreInboxList({ 
  groups, 
  selectedPhone, 
  onSelectConversation,
  isLoading 
}: DreInboxListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-lg font-medium">No conversations</p>
        <p className="text-sm">WhatsApp messages will appear here</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.label}>
            {/* Group header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 py-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </h3>
            </div>
            
            {/* Conversations in group */}
            <div className="space-y-1 px-2">
              {group.conversations.map((conv) => (
                <ConversationItem
                  key={conv.phone_number}
                  conversation={conv}
                  isSelected={selectedPhone === conv.phone_number}
                  onClick={() => onSelectConversation(conv)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

interface ConversationItemProps {
  conversation: DreConversation;
  isSelected: boolean;
  onClick: () => void;
}

function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Yesterday';
    }
    return format(date, 'MMM d');
  };

  const getMoodColor = (mood?: string) => {
    switch (mood) {
      case 'frustrated': return 'text-destructive';
      case 'happy': return 'text-green-600';
      case 'confused': return 'text-yellow-600';
      default: return '';
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 p-3 text-left rounded-xl transition-all',
        isSelected 
          ? 'bg-primary/10 ring-1 ring-primary/20' 
          : 'hover:bg-muted/50'
      )}
    >
      {/* Avatar with status indicators */}
      <div className="relative flex-shrink-0">
        <div className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
          conversation.unread_count > 0 
            ? 'bg-primary/20' 
            : 'bg-muted'
        )}>
          <User className={cn(
            'h-5 w-5',
            conversation.unread_count > 0 
              ? 'text-primary' 
              : 'text-muted-foreground'
          )} />
        </div>
        
        {/* Unread badge */}
        {conversation.unread_count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold px-1.5 animate-in zoom-in">
            {conversation.unread_count}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={cn(
            'font-medium truncate',
            conversation.unread_count > 0 && 'font-semibold'
          )}>
            {conversation.customer_name || conversation.phone_number}
          </span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatTime(conversation.last_message_at)}
          </span>
        </div>
        
        {/* Last message preview */}
        <p className={cn(
          'text-sm truncate',
          conversation.unread_count > 0 
            ? 'text-foreground font-medium' 
            : 'text-muted-foreground'
        )}>
          {conversation.last_message_direction === 'outbound' && (
            <span className="text-muted-foreground">Dre: </span>
          )}
          {conversation.last_message}
        </p>
        
        {/* Status badges */}
        <div className="flex items-center gap-1.5 mt-1.5">
          {conversation.has_pending_order && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-5">
              <ShoppingCart className="h-2.5 w-2.5 mr-0.5" />
              Order
            </Badge>
          )}
          {conversation.is_escalated && (
            <Badge variant="destructive" className="text-[10px] py-0 px-1.5 h-5">
              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
              Escalated
            </Badge>
          )}
          {conversation.customer_mood && conversation.customer_mood !== 'neutral' && (
            <span className={cn('text-xs', getMoodColor(conversation.customer_mood))}>
              {conversation.customer_mood}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
