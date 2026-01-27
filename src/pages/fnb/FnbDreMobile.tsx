import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDreConversations, useConversationActions, type DreConversation } from '@/hooks/useDreConversations';
import { useTeamPresence } from '@/hooks/useTeamPresence';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { MobilePageWrapper } from '@/components/mobile/MobilePageWrapper';
import { DreTeamChat } from '@/components/dre/DreTeamChat';
import { DreMobileConversationCard } from '@/components/dre/DreMobileConversationCard';
import { DreConversationDetail } from '@/components/dre/DreConversationDetail';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Bot, 
  Search, 
  Bell, 
  BellOff, 
  Users, 
  MessageSquare,
  AlertCircle,
  Clock,
  UserCheck,
  RefreshCw,
  Settings,
  ArrowLeft,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import { playOrderNotificationSound } from '@/utils/audioNotification';
import { cn } from '@/lib/utils';

export default function FnbDreMobile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { conversations, isLoading } = useDreConversations();
  const { teamMembers, isConnected, updatePresence, getViewersForConversation, onlineCount } = useTeamPresence();
  const { permission, isSupported, requestPermission, settings, updateSettings, showLocalNotification } = usePushNotifications();
  
  const [selectedConversation, setSelectedConversation] = useState<DreConversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'urgent' | 'waiting' | 'human'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSettings, setShowSettings] = useState(false);
  const [showTeamChat, setShowTeamChat] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [prevUrgentCount, setPrevUrgentCount] = useState(0);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Filter conversations
  const filteredConversations = (conversations || []).filter((c) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      c.phone_number.toLowerCase().includes(query) ||
      (c.customer_name?.toLowerCase().includes(query) ?? false) ||
      (c.last_message_text?.toLowerCase().includes(query) ?? false);
    
    if (!matchesSearch) return false;
    
    switch (filter) {
      case 'urgent': return c.priority === 'urgent' || c.priority === 'high';
      case 'waiting': return c.status === 'waiting' || c.status === 'escalated';
      case 'human': return c.is_taken_over;
      default: return true;
    }
  });

  // Sort by priority and recency
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    // Urgent first
    const priorityOrder = { urgent: 0, high: 1, normal: 2 };
    const aPriority = priorityOrder[a.priority] ?? 2;
    const bPriority = priorityOrder[b.priority] ?? 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // Then by last activity
    return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
  });

  // Count stats
  const urgentCount = (conversations || []).filter(c => c.priority === 'urgent' || c.priority === 'high').length;
  const waitingCount = (conversations || []).filter(c => c.status === 'waiting' || c.status === 'escalated').length;
  const takenOverCount = (conversations || []).filter(c => c.is_taken_over).length;
  const totalUnread = (conversations || []).reduce((sum, c) => sum + c.unread_count, 0);

  // Notify on new urgent conversations
  useEffect(() => {
    if (urgentCount > prevUrgentCount && prevUrgentCount > 0) {
      // New urgent conversation
      if (soundEnabled) {
        playOrderNotificationSound();
      }
      if (permission === 'granted') {
        showLocalNotification('🚨 Urgent Conversation', {
          body: 'A new urgent conversation needs attention',
          tag: 'dre-urgent',
        });
      }
      // Vibrate
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    }
    setPrevUrgentCount(urgentCount);
  }, [urgentCount, prevUrgentCount, soundEnabled, permission, showLocalNotification]);

  // Update presence when viewing a conversation
  useEffect(() => {
    if (selectedConversation) {
      updatePresence(selectedConversation.id, 'busy');
    } else {
      updatePresence(null, 'online');
    }
  }, [selectedConversation, updatePresence]);

  // Subscribe to realtime updates
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
      .channel('whatsapp-sync-mobile')
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['dre-conversations'] });
    await queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
    setIsRefreshing(false);
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  const handleSelectConversation = (conv: DreConversation) => {
    setSelectedConversation(conv);
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  };

  const handleBack = () => {
    setSelectedConversation(null);
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Conversation Detail View (full screen on mobile)
  if (selectedConversation) {
    return (
      <MobilePageWrapper fixedHeight className="safe-area-inset">
        {/* Mobile header */}
        <header className="flex-shrink-0 border-b bg-card px-4 py-3 safe-area-top">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(selectedConversation.customer_name || 'U')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">
                {selectedConversation.customer_name || selectedConversation.phone_number}
              </p>
              <div className="flex items-center gap-2">
                {selectedConversation.is_taken_over ? (
                  <Badge variant="secondary" className="text-xs">Human Mode</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-primary border-primary/30">
                    <Bot className="h-3 w-3 mr-1" />
                    Dre Active
                  </Badge>
                )}
                {getViewersForConversation(selectedConversation.id).length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    +{getViewersForConversation(selectedConversation.id).length} viewing
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Conversation content */}
        <div className="flex-1 overflow-hidden">
          <DreConversationDetail conversation={selectedConversation} />
        </div>
      </MobilePageWrapper>
    );
  }

  // Main List View
  return (
    <MobilePageWrapper fixedHeight className="safe-area-inset">
      {/* Header */}
      <header className="flex-shrink-0 border-b bg-card px-4 py-3 safe-area-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Dre Command</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isOnline ? (
                  <Wifi className="h-3 w-3 text-primary" />
                ) : (
                  <WifiOff className="h-3 w-3 text-destructive" />
                )}
                <span>{onlineCount} online</span>
                {totalUnread > 0 && (
                  <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                    {totalUnread}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              {soundEnabled ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <VolumeX className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-5 w-5', isRefreshing && 'animate-spin')} />
            </Button>
            
            {/* Team chat drawer */}
            <Sheet open={showTeamChat} onOpenChange={setShowTeamChat}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Users className="h-5 w-5" />
                  {onlineCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-[10px] font-bold text-primary-foreground rounded-full flex items-center justify-center">
                      {onlineCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md p-0">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Team Chat
                  </SheetTitle>
                </SheetHeader>
                
                {/* Online team members */}
                <div className="p-3 border-b bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Online Now</p>
                  <div className="flex flex-wrap gap-2">
                    {teamMembers.map((member) => (
                      <div 
                        key={member.userId}
                        className="flex items-center gap-1.5 px-2 py-1 bg-background rounded-full text-xs"
                      >
                        <div className={cn(
                          'w-2 h-2 rounded-full',
                          member.status === 'online' && 'bg-primary',
                          member.status === 'busy' && 'bg-amber-500',
                          member.status === 'away' && 'bg-muted-foreground'
                        )} />
                        <span>{member.fullName.split(' ')[0]}</span>
                        {member.currentConversationId && (
                          <MessageSquare className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                    {teamMembers.length === 0 && (
                      <p className="text-xs text-muted-foreground">No team members online</p>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 h-[calc(100vh-180px)]">
                  <DreTeamChat minimal />
                </div>
              </SheetContent>
            </Sheet>
            
            {/* Settings */}
            <Sheet open={showSettings} onOpenChange={setShowSettings}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Settings</SheetTitle>
                </SheetHeader>
                <div className="py-4 space-y-6">
                  {/* Notifications */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Notifications</h4>
                    
                    {isSupported ? (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Push Notifications</p>
                            <p className="text-xs text-muted-foreground">
                              {permission === 'granted' ? 'Enabled' : 'Disabled'}
                            </p>
                          </div>
                          {permission !== 'granted' ? (
                            <Button size="sm" onClick={requestPermission}>
                              <Bell className="h-4 w-4 mr-1" />
                              Enable
                            </Button>
                          ) : (
                            <Badge variant="secondary">
                              <Bell className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Sound Alerts</p>
                            <p className="text-xs text-muted-foreground">Play sounds for new messages</p>
                          </div>
                          <Switch
                            checked={soundEnabled}
                            onCheckedChange={setSoundEnabled}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Urgent Only</p>
                            <p className="text-xs text-muted-foreground">Only alert for urgent conversations</p>
                          </div>
                          <Switch
                            checked={settings.urgentOnly}
                            onCheckedChange={(v) => updateSettings({ urgentOnly: v })}
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Push notifications are not supported on this device.
                      </p>
                    )}
                  </div>
                  
                  {/* Connection status */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Connection</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Real-time Sync</p>
                        <p className="text-xs text-muted-foreground">
                          {isConnected ? 'Connected' : 'Disconnected'}
                        </p>
                      </div>
                      <Badge variant={isConnected ? 'default' : 'destructive'}>
                        {isConnected ? 'Live' : 'Offline'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-3 mt-3 overflow-x-auto pb-1">
          <Badge 
            variant={filter === 'urgent' ? 'default' : 'outline'} 
            className="cursor-pointer flex-shrink-0"
            onClick={() => setFilter(filter === 'urgent' ? 'all' : 'urgent')}
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            {urgentCount} Urgent
          </Badge>
          <Badge 
            variant={filter === 'waiting' ? 'default' : 'outline'} 
            className="cursor-pointer flex-shrink-0"
            onClick={() => setFilter(filter === 'waiting' ? 'all' : 'waiting')}
          >
            <Clock className="h-3 w-3 mr-1" />
            {waitingCount} Waiting
          </Badge>
          <Badge 
            variant={filter === 'human' ? 'default' : 'outline'} 
            className="cursor-pointer flex-shrink-0"
            onClick={() => setFilter(filter === 'human' ? 'all' : 'human')}
          >
            <UserCheck className="h-3 w-3 mr-1" />
            {takenOverCount} Human
          </Badge>
        </div>
      </header>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : sortedConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <Bot className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="font-medium text-lg">No conversations</p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery || filter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Waiting for new WhatsApp messages'}
            </p>
          </div>
        ) : (
          <div className="pb-safe">
            {sortedConversations.map((conv) => (
              <DreMobileConversationCard
                key={conv.id}
                conversation={conv}
                isSelected={selectedConversation?.id === conv.id}
                onSelect={() => handleSelectConversation(conv)}
                viewers={getViewersForConversation(conv.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </MobilePageWrapper>
  );
}
