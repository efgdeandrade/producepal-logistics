import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, X, ArrowRight, MapPin, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

export interface OrderNotification {
  id: string;
  queueId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  zone?: string;
  isUrgent: boolean;
  createdAt: Date;
}

interface NewOrderToastProps {
  notifications: OrderNotification[];
  isMinimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
  onPickOrder: (notification: OrderNotification) => void;
  onDismiss: (id: string) => void;
}

export function NewOrderToast({
  notifications,
  isMinimized,
  onMinimize,
  onExpand,
  onPickOrder,
  onDismiss,
}: NewOrderToastProps) {
  const [selectedNotification, setSelectedNotification] = useState<OrderNotification | null>(null);

  if (notifications.length === 0) return null;

  // Minimized state - compact flashing bar
  if (isMinimized) {
    return (
      <div 
        className="fixed top-20 right-4 z-50 cursor-pointer"
        onClick={onExpand}
      >
        <Card className="bg-primary text-primary-foreground border-none shadow-xl animate-pulse px-4 py-3">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 animate-bounce" />
            <span className="font-bold">
              {notifications.length} Order{notifications.length > 1 ? 's' : ''} Waiting
            </span>
            <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground">
              Click to view
            </Badge>
          </div>
        </Card>
      </div>
    );
  }

  // Expanded state - full notification cards
  return (
    <>
      <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
        {notifications.map((notification) => (
          <Card
            key={notification.id}
            className={cn(
              "relative overflow-hidden shadow-xl border-none",
              notification.isUrgent 
                ? "bg-destructive text-destructive-foreground" 
                : "bg-primary text-primary-foreground",
            )}
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2 rounded-full animate-pulse",
                    notification.isUrgent 
                      ? "bg-destructive-foreground/20" 
                      : "bg-primary-foreground/20"
                  )}>
                    <Bell className="h-5 w-5" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium opacity-80">NEW ORDER</span>
                      {notification.isUrgent && (
                        <Badge className="bg-white/20 text-white text-xs">
                          URGENT
                        </Badge>
                      )}
                    </div>
                    
                    {/* Customer name is now prominent */}
                    <p className="text-lg font-bold">{notification.customerName}</p>
                    
                    {notification.zone && (
                      <div className="flex items-center gap-1.5 text-sm opacity-80">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{notification.zone}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 hover:bg-white/20 text-inherit"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(notification.id);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 bg-white/20 hover:bg-white/30 text-inherit border-none"
                  onClick={() => setSelectedNotification(notification)}
                >
                  View Details
                </Button>
                <Button
                  size="sm"
                  className={cn(
                    "flex-1",
                    notification.isUrgent
                      ? "bg-white text-destructive hover:bg-white/90"
                      : "bg-white text-primary hover:bg-white/90"
                  )}
                  onClick={() => onPickOrder(notification)}
                >
                  Pick Now
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
        
        {/* Minimize button when multiple notifications */}
        {notifications.length >= 1 && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full bg-muted/90 hover:bg-muted"
            onClick={onMinimize}
          >
            <Minimize2 className="h-4 w-4 mr-2" />
            Minimize Alerts
          </Button>
        )}
      </div>

      {/* Order Details Dialog */}
      <Dialog open={selectedNotification !== null} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              New Order Ready for Picking
            </DialogTitle>
            <DialogDescription>
              Review order details and decide how to proceed
            </DialogDescription>
          </DialogHeader>
          
          {selectedNotification && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Customer</label>
                <p className="text-xl font-bold">{selectedNotification.customerName}</p>
              </div>
              
              {selectedNotification.zone && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Delivery Zone</label>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {selectedNotification.zone}
                  </p>
                </div>
              )}
              
              {selectedNotification.isUrgent && (
                <Badge variant="destructive" className="text-sm">
                  ⚡ Urgent Priority
                </Badge>
              )}
            </div>
          )}
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedNotification(null);
                onMinimize();
              }}
              className="flex-1"
            >
              <Minimize2 className="h-4 w-4 mr-2" />
              Minimize & Keep Alerting
            </Button>
            <Button
              onClick={() => {
                if (selectedNotification) {
                  onPickOrder(selectedNotification);
                  setSelectedNotification(null);
                }
              }}
              className="flex-1"
            >
              Pick Now
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
