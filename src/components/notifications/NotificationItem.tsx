import { formatDistanceToNow } from "date-fns";
import { 
  Bell, 
  Package, 
  Truck, 
  AlertTriangle, 
  Info, 
  Settings,
  X,
  Check
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import type { Notification } from "../../hooks/useNotifications";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick?: (notification: Notification) => void;
}

const typeIcons: Record<string, React.ElementType> = {
  order_update: Package,
  delivery_status: Truck,
  alert: AlertTriangle,
  system: Settings,
  info: Info,
  default: Bell,
};

const severityColors: Record<string, string> = {
  info: "text-blue-500 bg-blue-500/10",
  warning: "text-amber-500 bg-amber-500/10",
  critical: "text-red-500 bg-red-500/10",
};

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onClick,
}: NotificationItemProps) {
  const Icon = typeIcons[notification.type] || typeIcons.default;
  const isUnread = !notification.read_at;

  const handleClick = () => {
    if (isUnread) {
      onMarkAsRead(notification.id);
    }
    onClick?.(notification);
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer group",
        isUnread ? "bg-accent/50" : "hover:bg-accent/30"
      )}
      onClick={handleClick}
    >
      <div
        className={cn(
          "flex-shrink-0 p-2 rounded-full",
          severityColors[notification.severity] || severityColors.info
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn("text-sm font-medium truncate", isUnread && "font-semibold")}>
            {notification.title}
          </p>
          {isUnread && (
            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>

      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isUnread && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAsRead(notification.id);
            }}
            title="Mark as read"
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          title="Delete"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
