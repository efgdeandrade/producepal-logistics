import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  AlertCircle, 
  Clock, 
  UserCheck, 
  Bot, 
  MessageCircle,
  ChevronRight,
  Eye
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { DreConversation } from '@/hooks/useDreConversations';
import { TeamMember } from '@/hooks/useTeamPresence';

interface DreMobileConversationCardProps {
  conversation: DreConversation;
  isSelected: boolean;
  onSelect: () => void;
  viewers?: TeamMember[];
}

export function DreMobileConversationCard({
  conversation,
  isSelected,
  onSelect,
  viewers = [],
}: DreMobileConversationCardProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      default: return 'bg-green-500';
    }
  };

  const getStatusIcon = () => {
    if (conversation.is_taken_over) {
      return <UserCheck className="h-4 w-4 text-blue-500" />;
    }
    if (conversation.status === 'waiting' || conversation.status === 'escalated') {
      return <Clock className="h-4 w-4 text-amber-500" />;
    }
    return <Bot className="h-4 w-4 text-green-500" />;
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const timeAgo = formatDistanceToNow(new Date(conversation.last_activity_at), { addSuffix: true });

  return (
    <div
      onClick={onSelect}
      className={cn(
        'relative flex items-center gap-3 p-4 border-b active:bg-muted/50 transition-colors cursor-pointer',
        isSelected && 'bg-primary/5 border-l-4 border-l-primary',
        conversation.priority === 'urgent' && 'bg-red-50 dark:bg-red-950/20',
        conversation.priority === 'high' && 'bg-orange-50 dark:bg-orange-950/20'
      )}
    >
      {/* Priority indicator */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1',
          getPriorityColor(conversation.priority)
        )}
      />

      {/* Avatar */}
      <Avatar className="h-12 w-12 flex-shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {getInitials(conversation.customer_name)}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold truncate">
            {conversation.customer_name || conversation.phone_number}
          </span>
          {getStatusIcon()}
        </div>

        <p className="text-sm text-muted-foreground truncate mt-0.5">
          {conversation.last_message_direction === 'inbound' ? '← ' : '→ '}
          {conversation.last_message_text || 'No messages'}
        </p>

        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-muted-foreground">{timeAgo}</span>

          {conversation.unread_count > 0 && (
            <Badge 
              variant="destructive" 
              className="h-5 px-1.5 text-[10px] font-bold"
            >
              {conversation.unread_count}
            </Badge>
          )}

          {conversation.detected_language && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {conversation.detected_language.toUpperCase()}
            </Badge>
          )}

          {conversation.detected_mood === 'negative' && (
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-2">
        {viewers.length > 0 && (
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3 text-muted-foreground" />
            <div className="flex -space-x-1">
              {viewers.slice(0, 2).map((viewer) => (
                <Avatar key={viewer.userId} className="h-5 w-5 border-2 border-background">
                  <AvatarFallback className="text-[8px] bg-blue-100 text-blue-700">
                    {getInitials(viewer.fullName)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {viewers.length > 2 && (
                <div className="h-5 w-5 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                  <span className="text-[8px] font-medium">+{viewers.length - 2}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </div>
    </div>
  );
}
