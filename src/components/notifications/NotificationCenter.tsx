import { useNavigate } from "react-router-dom";
import { Bell, Volume2, VolumeX, CheckCheck } from "lucide-react";
import { Button } from "../ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { useNotifications } from "../../hooks/useNotifications";
import { NotificationList } from "./NotificationList";
import type { Notification } from "../../hooks/useNotifications";

export function NotificationCenter() {
  const navigate = useNavigate();
  const {
    notifications,
    isLoading,
    unreadCount,
    soundEnabled,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    toggleSound,
  } = useNotifications();

  const handleNotificationClick = (notification: Notification) => {
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={toggleSound}
              title={soundEnabled ? "Mute sounds" : "Enable sounds"}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={markAllAsRead}
                title="Mark all as read"
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <NotificationList
          notifications={notifications}
          isLoading={isLoading}
          onMarkAsRead={markAsRead}
          onDelete={deleteNotification}
          onNotificationClick={handleNotificationClick}
        />

        <Separator />
        <div className="p-2">
          <Button
            variant="ghost"
            className="w-full text-xs text-muted-foreground"
            onClick={() => navigate("/settings")}
          >
            Notification Settings
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
