import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MessageSquare, ArrowLeft, RefreshCw, Bot, Settings2 } from 'lucide-react';
import { useDreInbox, type DreConversation, type FilterType } from '@/hooks/useDreInbox';
import { DreInboxList } from '@/components/dre/DreInboxList';
import { DreConversationPanel } from '@/components/dre/DreConversationPanel';
import { DreFilterChips } from '@/components/dre/DreFilterChips';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from 'react-router-dom';

export default function FnbWhatsAppInbox() {
  const { 
    conversations, 
    groupConversations, 
    filterConversations,
    isLoading, 
    totalUnread,
    refetch,
    markAsRead
  } = useDreInbox(500);
  
  const [selectedConversation, setSelectedConversation] = useState<DreConversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const isMobile = useIsMobile();

  // Apply filters and search
  const filteredConversations = filterConversations(conversations, activeFilter, searchQuery);
  const groupedConversations = groupConversations(filteredConversations);

  // Calculate counts for filter chips
  const pendingOrderCount = conversations.filter(c => c.has_pending_order).length;
  const escalatedCount = conversations.filter(c => c.is_escalated).length;

  // Mark as read when selecting conversation
  const handleSelectConversation = (conv: DreConversation) => {
    setSelectedConversation(conv);
    if (conv.unread_count > 0) {
      markAsRead(conv.phone_number);
    }
  };

  // Sync selected conversation with latest data
  useEffect(() => {
    if (selectedConversation) {
      const updated = conversations.find(c => c.phone_number === selectedConversation.phone_number);
      if (updated) {
        setSelectedConversation(updated);
      }
    }
  }, [conversations, selectedConversation?.phone_number]);

  // Mobile: show either list or conversation
  if (isMobile) {
    if (selectedConversation) {
      return (
        <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background flex flex-col">
          <Header />
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2 p-3 border-b bg-card">
              <Button variant="ghost" size="icon" onClick={() => setSelectedConversation(null)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <span className="font-medium truncate block">
                  {selectedConversation.customer_name || selectedConversation.phone_number}
                </span>
                <span className="text-xs text-muted-foreground">
                  {selectedConversation.messages.length} messages
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <DreConversationPanel conversation={selectedConversation} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background pb-20">
        <Header />
        <main className="px-4 py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Bot className="h-6 w-6 text-primary" />
                Dre Inbox
              </h1>
              {totalUnread > 0 && (
                <Badge variant="destructive" className="mt-1">
                  {totalUnread} unread
                </Badge>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="mb-4 overflow-x-auto pb-2 -mx-4 px-4">
            <DreFilterChips
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              unreadCount={totalUnread}
              pendingOrderCount={pendingOrderCount}
              escalatedCount={escalatedCount}
            />
          </div>

          {/* Conversations */}
          <DreInboxList
            groups={groupedConversations}
            selectedPhone={null}
            onSelectConversation={handleSelectConversation}
            isLoading={isLoading}
          />
        </main>
      </div>
    );
  }

  // Desktop: split view
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      <Header />
      <main className="px-4 md:container py-6 w-full max-w-full overflow-x-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              Dre Inbox
            </h1>
            <p className="text-muted-foreground mt-1">
              View and manage all WhatsApp conversations with customers
            </p>
          </div>
          <div className="flex items-center gap-2">
            {totalUnread > 0 && (
              <Badge variant="destructive" className="text-sm px-3 py-1">
                {totalUnread} unread
              </Badge>
            )}
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" asChild>
              <Link to="/distribution/settings">
                <Settings2 className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4">
          <DreFilterChips
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            unreadCount={totalUnread}
            pendingOrderCount={pendingOrderCount}
            escalatedCount={escalatedCount}
          />
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-280px)]">
          {/* Conversation List */}
          <Card className="lg:col-span-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, or message..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <DreInboxList
                groups={groupedConversations}
                selectedPhone={selectedConversation?.phone_number || null}
                onSelectConversation={handleSelectConversation}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>

          {/* Conversation Detail */}
          <Card className="lg:col-span-2 flex flex-col overflow-hidden">
            {selectedConversation ? (
              <DreConversationPanel conversation={selectedConversation} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <MessageSquare className="h-10 w-10 opacity-50" />
                </div>
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Choose a thread from the list to view messages</p>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
