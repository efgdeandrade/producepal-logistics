import { formatDistanceToNow, format } from 'date-fns';
import { MessageSquare, User, Bot, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import type { ConversationThread, WhatsAppMessage } from '@/hooks/useWhatsAppMessages';

interface WhatsAppConversationThreadProps {
  thread: ConversationThread;
  onClose?: () => void;
}

export function WhatsAppConversationThread({ thread, onClose }: WhatsAppConversationThreadProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <User className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold">
              {thread.customer_name || 'Unknown Customer'}
            </h3>
            <p className="text-sm text-muted-foreground">{thread.phone_number}</p>
          </div>
        </div>
        {thread.customer_id && (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/distribution/customers`}>
              <ExternalLink className="h-4 w-4 mr-1" />
              View Customer
            </Link>
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {thread.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function MessageBubble({ message }: { message: WhatsAppMessage }) {
  const isInbound = message.direction === 'inbound';
  const isFromDre = message.direction === 'outbound';

  return (
    <div
      className={cn(
        'flex gap-2 max-w-[85%]',
        isInbound ? 'mr-auto' : 'ml-auto flex-row-reverse'
      )}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isInbound ? 'bg-muted' : 'bg-green-500/20'
        )}
      >
        {isInbound ? (
          <User className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Bot className="h-4 w-4 text-green-600" />
        )}
      </div>

      <div className="space-y-1">
        <div
          className={cn(
            'rounded-2xl px-4 py-2 text-sm',
            isInbound
              ? 'bg-muted rounded-tl-none'
              : 'bg-green-500 text-white rounded-tr-none'
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.message_text}</p>
        </div>
        <div
          className={cn(
            'flex items-center gap-2 text-xs text-muted-foreground',
            !isInbound && 'justify-end'
          )}
        >
          <span>{format(new Date(message.created_at), 'HH:mm')}</span>
          {message.status && message.status !== 'sent' && (
            <Badge variant="outline" className="text-[10px] py-0">
              {message.status}
            </Badge>
          )}
          {message.order_id && (
            <Badge variant="secondary" className="text-[10px] py-0">
              Order linked
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

interface ConversationListItemProps {
  thread: ConversationThread;
  isSelected: boolean;
  onClick: () => void;
}

export function ConversationListItem({ thread, isSelected, onClick }: ConversationListItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 p-3 text-left rounded-lg transition-colors',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
      )}
    >
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-green-600" />
        </div>
        {thread.unread_count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold px-1">
            {thread.unread_count}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium truncate">
            {thread.customer_name || thread.phone_number}
          </span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-muted-foreground truncate mt-0.5">
          {thread.last_message}
        </p>
      </div>
    </button>
  );
}
