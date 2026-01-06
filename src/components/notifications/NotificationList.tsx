import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationItem } from "./NotificationItem";
import type { Notification } from "@/hooks/useNotifications";

interface NotificationListProps {
  notifications: Notification[];
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNotificationClick?: (notification: Notification) => void;
}

export function NotificationList({
  notifications,
  isLoading,
  onMarkAsRead,
  onDelete,
  onNotificationClick,
}: NotificationListProps) {
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read_at;
    return true;
  });

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = new Date(notification.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(notification);
    return groups;
  }, {} as Record<string, Notification[]>);

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  const formatGroupDate = (dateString: string) => {
    if (dateString === today) return "Today";
    if (dateString === yesterday) return "Yesterday";
    return new Date(dateString).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")}>
      <TabsList className="w-full grid grid-cols-2 mb-2">
        <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
        <TabsTrigger value="unread" className="text-xs">
          Unread ({notifications.filter((n) => !n.read_at).length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value={filter} className="mt-0">
        <ScrollArea className="h-[400px]">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              {filter === "unread" ? (
                <>
                  <BellOff className="h-10 w-10 mb-2 opacity-50" />
                  <p className="text-sm">No unread notifications</p>
                </>
              ) : (
                <>
                  <Bell className="h-10 w-10 mb-2 opacity-50" />
                  <p className="text-sm">No notifications yet</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedNotifications).map(([date, items]) => (
                <div key={date}>
                  <p className="text-xs font-medium text-muted-foreground px-3 py-1 sticky top-0 bg-popover">
                    {formatGroupDate(date)}
                  </p>
                  <div className="space-y-1">
                    {items.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkAsRead={onMarkAsRead}
                        onDelete={onDelete}
                        onClick={onNotificationClick}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
