import { useState, useEffect, useRef } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  User, 
  Bot, 
  Send, 
  UserCheck, 
  RotateCcw, 
  StickyNote, 
  ThumbsUp, 
  ThumbsDown,
  AlertTriangle,
  ExternalLink,
  Clock,
  CheckCircle,
  MoreVertical,
  Pin,
  History
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { DreConversation } from '@/hooks/useDreConversations';
import { 
  useConversationActions, 
  useConversationNotes, 
  useResponseFeedback,
  useSendTeamMessage 
} from '@/hooks/useDreConversations';
import type { WhatsAppMessage } from '@/hooks/useWhatsAppMessages';

interface DreConversationDetailProps {
  conversation: DreConversation;
}

export function DreConversationDetail({ conversation }: DreConversationDetailProps) {
  const [messageInput, setMessageInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<WhatsAppMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { takeOver, returnToDre, markResolved } = useConversationActions();
  const { notes, addNote, togglePin } = useConversationNotes(conversation.id);
  const { submitFeedback } = useResponseFeedback();
  const { sendMessage } = useSendTeamMessage();

  // Fetch messages for this conversation
  const { data: messages = [] } = useQuery({
    queryKey: ['conversation-messages', conversation.phone_number],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('phone_number', conversation.phone_number)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as WhatsAppMessage[];
    },
  });

  // Subscribe to new messages
  useEffect(() => {
    const channel = supabase
      .channel(`messages-${conversation.phone_number}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `phone_number=eq.${conversation.phone_number}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversation.phone_number] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.phone_number, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;

    try {
      await sendMessage.mutateAsync({
        phoneNumber: conversation.phone_number,
        messageText: messageInput.trim(),
        customerId: conversation.customer_id || undefined,
      });
      setMessageInput('');
      toast({ title: 'Message sent' });
    } catch (error) {
      toast({ title: 'Failed to send message', variant: 'destructive' });
    }
  };

  const handleAddNote = async () => {
    if (!noteInput.trim()) return;

    try {
      await addNote.mutateAsync({
        conversationId: conversation.id,
        noteText: noteInput.trim(),
      });
      setNoteInput('');
      toast({ title: 'Note added' });
    } catch (error) {
      toast({ title: 'Failed to add note', variant: 'destructive' });
    }
  };

  const handleTakeOver = async () => {
    try {
      await takeOver.mutateAsync({ conversationId: conversation.id });
      toast({ title: 'Conversation taken over', description: 'Dre will no longer respond automatically' });
    } catch (error) {
      toast({ title: 'Failed to take over', variant: 'destructive' });
    }
  };

  const handleReturnToDre = async () => {
    try {
      await returnToDre.mutateAsync(conversation.id);
      toast({ title: 'Returned to Dre', description: 'AI will resume automatic responses' });
    } catch (error) {
      toast({ title: 'Failed to return to Dre', variant: 'destructive' });
    }
  };

  const handleMarkResolved = async () => {
    try {
      await markResolved.mutateAsync(conversation.id);
      toast({ title: 'Marked as resolved' });
    } catch (error) {
      toast({ title: 'Failed to mark resolved', variant: 'destructive' });
    }
  };

  const handleFeedback = async (rating: 'good' | 'needs_improvement' | 'wrong') => {
    if (!selectedMessage) return;

    try {
      await submitFeedback.mutateAsync({
        messageId: selectedMessage.id,
        conversationId: conversation.id,
        originalResponse: selectedMessage.message_text,
        rating,
      });
      setFeedbackOpen(false);
      setSelectedMessage(null);
      toast({ title: 'Feedback submitted', description: 'This helps Dre learn!' });
    } catch (error) {
      toast({ title: 'Failed to submit feedback', variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            conversation.is_taken_over ? 'bg-blue-500/20' : 'bg-green-500/20'
          )}>
            {conversation.is_taken_over ? (
              <User className="h-5 w-5 text-blue-600" />
            ) : (
              <Bot className="h-5 w-5 text-green-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">
                {conversation.customer_name || 'Unknown Customer'}
              </h3>
              {conversation.is_taken_over && (
                <Badge variant="secondary" className="text-xs">
                  <UserCheck className="h-3 w-3 mr-1" />
                  Human Mode
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{conversation.phone_number}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conversation.is_taken_over ? (
            <Button variant="outline" size="sm" onClick={handleReturnToDre}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Return to Dre
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={handleTakeOver}>
              <UserCheck className="h-4 w-4 mr-1" />
              Take Over
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleMarkResolved}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Resolved
              </DropdownMenuItem>
              {conversation.customer_id && (
                <DropdownMenuItem asChild>
                  <a href={`/distribution/customers`} className="flex items-center">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Customer
                  </a>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Messages */}
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onFeedback={() => {
                    if (msg.direction === 'outbound' && !msg.is_human_response) {
                      setSelectedMessage(msg);
                      setFeedbackOpen(true);
                    }
                  }}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message input area - always visible but with different states */}
          <div className={cn(
            "border-t transition-all",
            conversation.is_taken_over ? "bg-blue-50 dark:bg-blue-950/20" : "bg-muted/30"
          )}>
            {conversation.is_taken_over ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      You are responding as FUIK Team
                    </span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleReturnToDre}
                    className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                  >
                    <Bot className="h-4 w-4 mr-1" />
                    Return to Dre
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message to send as FUIK Team..."
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    className="bg-white dark:bg-background"
                  />
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={!messageInput.trim() || sendMessage.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">
                      Dre is handling this conversation
                    </span>
                  </div>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleTakeOver}
                  >
                    <UserCheck className="h-4 w-4 mr-1" />
                    Take Over & Chat
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Side panel - Notes & Context */}
        <div className="w-80 border-l bg-muted/20 hidden lg:block">
          <Tabs defaultValue="notes" className="h-full flex flex-col">
            <TabsList className="m-2">
              <TabsTrigger value="notes" className="flex-1">
                <StickyNote className="h-4 w-4 mr-1" />
                Notes
              </TabsTrigger>
              <TabsTrigger value="context" className="flex-1">
                <History className="h-4 w-4 mr-1" />
                Context
              </TabsTrigger>
            </TabsList>

            <TabsContent value="notes" className="flex-1 m-0 p-2 overflow-hidden flex flex-col">
              <div className="space-y-2 mb-2">
                <Textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Add internal note..."
                  rows={2}
                />
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!noteInput.trim() || addNote.isPending}
                  className="w-full"
                >
                  Add Note
                </Button>
              </div>
              <Separator className="my-2" />
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {notes?.map((note) => (
                    <Card key={note.id} className={cn(note.is_pinned && 'border-primary')}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm">{note.note_text}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => togglePin.mutate({ noteId: note.id, isPinned: note.is_pinned })}
                          >
                            <Pin className={cn('h-3 w-3', note.is_pinned && 'text-primary fill-primary')} />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {note.user?.full_name} • {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                  {(!notes || notes.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No notes yet
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="context" className="flex-1 m-0 p-2 overflow-auto">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-sm">Customer Info</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 text-sm space-y-1">
                    <p><strong>Phone:</strong> {conversation.phone_number}</p>
                    <p><strong>Language:</strong> {conversation.detected_language?.toUpperCase() || 'Unknown'}</p>
                    <p><strong>Mood:</strong> {conversation.detected_mood || 'Neutral'}</p>
                    <p><strong>Status:</strong> {conversation.status}</p>
                  </CardContent>
                </Card>

                {conversation.is_taken_over && (
                  <Card className="border-blue-200 bg-blue-50/50">
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-sm flex items-center gap-1">
                        <UserCheck className="h-4 w-4" />
                        Takeover Info
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 text-sm space-y-1">
                      <p><strong>Reason:</strong> {conversation.takeover_reason}</p>
                      <p><strong>Since:</strong> {conversation.taken_over_at ? formatDistanceToNow(new Date(conversation.taken_over_at), { addSuffix: true }) : 'Unknown'}</p>
                      <p><strong>By:</strong> {conversation.assigned_user?.full_name || 'Unknown'}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate Dre's Response</DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                {selectedMessage.message_text}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleFeedback('good')}
                >
                  <ThumbsUp className="h-4 w-4 mr-2 text-green-500" />
                  Good
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleFeedback('needs_improvement')}
                >
                  <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
                  Needs Work
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleFeedback('wrong')}
                >
                  <ThumbsDown className="h-4 w-4 mr-2 text-destructive" />
                  Wrong
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MessageBubbleProps {
  message: WhatsAppMessage;
  onFeedback: () => void;
}

function MessageBubble({ message, onFeedback }: MessageBubbleProps) {
  const isInbound = message.direction === 'inbound';
  const isHuman = message.is_human_response;

  return (
    <div
      className={cn(
        'flex gap-2 max-w-[85%] group',
        isInbound ? 'mr-auto' : 'ml-auto flex-row-reverse'
      )}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isInbound ? 'bg-muted' : isHuman ? 'bg-blue-500/20' : 'bg-green-500/20'
        )}
      >
        {isInbound ? (
          <User className="h-4 w-4 text-muted-foreground" />
        ) : isHuman ? (
          <User className="h-4 w-4 text-blue-600" />
        ) : (
          <Bot className="h-4 w-4 text-green-600" />
        )}
      </div>

      <div className="space-y-1">
        <div
          className={cn(
            'rounded-2xl px-4 py-2 text-sm relative',
            isInbound
              ? 'bg-muted rounded-tl-none'
              : isHuman
              ? 'bg-blue-500 text-white rounded-tr-none'
              : 'bg-green-500 text-white rounded-tr-none'
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.message_text}</p>
          
          {/* Feedback button for Dre messages */}
          {!isInbound && !isHuman && (
            <button
              onClick={onFeedback}
              className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-muted"
              title="Rate this response"
            >
              <ThumbsUp className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <div
          className={cn(
            'flex items-center gap-2 text-xs text-muted-foreground',
            !isInbound && 'justify-end'
          )}
        >
          {isHuman && <Badge variant="outline" className="text-[10px] py-0">Human</Badge>}
          <span>{format(new Date(message.created_at), 'HH:mm')}</span>
          {message.status && message.status !== 'sent' && (
            <Badge variant="outline" className="text-[10px] py-0">
              {message.status}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
