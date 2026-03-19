import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { Clock, User, Package, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Order {
  id: string;
  order_number: string;
  status: string;
  delivery_date: string | null;
  delivery_type: string | null;
  total_xcg: number | null;
  created_at: string;
  distribution_customers: {
    name: string;
    whatsapp_phone: string;
    delivery_zone: string | null;
  } | null;
  _count?: { items: number };
}

interface DashboardKanbanColumnProps {
  title: string;
  icon: React.ReactNode;
  orders: Order[];
  color: string;
  emptyMessage?: string;
}

export function DashboardKanbanColumn({
  title,
  icon,
  orders,
  color,
  emptyMessage = "No orders"
}: DashboardKanbanColumnProps) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className={cn("py-3 px-4 border-b", color)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {orders.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-[calc(100%-1px)]">
          <div className="p-2 space-y-2">
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {emptyMessage}
              </div>
            ) : (
              orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function OrderCard({ order }: { order: Order }) {
  const isUrgent = order.delivery_type === 'same_day';

  return (
    <div className={cn(
      "p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow cursor-pointer",
      isUrgent && "border-l-4 border-l-orange-500"
    )}>
      <div className="flex items-start justify-between mb-2">
        <span className="font-mono text-xs font-medium">{order.order_number}</span>
        {isUrgent && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 bg-orange-500/10 text-orange-600 border-orange-500/30">
            Same Day
          </Badge>
        )}
      </div>
      
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-sm">
          <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="truncate">{order.distribution_customers?.name || 'Unknown'}</span>
        </div>
        
        {order.distribution_customers?.delivery_zone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{order.distribution_customers.delivery_zone}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{format(new Date(order.created_at), 'HH:mm')}</span>
          </div>
          {order.total_xcg && (
            <span className="text-xs font-medium text-green-600">
              {order.total_xcg.toFixed(0)} XCG
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
