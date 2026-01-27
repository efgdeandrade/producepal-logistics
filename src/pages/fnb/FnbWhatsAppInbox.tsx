import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MessageSquare, ArrowLeft, RefreshCw } from 'lucide-react';
import { useWhatsAppMessages, type ConversationThread } from '@/hooks/useWhatsAppMessages';
import { WhatsAppConversationThread, ConversationListItem } from '@/components/fnb/WhatsAppConversationThread';
import { useQueryClient } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/use-mobile';

export default function FnbWhatsAppInbox() {
  const { threads, isLoading, totalUnread } = useWhatsAppMessages(500);
  const [selectedThread, setSelectedThread] = useState<ConversationThread | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const filteredThreads = threads.filter((thread) => {
    const query = searchQuery.toLowerCase();
    return (
      thread.phone_number.toLowerCase().includes(query) ||
      (thread.customer_name?.toLowerCase().includes(query) ?? false) ||
      thread.last_message.toLowerCase().includes(query)
    );
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
  };

  // Mobile: show either list or conversation
  if (isMobile) {
    if (selectedThread) {
      return (
        <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background flex flex-col">
          <Header />
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2 p-4 border-b">
              <Button variant="ghost" size="icon" onClick={() => setSelectedThread(null)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <span className="font-medium">
                {selectedThread.customer_name || selectedThread.phone_number}
              </span>
            </div>
            <div className="flex-1">
              <WhatsAppConversationThread thread={selectedThread} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background pb-20">
        <Header />
        <main className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <MessageSquare className="h-6 w-6 text-green-500" />
                Dre Inbox
              </h1>
              {totalUnread > 0 && (
                <Badge variant="destructive" className="mt-1">
                  {totalUnread} unread
                </Badge>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-3 p-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredThreads.length > 0 ? (
            <div className="space-y-1">
              {filteredThreads.map((thread) => (
                <ConversationListItem
                  key={thread.phone_number}
                  thread={thread}
                  isSelected={false}
                  onClick={() => setSelectedThread(thread)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">No conversations</p>
              <p className="text-sm">WhatsApp messages will appear here</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Desktop: split view
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      <Header />
      <main className="px-4 md:container py-6 w-full max-w-full overflow-x-hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <MessageSquare className="h-7 w-7 text-green-500" />
              Dre WhatsApp Inbox
            </h1>
            <p className="text-muted-foreground">
              View all conversations between Dre and customers
            </p>
          </div>
          <div className="flex items-center gap-2">
            {totalUnread > 0 && (
              <Badge variant="destructive" className="text-sm">
                {totalUnread} unread in last hour
              </Badge>
            )}
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          {/* Conversation List */}
          <Card className="lg:col-span-1 flex flex-col">
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                {isLoading ? (
                  <div className="space-y-3 p-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-start gap-3">
                        <Skeleton className="w-12 h-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredThreads.length > 0 ? (
                  <div className="p-2 space-y-1">
                    {filteredThreads.map((thread) => (
                      <ConversationListItem
                        key={thread.phone_number}
                        thread={thread}
                        isSelected={selectedThread?.phone_number === thread.phone_number}
                        onClick={() => setSelectedThread(thread)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mb-2 opacity-50" />
                    <p className="text-sm">No conversations found</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Conversation Detail */}
          <Card className="lg:col-span-2 flex flex-col overflow-hidden">
            {selectedThread ? (
              <WhatsAppConversationThread thread={selectedThread} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
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
