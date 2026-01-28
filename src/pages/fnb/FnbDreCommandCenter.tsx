import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ResizablePanelGroup, 
  ResizablePanel, 
  ResizableHandle 
} from '@/components/ui/resizable';
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
  Smartphone,
  Users,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDreConversations, type DreConversation } from '@/hooks/useDreConversations';
import { useDreTeamChat } from '@/hooks/useDreTeamChat';
import { useDreEscalations } from '@/hooks/useDreEscalations';
import { DreConversationList } from '@/components/dre/DreConversationList';
import { DreConversationDetail } from '@/components/dre/DreConversationDetail';
import { DreTeamSidebar } from '@/components/dre/DreTeamSidebar';
import { DreTeamChatPanel } from '@/components/dre/DreTeamChatPanel';
import { DreEscalationQueue } from '@/components/dre/DreEscalationQueue';
import { playOrderNotificationSound } from '@/utils/audioNotification';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';

export default function FnbDreCommandCenter() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { conversations, isLoading } = useDreConversations();
  const {
    channels,
    messages: channelMessages,
    directMessages,
    teamPresence,
    selectedChannelId,
    setSelectedChannelId,
    selectedDmUserId,
    setSelectedDmUserId,
    sendChannelMessage,
    sendDirectMessage,
  } = useDreTeamChat();
  const {
    escalations,
    pendingCount,
    claimEscalation,
    resolveEscalation,
  } = useDreEscalations();
  
  const [selectedConversation, setSelectedConversation] = useState<DreConversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'urgent' | 'waiting' | 'taken_over'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [teamPanelCollapsed, setTeamPanelCollapsed] = useState(false);
  const [showEscalations, setShowEscalations] = useState(false);
  const queryClient = useQueryClient();

  // On mobile, redirect to standalone Dre app
  useEffect(() => {
    if (isMobile) {
      navigate('/dre', { replace: true });
    }
  }, [isMobile, navigate]);

  // Filter conversations
  const filteredConversations = (conversations || []).filter((c) => {
    const query = searchQuery.toLowerCase();
    return c.phone_number.toLowerCase().includes(query) ||
      (c.customer_name?.toLowerCase().includes(query) ?? false) ||
      (c.last_message_text?.toLowerCase().includes(query) ?? false);
  });

  // Count stats
  const urgentCount = filteredConversations.filter(c => c.priority === 'urgent' || c.priority === 'high').length;
  const waitingCount = filteredConversations.filter(c => c.status === 'waiting' || c.status === 'escalated').length;
  const takenOverCount = filteredConversations.filter(c => c.is_taken_over).length;
  const totalUnread = filteredConversations.reduce((sum, c) => sum + c.unread_count, 0);

  // Sound alert for urgent conversations
  useEffect(() => {
    if (soundEnabled && urgentCount > 0) {
      const timer = setTimeout(() => playOrderNotificationSound(), 1000);
      return () => clearTimeout(timer);
    }
  }, [urgentCount, soundEnabled]);

  // Sync conversations from whatsapp_messages
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
          }, { onConflict: 'phone_number' });
      }

      queryClient.invalidateQueries({ queryKey: ['dre-conversations'] });
    };

    syncConversations();

    const channel = supabase
      .channel('whatsapp-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, 
        () => syncConversations())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dre-conversations'] });
    queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
  };

  const handleChannelSelect = (channelId: string) => {
    setSelectedChannelId(channelId);
    setSelectedDmUserId(null);
    setShowEscalations(false);
  };

  const handleDMSelect = (userId: string) => {
    setSelectedDmUserId(userId);
    setSelectedChannelId(null);
    setShowEscalations(false);
  };

  const handleSendMessage = async (text: string) => {
    if (selectedChannelId) {
      return sendChannelMessage(selectedChannelId, text);
    } else if (selectedDmUserId) {
      return sendDirectMessage(selectedDmUserId, text);
    }
    return false;
  };

  // Get current chat mode and data
  const chatMode = selectedChannelId ? 'channel' : 'dm';
  const currentChannel = channels.find(c => c.id === selectedChannelId) || null;
  const currentDmRecipient = teamPresence.find(p => p.user_id === selectedDmUserId) || null;
  const currentMessages = selectedChannelId 
    ? channelMessages 
    : directMessages.filter(dm => 
        dm.sender_id === selectedDmUserId || dm.recipient_id === selectedDmUserId
      );

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-4 pt-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            Dre Command Center
          </h1>
          <p className="text-muted-foreground text-sm">
            Customer conversations & team coordination
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalUnread > 0 && (
            <Badge variant="destructive" className="text-sm">
              {totalUnread} unread
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge variant="outline" className="text-sm border-destructive text-destructive">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {pendingCount} escalations
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute alerts' : 'Enable alerts'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          </Button>
          <Button
            variant={teamPanelCollapsed ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTeamPanelCollapsed(!teamPanelCollapsed)}
          >
            <Users className="h-4 w-4 mr-2" />
            Team
            {teamPanelCollapsed ? <ChevronLeft className="h-4 w-4 ml-1" /> : <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dre">
              <Smartphone className="h-4 w-4 mr-2" />
              App
            </Link>
          </Button>
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
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
          <Clock className="h-4 w-4 text-warning" />
          <span className="font-medium">{waitingCount}</span>
          <span className="text-muted-foreground">Waiting</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <UserCheck className="h-4 w-4 text-primary" />
          <span className="font-medium">{takenOverCount}</span>
          <span className="text-muted-foreground">Human</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="font-medium">{filteredConversations.length}</span>
          <span className="text-muted-foreground">Total</span>
        </div>
      </div>

      {/* Main split-view content */}
      <div className="flex-1 px-4 pb-4 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border">
          {/* Customer Inbox Section */}
          <ResizablePanel defaultSize={teamPanelCollapsed ? 100 : 65} minSize={40}>
            <div className="h-full flex">
              {/* Conversation List */}
              <div className="w-80 border-r flex flex-col bg-muted/30">
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
                      <TabsTrigger value="waiting" className="text-xs">Wait</TabsTrigger>
                      <TabsTrigger value="taken_over" className="text-xs">Human</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="flex-1 overflow-hidden">
                  <DreConversationList
                    conversations={filteredConversations}
                    selectedId={selectedConversation?.id || null}
                    onSelect={setSelectedConversation}
                    isLoading={isLoading}
                    filter={filter}
                  />
                </div>
              </div>

              {/* Conversation Detail */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {selectedConversation ? (
                  <DreConversationDetail conversation={selectedConversation} />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                    <Bot className="h-16 w-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">Select a conversation</p>
                    <p className="text-sm">Choose a thread from the list to view and manage</p>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          {/* Team Chat Section */}
          {!teamPanelCollapsed && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={35} minSize={25}>
                <div className="h-full flex bg-background">
                  {/* Team Sidebar */}
                  <div className="flex flex-col w-64 border-r">
                    <DreTeamSidebar
                      channels={channels}
                      teamPresence={teamPresence}
                      selectedChannelId={selectedChannelId}
                      selectedDmUserId={selectedDmUserId}
                      onSelectChannel={handleChannelSelect}
                      onSelectDm={handleDMSelect}
                      currentUserId={user?.id}
                    />
                    {/* Escalations button */}
                    <div className="p-2 border-t">
                      <Button
                        variant={showEscalations ? 'default' : 'outline'}
                        className="w-full justify-start"
                        onClick={() => setShowEscalations(!showEscalations)}
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Escalations
                        {pendingCount > 0 && (
                          <Badge variant="destructive" className="ml-auto">{pendingCount}</Badge>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Team Chat or Escalations */}
                  <div className="flex-1 overflow-hidden">
                    {showEscalations ? (
                      <DreEscalationQueue
                        escalations={escalations}
                        onClaim={claimEscalation}
                        onResolve={resolveEscalation}
                        onViewConversation={(convId) => {
                          const conv = conversations?.find(c => c.id === convId);
                          if (conv) {
                            setSelectedConversation(conv);
                            setShowEscalations(false);
                          }
                        }}
                      />
                    ) : (
                      <DreTeamChatPanel
                        mode={chatMode}
                        channel={currentChannel}
                        messages={currentMessages}
                        dmRecipient={currentDmRecipient}
                        onSendMessage={handleSendMessage}
                      />
                    )}
                  </div>
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
