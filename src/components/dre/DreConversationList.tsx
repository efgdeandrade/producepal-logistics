import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MessageSquare, 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  User,
  Bot,
  ArrowUpCircle
} from 'lucide-react';
import type { DreConversation } from '@/hooks/useDreConversations';

interface DreConversationListProps {
  conversations: DreConversation[];
  selectedId: string | null;
  onSelect: (conversation: DreConversation) => void;
  isLoading: boolean;
  filter: 'all' | 'urgent' | 'waiting' | 'taken_over';
}

export function DreConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  filter,
}: DreConversationListProps) {
  const filteredConversations = conversations.filter((c) => {
    switch (filter) {
      case 'urgent':
        return c.priority === 'urgent' || c.priority === 'high';
      case 'waiting':
        return c.status === 'waiting' || c.status === 'escalated';
      case 'taken_over':
        return c.is_taken_over;
      default:
        return true;
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-start gap-3 p-3">
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

  if (filteredConversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <MessageSquare className="h-10 w-10 mb-2 opacity-50" />
        <p className="text-sm">No conversations found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {filteredConversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            isSelected={selectedId === conversation.id}
            onClick={() => onSelect(conversation)}
          />
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
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-destructive';
      case 'high':
        return 'bg-amber-500';
      default:
        return 'bg-green-500';
    }
  };

  const getStatusIcon = () => {
    if (conversation.is_taken_over) {
      return <User className="h-3 w-3 text-blue-500" />;
    }
    switch (conversation.status) {
      case 'escalated':
        return <AlertCircle className="h-3 w-3 text-destructive" />;
      case 'waiting':
        return <Clock className="h-3 w-3 text-amber-500" />;
      case 'resolved':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      default:
        return <Bot className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getMoodEmoji = (mood: string | null) => {
    switch (mood) {
      case 'happy':
        return '😊';
      case 'frustrated':
        return '😤';
      case 'confused':
        return '🤔';
      case 'rushed':
        return '⏰';
      default:
        return null;
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 p-3 text-left rounded-lg transition-colors',
        isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'
      )}
    >
      {/* Avatar with priority ring */}
      <div className="relative flex-shrink-0">
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center',
            conversation.is_taken_over ? 'bg-blue-500/20' : 'bg-green-500/20'
          )}
        >
          {conversation.is_taken_over ? (
            <User className="h-5 w-5 text-blue-600" />
          ) : (
            <MessageSquare className="h-5 w-5 text-green-600" />
          )}
        </div>
        {/* Priority indicator */}
        <span
          className={cn(
            'absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-background',
            getPriorityColor(conversation.priority)
          )}
        />
        {/* Unread count */}
        {conversation.unread_count > 0 && (
          <span className="absolute -bottom-1 -right-1 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold px-1">
            {conversation.unread_count}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-medium truncate">
              {conversation.customer_name || conversation.phone_number}
            </span>
            {getMoodEmoji(conversation.detected_mood) && (
              <span className="text-sm">{getMoodEmoji(conversation.detected_mood)}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatDistanceToNow(new Date(conversation.last_activity_at), { addSuffix: true })}
          </span>
        </div>

        {/* Message preview */}
        <p className="text-sm text-muted-foreground truncate mt-0.5">
          {conversation.last_message_direction === 'outbound' && (
            <span className="text-green-600">Dre: </span>
          )}
          {conversation.last_message_text || 'No messages'}
        </p>

        {/* Status badges */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {getStatusIcon()}
            <span className="capitalize">{conversation.is_taken_over ? 'Human' : conversation.status}</span>
          </div>
          {conversation.detected_language && (
            <Badge variant="outline" className="text-[10px] py-0 px-1 uppercase">
              {conversation.detected_language}
            </Badge>
          )}
          {conversation.priority === 'urgent' && (
            <Badge variant="destructive" className="text-[10px] py-0 px-1">
              <ArrowUpCircle className="h-2.5 w-2.5 mr-0.5" />
              Urgent
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
