import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Smartphone
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDreConversations, type DreConversation } from '@/hooks/useDreConversations';
import { DreConversationList } from '@/components/dre/DreConversationList';
import { DreConversationDetail } from '@/components/dre/DreConversationDetail';
import { playOrderNotificationSound } from '@/utils/audioNotification';
import { supabase } from '@/integrations/supabase/client';

export default function FnbDreCommandCenter() {
  const { conversations, isLoading } = useDreConversations();
  const [selectedConversation, setSelectedConversation] = useState<DreConversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'urgent' | 'waiting' | 'taken_over'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const queryClient = useQueryClient();

  // Filter conversations
  const filteredConversations = (conversations || []).filter((c) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      c.phone_number.toLowerCase().includes(query) ||
      (c.customer_name?.toLowerCase().includes(query) ?? false) ||
      (c.last_message_text?.toLowerCase().includes(query) ?? false);
    
    return matchesSearch;
  });

  // Count stats
  const urgentCount = filteredConversations.filter(c => c.priority === 'urgent' || c.priority === 'high').length;
  const waitingCount = filteredConversations.filter(c => c.status === 'waiting' || c.status === 'escalated').length;
  const takenOverCount = filteredConversations.filter(c => c.is_taken_over).length;
  const totalUnread = filteredConversations.reduce((sum, c) => sum + c.unread_count, 0);

  // Sound alert for urgent conversations
  useEffect(() => {
    if (soundEnabled && urgentCount > 0) {
      // Only play if there's a new urgent conversation
      const timer = setTimeout(() => {
        playOrderNotificationSound();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [urgentCount, soundEnabled]);

  // Subscribe to realtime updates and sync conversations
  useEffect(() => {
    // Sync conversations from whatsapp_messages
    const syncConversations = async () => {
      const { data: messages } = await supabase
        .from('whatsapp_messages')
        .select('phone_number, customer_id, message_text, direction, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (!messages) return;

      // Group by phone number to upsert conversations
      const phoneMap = new Map<string, typeof messages[0]>();
      for (const msg of messages) {
        if (!phoneMap.has(msg.phone_number)) {
          phoneMap.set(msg.phone_number, msg);
        }
      }

      // Upsert each conversation
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
      .channel('whatsapp-sync')
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

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-4 pt-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-green-500" />
            Dre Command Center
          </h1>
          <p className="text-muted-foreground text-sm">
            Monitor and manage all Dre conversations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalUnread > 0 && (
            <Badge variant="destructive" className="text-sm">
              {totalUnread} unread
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute alerts' : 'Enable alerts'}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/distribution/dre-mobile">
              <Smartphone className="h-4 w-4 mr-2" />
              Mobile App
            </Link>
          </Button>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="font-medium">{urgentCount}</span>
          <span className="text-muted-foreground">Urgent</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-amber-500" />
          <span className="font-medium">{waitingCount}</span>
          <span className="text-muted-foreground">Waiting</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <UserCheck className="h-4 w-4 text-blue-500" />
          <span className="font-medium">{takenOverCount}</span>
          <span className="text-muted-foreground">Human Mode</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4 text-green-500" />
          <span className="font-medium">{filteredConversations.length}</span>
          <span className="text-muted-foreground">Total</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 px-4 pb-4 overflow-hidden">
        {/* Conversation List */}
        <Card className="lg:col-span-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="urgent" className="text-xs">
                  Urgent
                  {urgentCount > 0 && (
                    <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">{urgentCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="waiting" className="text-xs">Waiting</TabsTrigger>
                <TabsTrigger value="taken_over" className="text-xs">Human</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <DreConversationList
              conversations={filteredConversations}
              selectedId={selectedConversation?.id || null}
              onSelect={setSelectedConversation}
              isLoading={isLoading}
              filter={filter}
            />
          </CardContent>
        </Card>

        {/* Conversation Detail */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          {selectedConversation ? (
            <DreConversationDetail conversation={selectedConversation} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Bot className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose a thread from the list to view and manage</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
