import { Badge } from '@/components/ui/badge';
import { Clock, Package, User, MapPin, AlertTriangle, Crown } from 'lucide-react';
import { format, differenceInHours, differenceInMinutes, isPast } from 'date-fns';
import { cn } from '@/lib/utils';

interface PickerOrderCardProps {
  order: {
    id: string;
    status: string;
    priority: number;
    claimed_by: string | null;
    picker_name: string | null;
    fnb_orders: {
      id: string;
      order_number: string;
      total_xcg: number;
      delivery_date: string | null;
      notes: string | null;
      fnb_customers: {
        name: string;
        whatsapp_phone: string;
        address: string | null;
        customer_type: string;
        delivery_zone: string | null;
      } | null;
    } | null;
  };
  itemCount: number;
  isSelected: boolean;
  onClick: () => void;
  currentPickerName?: string;
}

export function PickerOrderCard({
  order,
  itemCount,
  isSelected,
  onClick,
  currentPickerName,
}: PickerOrderCardProps) {
  const deliveryDate = order.fnb_orders?.delivery_date
    ? new Date(order.fnb_orders.delivery_date)
    : null;
  
  const isUrgent = deliveryDate && (isPast(deliveryDate) || differenceInHours(deliveryDate, new Date()) < 2);
  const isWarning = deliveryDate && !isUrgent && differenceInHours(deliveryDate, new Date()) < 4;
  
  const customerType = order.fnb_orders?.fnb_customers?.customer_type || 'regular';
  const isVIP = customerType === 'supermarket' || customerType === 'premium';
  const isClaimedByOther = order.claimed_by && order.picker_name !== currentPickerName;

  const getTimeDisplay = () => {
    if (!deliveryDate) return null;
    
    if (isPast(deliveryDate)) {
      return { text: 'OVERDUE', className: 'text-destructive font-bold animate-pulse' };
    }
    
    const hours = differenceInHours(deliveryDate, new Date());
    const mins = differenceInMinutes(deliveryDate, new Date()) % 60;
    
    if (hours < 1) {
      return { text: `${mins}m`, className: 'text-destructive font-bold' };
    }
    if (hours < 4) {
      return { text: `${hours}h ${mins}m`, className: 'text-orange-600 dark:text-orange-400 font-semibold' };
    }
    
    return { text: format(deliveryDate, 'h:mm a'), className: 'text-muted-foreground' };
  };

  const timeDisplay = getTimeDisplay();

  // Estimate pick time based on item count (1 min per item on average)
  const estimatedMinutes = Math.max(3, itemCount * 1);

  return (
    <div
      className={cn(
        'p-4 rounded-xl border-2 cursor-pointer transition-all relative overflow-hidden',
        isSelected
          ? 'border-primary bg-primary/5 shadow-md'
          : 'border-border hover:border-primary/50 hover:shadow-sm',
        isUrgent && !isSelected && 'border-destructive/50 bg-destructive/5',
        isWarning && !isSelected && 'border-orange-400/50 bg-orange-50 dark:bg-orange-950/20',
        isClaimedByOther && 'opacity-60'
      )}
      onClick={onClick}
    >
      {/* Priority/VIP indicators */}
      <div className="absolute top-0 right-0 flex gap-1">
        {order.priority > 0 && (
          <div className="bg-destructive text-destructive-foreground px-2 py-0.5 text-xs font-bold rounded-bl">
            PRIORITY
          </div>
        )}
        {isVIP && (
          <div className="bg-amber-500 text-white px-2 py-0.5 text-xs font-bold rounded-bl flex items-center gap-1">
            <Crown className="h-3 w-3" />
            VIP
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Order number */}
          <p className="font-bold text-lg truncate">
            {order.fnb_orders?.order_number}
          </p>
          
          {/* Customer name */}
          <p className="text-sm font-medium truncate">
            {order.fnb_orders?.fnb_customers?.name}
          </p>
          
          {/* Delivery zone */}
          {order.fnb_orders?.fnb_customers?.delivery_zone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {order.fnb_orders.fnb_customers.delivery_zone}
            </p>
          )}
        </div>

        {/* Right side info */}
        <div className="text-right shrink-0 space-y-1">
          {/* Time countdown */}
          {timeDisplay && (
            <div className={cn('flex items-center justify-end gap-1 text-sm', timeDisplay.className)}>
              <Clock className="h-3.5 w-3.5" />
              {timeDisplay.text}
            </div>
          )}
          
          {/* Item count & estimate */}
          <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
            <Package className="h-3 w-3" />
            {itemCount} items • ~{estimatedMinutes} min
          </div>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-2 mt-3">
        {order.status === 'in_progress' ? (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
            <User className="h-3 w-3 mr-1" />
            {order.picker_name || 'Picking...'}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            Ready to Claim
          </Badge>
        )}

        {order.fnb_orders?.notes && (
          <Badge variant="secondary" className="text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Has notes
          </Badge>
        )}
      </div>
    </div>
  );
}
