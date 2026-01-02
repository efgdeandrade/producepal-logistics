import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, X, ArrowRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewOrderToastProps {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  zone?: string;
  isUrgent?: boolean;
  onView: () => void;
  onDismiss: () => void;
}

export function NewOrderToast({
  orderNumber,
  customerName,
  zone,
  isUrgent,
  onView,
  onDismiss,
}: NewOrderToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const AUTO_DISMISS_MS = 15000;

  useEffect(() => {
    const startTime = Date.now();
    
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
      setProgress(remaining);
      
      if (remaining <= 0) {
        clearInterval(progressInterval);
        handleDismiss();
      }
    }, 100);

    return () => clearInterval(progressInterval);
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 200);
  };

  const handleView = () => {
    setIsExiting(true);
    setTimeout(onView, 200);
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200 shadow-lg border-l-4",
        isUrgent 
          ? "border-l-destructive bg-destructive/5" 
          : "border-l-primary bg-primary/5",
        isExiting ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0"
      )}
    >
      {/* Progress bar */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 h-1 transition-all",
          isUrgent ? "bg-destructive/30" : "bg-primary/30"
        )}
        style={{ width: `${progress}%` }}
      />
      
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              "p-2 rounded-full animate-pulse",
              isUrgent ? "bg-destructive/20" : "bg-primary/20"
            )}>
              <Bell className={cn(
                "h-4 w-4",
                isUrgent ? "text-destructive" : "text-primary"
              )} />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">New Order</span>
                <Badge variant="outline" className="text-xs font-mono">
                  {orderNumber}
                </Badge>
                {isUrgent && (
                  <Badge variant="destructive" className="text-xs">
                    URGENT
                  </Badge>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground">{customerName}</p>
              
              {zone && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Zone: {zone}</span>
                </div>
              )}
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            className="flex-1"
            onClick={handleView}
          >
            View Order
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
