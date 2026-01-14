import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { useState } from 'react';
import { PickerOrderCard } from './PickerOrderCard';
import { cn } from '@/lib/utils';

interface OrderWithItems {
  id: string;
  status: string;
  priority: number;
  claimed_by: string | null;
  picker_name: string | null;
  order_id: string;
  distribution_orders: {
    id: string;
    order_number: string;
    total_xcg: number;
    delivery_date: string | null;
    delivery_station: string | null;
    notes: string | null;
    distribution_customers: {
      name: string;
      whatsapp_phone: string;
      address: string | null;
      customer_type: string;
      delivery_zone: string | null;
    } | null;
  } | null;
  itemCount: number;
}

interface PickerQueueZoneProps {
  zoneName: string;
  orders: OrderWithItems[];
  selectedOrderId: string | null;
  onOrderSelect: (orderId: string) => void;
  currentPickerName?: string;
  zoneColor?: string;
  orderProgressMap?: Record<string, number>;
}

const ZONE_COLORS: Record<string, string> = {
  'Willemstad': 'bg-blue-500',
  'Otrobanda': 'bg-green-500',
  'Punda': 'bg-purple-500',
  'Pietermaai': 'bg-amber-500',
  'Scharloo': 'bg-pink-500',
  'Unknown': 'bg-gray-500',
};

export function PickerQueueZone({
  zoneName,
  orders,
  selectedOrderId,
  onOrderSelect,
  currentPickerName,
  zoneColor,
  orderProgressMap,
}: PickerQueueZoneProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const color = zoneColor || ZONE_COLORS[zoneName] || ZONE_COLORS['Unknown'];
  const urgentCount = orders.filter(o => {
    if (!o.distribution_orders?.delivery_date) return false;
    const hours = (new Date(o.distribution_orders.delivery_date).getTime() - Date.now()) / (1000 * 60 * 60);
    return hours < 2;
  }).length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Zone Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between p-3 text-left',
          'hover:bg-muted/50 transition-colors'
        )}
      >
        <div className="flex items-center gap-2">
          <div className={cn('w-3 h-3 rounded-full', color)} />
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{zoneName}</span>
          <span className="text-sm text-muted-foreground">
            ({orders.length} {orders.length === 1 ? 'order' : 'orders'})
          </span>
          {urgentCount > 0 && (
            <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full font-medium animate-pulse">
              {urgentCount} urgent
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {/* Orders List */}
      {isExpanded && (
        <div className="p-3 pt-0 space-y-3">
          {orders.map((order) => (
            <PickerOrderCard
              key={order.id}
              order={order}
              itemCount={order.itemCount}
              isSelected={selectedOrderId === order.id}
              onClick={() => onOrderSelect(order.id)}
              currentPickerName={currentPickerName}
              pickProgress={orderProgressMap?.[order.order_id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
