import { format, isToday, isYesterday } from 'date-fns';
import { User, Bot, Check, CheckCheck, Clock, UserCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { DreMessage } from '@/hooks/useDreInbox';

interface DreMessageBubbleProps {
  message: DreMessage;
  showDate?: boolean;
}

export function DreMessageBubble({ message, showDate }: DreMessageBubbleProps) {
  const isInbound = message.direction === 'inbound';
  const isHuman = message.is_human_response;
  const isDre = message.direction === 'outbound' && !isHuman;

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    }
    return format(date, "EEEE, MMMM d, yyyy 'at' h:mm a");
  };

  const renderStatusIcon = () => {
    if (isInbound) return null;
    
    switch (message.status) {
      case 'sent':
        return <Check className="h-3 w-3 text-white/70" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-white/70" />;
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-300" />;
      case 'pending':
        return <Clock className="h-3 w-3 text-white/70" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        'flex gap-2 max-w-[85%]',
        isInbound ? 'mr-auto' : 'ml-auto flex-row-reverse'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1',
          isInbound 
            ? 'bg-muted' 
            : isHuman 
              ? 'bg-blue-500/20' 
              : 'bg-green-500/20'
        )}
      >
        {isInbound ? (
          <User className="h-4 w-4 text-muted-foreground" />
        ) : isHuman ? (
          <UserCircle className="h-4 w-4 text-blue-600" />
        ) : (
          <Bot className="h-4 w-4 text-green-600" />
        )}
      </div>

      <div className="space-y-1 flex-1 min-w-0">
        {/* Sender label for outbound */}
        {!isInbound && (
          <div className={cn('text-xs font-medium', isInbound ? '' : 'text-right')}>
            {isHuman ? 'Team Member' : 'Dre AI'}
          </div>
        )}
        
        {/* Message bubble */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                  isInbound
                    ? 'bg-muted rounded-tl-md'
                    : isHuman
                      ? 'bg-blue-500 text-white rounded-tr-md'
                      : 'bg-green-500 text-white rounded-tr-md'
                )}
              >
                <p className="whitespace-pre-wrap break-words leading-relaxed">
                  {message.message_text}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side={isInbound ? 'right' : 'left'}>
              <p className="text-xs">{formatFullDate(message.created_at)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* Timestamp and status */}
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs text-muted-foreground',
            !isInbound && 'justify-end'
          )}
        >
          <span>{format(new Date(message.created_at), 'HH:mm')}</span>
          {renderStatusIcon()}
          {message.order_id && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
              Order
            </Badge>
          )}
          {message.detected_mood && message.detected_mood !== 'neutral' && (
            <Badge 
              variant={message.detected_mood === 'frustrated' ? 'destructive' : 'outline'} 
              className="text-[10px] py-0 px-1.5"
            >
              {message.detected_mood}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

interface DateSeparatorProps {
  date: string;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  const dateObj = new Date(date);
  let label: string;
  
  if (isToday(dateObj)) {
    label = 'Today';
  } else if (isYesterday(dateObj)) {
    label = 'Yesterday';
  } else {
    label = format(dateObj, 'EEEE, MMMM d, yyyy');
  }

  return (
    <div className="flex items-center justify-center my-4">
      <div className="bg-muted/50 text-muted-foreground text-xs font-medium px-3 py-1 rounded-full">
        {label}
      </div>
    </div>
  );
}
