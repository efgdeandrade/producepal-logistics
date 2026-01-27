import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Search, 
  MessageSquare, 
  RefreshCw,
  AlertCircle,
  Clock,
  UserCheck,
  Bot,
  Volume2,
  VolumeX,
  ArrowLeft,
  Phone,
  Send,
  MoreVertical,
  Users,
  X
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDreConversations, type DreConversation } from '@/hooks/useDreConversations';
import { useTeamPresence } from '@/hooks/useTeamPresence';
import { DreTeamChat } from '@/components/dre/DreTeamChat';
import { playOrderNotificationSound } from '@/utils/audioNotification';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function DreApp() {
  const isMobile = useIsMobile();
  const { conversations, isLoading } = useDreConversations();
  const { teamMembers, onlineCount, updatePresence, getViewersForConversation } = useTeamPresence();
  const [selectedConversation, setSelectedConversation] = useState<DreConversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'urgent' | 'waiting' | 'taken_over'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showTeamChat, setShowTeamChat] = useState(false);
  const queryClient = useQueryClient();

  // Filter conversations
  const filteredConversations = (conversations || []).filter((c) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      c.phone_number.toLowerCase().includes(query) ||
      (c.customer_name?.toLowerCase().includes(query) ?? false) ||
      (c.last_message_text?.toLowerCase().includes(query) ?? false);
    
    if (filter === 'urgent') {
      return matchesSearch && (c.priority === 'urgent' || c.priority === 'high');
    }
    if (filter === 'waiting') {
      return matchesSearch && (c.status === 'waiting' || c.status === 'escalated');
    }
    if (filter === 'taken_over') {
      return matchesSearch && c.is_taken_over;
    }
    
    return matchesSearch;
  });

  // Sort by priority
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, normal: 2 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
  });

  // Count stats
  const urgentCount = filteredConversations.filter(c => c.priority === 'urgent' || c.priority === 'high').length;
  const waitingCount = filteredConversations.filter(c => c.status === 'waiting' || c.status === 'escalated').length;
  const takenOverCount = filteredConversations.filter(c => c.is_taken_over).length;
  const totalUnread = filteredConversations.reduce((sum, c) => sum + c.unread_count, 0);

  // Sound alert for urgent conversations
  useEffect(() => {
    if (soundEnabled && urgentCount > 0) {
      const timer = setTimeout(() => {
        playOrderNotificationSound();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [urgentCount, soundEnabled]);

  // Track which conversation we're viewing
  useEffect(() => {
    if (selectedConversation) {
      updatePresence(selectedConversation.id);
    } else {
      updatePresence(null);
    }
  }, [selectedConversation, updatePresence]);

  // Sync conversations
  useEffect(() => {
    const syncConversations = async () => {
      const { data: messages } = await supabase
        .from('whatsapp_messages')
        .select('phone_number, customer_id, message_text, direction, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (!messages) return;

      const phoneMap = new Map<string, typeof messages[0]>();
      for (const msg of messages) {
        if (!phoneMap.has(msg.phone_number)) {
          phoneMap.set(msg.phone_number, msg);
        }
      }

      for (const [phone, msg] of phoneMap) {
        const inboundCount = messages.filter(m => 
          m.phone_number === phone && 
          m.direction === 'inbound' &&
          new Date(m.created_at).getTime() > Date.now() - 60 * 60 * 1000
        ).length;

        await supabase
          .from('whatsapp_conversations')
          .upsert({
            phone_number: phone,
            customer_id: msg.customer_id,
            last_message_text: msg.message_text,
            last_message_direction: msg.direction,
            last_activity_at: msg.created_at,
            unread_count: msg.direction === 'inbound' ? inboundCount : 0,
          }, {
            onConflict: 'phone_number',
          });
      }

      queryClient.invalidateQueries({ queryKey: ['dre-conversations'] });
    };

    syncConversations();

    const channel = supabase
      .channel('whatsapp-sync-dre-app')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        () => {
          syncConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dre-conversations'] });
    queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
  };

  const handleSelectConversation = (conv: DreConversation) => {
    setSelectedConversation(conv);
  };

  const handleBack = () => {
    setSelectedConversation(null);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-orange-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getMoodEmoji = (mood?: string) => {
    switch (mood) {
      case 'happy': return '😊';
      case 'frustrated': return '😤';
      case 'confused': return '😕';
      case 'urgent': return '🚨';
      default: return null;
    }
  };

  // Conversation List View
  const ConversationListView = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b safe-area-top">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Dre Command Center</h1>
              <p className="text-xs text-muted-foreground">
                {onlineCount} team member{onlineCount !== 1 ? 's' : ''} online
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalUnread > 0 && (
              <Badge variant="destructive">{totalUnread}</Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-muted-foreground" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 px-4 pb-3 text-sm overflow-x-auto">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="font-semibold">{urgentCount}</span>
            <span className="text-muted-foreground">Urgent</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="font-semibold">{waitingCount}</span>
            <span className="text-muted-foreground">Waiting</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <UserCheck className="h-4 w-4 text-blue-500" />
            <span className="font-semibold">{takenOverCount}</span>
            <span className="text-muted-foreground">Human</span>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="px-4 pb-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="urgent" className="text-xs">
                Urgent {urgentCount > 0 && <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">{urgentCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="waiting" className="text-xs">Waiting</TabsTrigger>
              <TabsTrigger value="taken_over" className="text-xs">Human</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : sortedConversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No conversations found</p>
            </div>
          ) : (
            sortedConversations.map((conv) => {
              const viewingUsers = getViewersForConversation(conv.id);
              
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={cn(
                    "w-full p-4 text-left hover:bg-muted/50 transition-colors",
                    selectedConversation?.id === conv.id && "bg-muted"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {(conv.customer_name || conv.phone_number).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">
                          {conv.customer_name || conv.phone_number}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(conv.last_activity_at), 'HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {conv.last_message_direction === 'outbound' && (
                          <span className="text-green-600 mr-1">Dre:</span>
                        )}
                        {conv.last_message_text || 'No messages'}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {(conv.priority === 'urgent' || conv.priority === 'high') && (
                          <Badge className={cn("text-[10px] h-5", getPriorityColor(conv.priority))}>
                            {conv.priority}
                          </Badge>
                        )}
                        {conv.is_taken_over && (
                          <Badge variant="outline" className="text-[10px] h-5 border-blue-500 text-blue-600">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Human
                          </Badge>
                        )}
                        {conv.unread_count > 0 && (
                          <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                            {conv.unread_count}
                          </Badge>
                        )}
                        {viewingUsers.length > 0 && (
                          <div className="flex -space-x-1">
                            {viewingUsers.slice(0, 2).map((u, i) => (
                              <div
                                key={i}
                                className="h-5 w-5 rounded-full bg-primary border-2 border-background flex items-center justify-center"
                              >
                                <span className="text-[8px] text-primary-foreground font-bold">
                                  {u.fullName.slice(0, 1).toUpperCase()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Conversation Detail View (Mobile)
  const ConversationDetailView = () => {
    if (!selectedConversation) return null;

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b safe-area-top">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {(selectedConversation.customer_name || selectedConversation.phone_number).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold truncate">
                {selectedConversation.customer_name || selectedConversation.phone_number}
              </h2>
              <p className="text-xs text-muted-foreground">{selectedConversation.phone_number}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTeamChat(!showTeamChat)}
            >
              <Users className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {showTeamChat ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                <span className="font-medium text-sm">Team Notes</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowTeamChat(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <DreTeamChat conversationId={selectedConversation.id} />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground p-4">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Message thread will appear here</p>
                <p className="text-xs mt-1">Connect to WhatsApp messages for full conversation view</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 border-t bg-background p-4 safe-area-bottom">
          <div className="flex items-center gap-2">
            <Button variant="outline" className="flex-1" asChild>
              <a href={`tel:${selectedConversation.phone_number}`}>
                <Phone className="h-4 w-4 mr-2" />
                Call
              </a>
            </Button>
            <Button className="flex-1">
              <Send className="h-4 w-4 mr-2" />
              Send Message
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Desktop Layout
  if (!isMobile) {
    return (
      <div className="h-screen flex flex-col bg-background">
        {/* Desktop Header */}
        <header className="border-b bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between p-4 max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-xl">Dre Command Center</h1>
                <p className="text-sm text-muted-foreground">
                  {onlineCount} team member{onlineCount !== 1 ? 's' : ''} online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {totalUnread > 0 && (
                <Badge variant="destructive" className="text-sm">{totalUnread} unread</Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSoundEnabled(!soundEnabled)}
              >
                {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-muted-foreground" />}
              </Button>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to FUIK
                </Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Desktop Content */}
        <div className="flex-1 flex max-w-7xl mx-auto w-full p-4 gap-4 overflow-hidden">
          {/* Conversation List */}
          <Card className="w-96 flex-shrink-0 flex flex-col overflow-hidden">
            <div className="p-3 border-b space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="font-semibold">{urgentCount}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span className="font-semibold">{waitingCount}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-blue-500" />
                  <span className="font-semibold">{takenOverCount}</span>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="urgent" className="text-xs">Urgent</TabsTrigger>
                  <TabsTrigger value="waiting" className="text-xs">Waiting</TabsTrigger>
                  <TabsTrigger value="taken_over" className="text-xs">Human</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <ScrollArea className="flex-1">
              <div className="divide-y">
                {sortedConversations.map((conv) => {
                  const viewingUsers = getViewersForConversation(conv.id);
                  
                  return (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv)}
                      className={cn(
                        "w-full p-3 text-left hover:bg-muted/50 transition-colors",
                        selectedConversation?.id === conv.id && "bg-muted"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {(conv.customer_name || conv.phone_number).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm truncate">
                              {conv.customer_name || conv.phone_number}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(conv.last_activity_at), 'HH:mm')}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {conv.last_message_text}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {conv.priority === 'urgent' && (
                              <Badge className="text-[10px] h-4 bg-destructive">{conv.priority}</Badge>
                            )}
                            {conv.is_taken_over && (
                              <Badge variant="outline" className="text-[10px] h-4">Human</Badge>
                            )}
                            {conv.unread_count > 0 && (
                              <Badge variant="destructive" className="text-[10px] h-4 px-1">{conv.unread_count}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>

          {/* Conversation Detail */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            {selectedConversation ? (
              <>
                <div className="p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {(selectedConversation.customer_name || selectedConversation.phone_number).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-semibold">{selectedConversation.customer_name || selectedConversation.phone_number}</h2>
                      <p className="text-sm text-muted-foreground">{selectedConversation.phone_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={`tel:${selectedConversation.phone_number}`}>
                        <Phone className="h-4 w-4 mr-1" />
                        Call
                      </a>
                    </Button>
                    <Button size="sm">
                      <Send className="h-4 w-4 mr-1" />
                      Message
                    </Button>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 divide-x overflow-hidden">
                  <div className="flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>Conversation thread</p>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <div className="p-3 border-b bg-muted/30">
                      <span className="font-medium text-sm">Team Notes</span>
                    </div>
                    <DreTeamChat conversationId={selectedConversation.id} />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Bot className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Select a conversation</p>
                  <p className="text-sm">Choose a thread to view and manage</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // Mobile Layout
  return (
    <div className="h-screen bg-background">
      {selectedConversation ? (
        <ConversationDetailView />
      ) : (
        <ConversationListView />
      )}
    </div>
  );
}
