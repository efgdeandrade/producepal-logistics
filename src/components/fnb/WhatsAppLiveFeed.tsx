import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, User, Bot, ArrowRight, Volume2, VolumeX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useWhatsAppMessages } from '@/hooks/useWhatsAppMessages';

export function WhatsAppLiveFeed() {
  const { messages, isLoading, totalUnread } = useWhatsAppMessages(20);
  const [soundEnabled, setSoundEnabled] = useState(true);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            Dre Live Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="relative">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            Dre Live Feed
            {totalUnread > 0 && (
              <Badge variant="destructive" className="ml-2">
                {totalUnread} new
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/distribution/whatsapp-inbox">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[350px] pr-4">
          {messages && messages.length > 0 ? (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex items-start gap-3 p-2 rounded-lg transition-colors',
                    msg.direction === 'inbound' && 'bg-muted/50'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                      msg.direction === 'inbound' ? 'bg-muted' : 'bg-green-500/20'
                    )}
                  >
                    {msg.direction === 'inbound' ? (
                      <User className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Bot className="h-4 w-4 text-green-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {msg.direction === 'inbound' ? (
                          msg.customer?.name || msg.phone_number
                        ) : (
                          <span className="text-green-600">Dre</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {msg.message_text}
                    </p>
                    {msg.order_id && (
                      <Badge variant="secondary" className="text-[10px] mt-1">
                        Order linked
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No WhatsApp messages yet</p>
              <p className="text-xs">Messages from Dre will appear here</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
