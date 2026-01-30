import { useState, useEffect, useRef } from 'react';
import { format, isSameDay } from 'date-fns';
import { User, ExternalLink, Phone, MapPin, ShoppingCart, Send } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Link } from 'react-router-dom';
import { DreMessageBubble, DateSeparator } from './DreMessageBubble';
import type { DreConversation } from '@/hooks/useDreInbox';

interface DreConversationPanelProps {
  conversation: DreConversation;
  onClose?: () => void;
}

export function DreConversationPanel({ conversation, onClose }: DreConversationPanelProps) {
  const [replyText, setReplyText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation.messages]);

  // Group messages by date for separators
  const messagesWithSeparators = conversation.messages.reduce<Array<{ type: 'separator' | 'message'; date?: string; message?: typeof conversation.messages[0] }>>((acc, msg, idx) => {
    const msgDate = new Date(msg.created_at);
    const prevMsg = conversation.messages[idx - 1];
    
    // Add date separator if this is first message or different day than previous
    if (!prevMsg || !isSameDay(msgDate, new Date(prevMsg.created_at))) {
      acc.push({ type: 'separator', date: msg.created_at });
    }
    
    acc.push({ type: 'message', message: msg });
    return acc;
  }, []);

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    // TODO: Implement send reply via edge function
    console.log('Sending reply:', replyText);
    setReplyText('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
            <User className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {conversation.customer_name || 'Unknown Customer'}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              <span>{conversation.phone_number}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {conversation.is_escalated && (
            <Badge variant="destructive">Escalated</Badge>
          )}
          {conversation.has_pending_order && (
            <Badge className="bg-orange-500">
              <ShoppingCart className="h-3 w-3 mr-1" />
              Pending Order
            </Badge>
          )}
          {conversation.customer_id && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/distribution/customers`}>
                <ExternalLink className="h-4 w-4 mr-1" />
                View Profile
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3 pb-4">
          {messagesWithSeparators.map((item, idx) => 
            item.type === 'separator' ? (
              <DateSeparator key={`sep-${item.date}`} date={item.date!} />
            ) : (
              <DreMessageBubble key={item.message!.id} message={item.message!} />
            )
          )}
        </div>
      </ScrollArea>

      {/* Reply input */}
      <div className="p-4 border-t bg-card">
        <div className="flex gap-2">
          <Input
            placeholder="Type a reply as team member..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendReply();
              }
            }}
            className="flex-1"
          />
          <Button 
            onClick={handleSendReply}
            disabled={!replyText.trim()}
            className="bg-green-500 hover:bg-green-600"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Replies will be sent as a team member, not Dre AI
        </p>
      </div>
    </div>
  );
}
