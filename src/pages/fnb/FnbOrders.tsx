import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, 
  Search, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  Package,
  Store,
  Banknote,
  CreditCard,
  CheckCircle,
  Clock,
  Camera,
  AlertCircle,
  Truck
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FnbOrderDayDialog } from '@/components/fnb/FnbOrderDayDialog';

type CustomerType = 'regular' | 'supermarket' | 'cod' | 'credit';

interface OrderWithDetails {
  id: string;
  order_number: string;
  status: string;
  total_xcg: number | null;
  delivery_date: string | null;
  driver_name: string | null;
  payment_method: string | null;
  receipt_photo_url: string | null;
  receipt_verified_at: string | null;
  quickbooks_invoice_id: string | null;
  fnb_customers: {
    name: string;
    whatsapp_phone?: string;
    delivery_zone: string | null;
    customer_type: CustomerType;
  } | null;
  fnb_order_items?: { id: string }[];
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  picking: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  out_for_delivery: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  delivered: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  cancelled: 'bg-destructive/10 text-destructive',
};

const zoneColors: Record<string, string> = {
  'Willemstad': 'border-l-blue-500',
  'Otrobanda': 'border-l-green-500',
  'Punda': 'border-l-purple-500',
  'Pietermaai': 'border-l-orange-500',
  'Scharloo': 'border-l-pink-500',
  'Salinja': 'border-l-teal-500',
  'default': 'border-l-muted-foreground',
};

const customerTypeIcons: Record<CustomerType, React.ReactNode> = {
  regular: <Package className="h-3 w-3" />,
  supermarket: <Store className="h-3 w-3" />,
  cod: <Banknote className="h-3 w-3" />,
  credit: <CreditCard className="h-3 w-3" />,
};

const customerTypeLabels: Record<CustomerType, string> = {
  regular: 'Regular',
  supermarket: 'Supermarket',
  cod: 'COD',
  credit: 'Credit',
};

export default function FnbOrders() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const weekDays = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)); // Mon-Sat

  // Fetch orders for the week
  const { data: orders, isLoading } = useQuery({
    queryKey: ['fnb-orders-weekly', format(weekStart, 'yyyy-MM-dd'), statusFilter],
    queryFn: async () => {
      const weekEnd = addDays(weekStart, 6);
      let query = supabase
        .from('fnb_orders')
        .select(`
          id,
          order_number,
          status,
          total_xcg,
          delivery_date,
          driver_name,
          payment_method,
          receipt_photo_url,
          receipt_verified_at,
          quickbooks_invoice_id,
          fnb_customers (name, whatsapp_phone, delivery_zone, customer_type),
          fnb_order_items (id)
        `)
        .gte('delivery_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('delivery_date', format(weekEnd, 'yyyy-MM-dd'))
        .order('delivery_date', { ascending: true });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      } else {
        query = query.neq('status', 'cancelled');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as OrderWithDetails[];
    },
  });

  const getOrdersForDay = (day: Date) => {
    let dayOrders = orders?.filter((order) => {
      if (!order.delivery_date) return false;
      return isSameDay(parseISO(order.delivery_date), day);
    }) || [];

    // Apply search filter
    if (searchTerm) {
      dayOrders = dayOrders.filter(
        (o) =>
          o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          o.fnb_customers?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return dayOrders;
  };

  const getZoneColor = (zone: string | null) => {
    return zone ? (zoneColors[zone] || zoneColors.default) : zoneColors.default;
  };

  const getDayStats = (dayOrders: OrderWithDetails[]) => {
    const total = dayOrders.length;
    const delivered = dayOrders.filter((o) => o.status === 'delivered').length;
    const pending = dayOrders.filter((o) => o.status === 'pending').length;
    const pendingReceipts = dayOrders.filter(
      (o) => o.fnb_customers?.customer_type === 'supermarket' && o.status === 'delivered' && !o.receipt_verified_at
    ).length;
    const codTotal = dayOrders
      .filter((o) => o.fnb_customers?.customer_type === 'cod' || o.payment_method === 'cod')
      .reduce((sum, o) => sum + (o.total_xcg || 0), 0);
    const totalXCG = dayOrders.reduce((sum, o) => sum + (o.total_xcg || 0), 0);
    
    return { total, delivered, pending, pendingReceipts, codTotal, totalXCG };
  };

  const previousWeek = () => setWeekStart(addDays(weekStart, -7));
  const nextWeek = () => setWeekStart(addDays(weekStart, 7));
  const goToToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const renderOrderCard = (order: OrderWithDetails) => {
    const customerType = order.fnb_customers?.customer_type || 'regular';
    const isSupermarket = customerType === 'supermarket';
    const needsReceipt = isSupermarket && order.status === 'delivered' && !order.receipt_verified_at;
    const hasReceipt = !!order.receipt_photo_url;
    const isVerified = !!order.receipt_verified_at;

    return (
      <Card
        key={order.id}
        className={cn(
          'mb-2 cursor-pointer hover:shadow-md transition-shadow border-l-4',
          getZoneColor(order.fnb_customers?.delivery_zone || null),
          needsReceipt && 'ring-2 ring-orange-400'
        )}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{order.fnb_customers?.name || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">{order.order_number}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge className={cn('text-xs', statusColors[order.status])}>
                {order.status?.replace('_', ' ')}
              </Badge>
              <div className="flex items-center gap-1">
                {customerTypeIcons[customerType]}
                <span className="text-xs text-muted-foreground">{customerTypeLabels[customerType]}</span>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="font-medium">{order.total_xcg?.toFixed(2)} XCG</span>
            <div className="flex items-center gap-1">
              {order.driver_name && (
                <Badge variant="outline" className="text-xs py-0">
                  <Truck className="h-3 w-3 mr-1" />
                  {order.driver_name.split(' ')[0]}
                </Badge>
              )}
            </div>
          </div>

          {/* Status indicators for supermarket orders */}
          {isSupermarket && order.status === 'delivered' && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              {hasReceipt ? (
                <Badge variant="outline" className="text-green-600 border-green-300">
                  <Camera className="h-3 w-3 mr-1" />
                  Receipt
                </Badge>
              ) : (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  No Receipt
                </Badge>
              )}
              {isVerified ? (
                <Badge variant="outline" className="text-green-600 border-green-300">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const selectedDayOrders = selectedDay ? getOrdersForDay(selectedDay) : [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/fnb">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">F&B Orders</h1>
            <p className="text-muted-foreground">
              View and manage F&B orders by day
            </p>
          </div>
          <Button onClick={() => navigate('/fnb/orders/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </div>

        {/* Week Navigation */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={previousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold">
                    {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 5), 'MMM d, yyyy')}
                  </h2>
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Today
                  </Button>
                </div>
                <Button variant="outline" size="icon" onClick={nextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-48"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="picking">Picking</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            <span>Supermarket (receipt required)</span>
          </div>
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            <span>COD</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span>Credit</span>
          </div>
        </div>

        {/* Calendar Grid */}
        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Loading orders...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {weekDays.map((day) => {
              const dayOrders = getOrdersForDay(day);
              const stats = getDayStats(dayOrders);
              const isToday = isSameDay(day, new Date());

              return (
                <Card
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[400px] cursor-pointer hover:shadow-lg transition-shadow',
                    isToday && 'ring-2 ring-primary'
                  )}
                  onClick={() => setSelectedDay(day)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <div>
                        <span className={cn('font-bold', isToday && 'text-primary')}>
                          {format(day, 'EEE')}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          {format(day, 'MMM d')}
                        </span>
                      </div>
                      <Badge variant={stats.total > 0 ? 'default' : 'secondary'}>
                        {stats.total}
                      </Badge>
                    </CardTitle>
                    {/* Day Stats */}
                    {stats.total > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {stats.delivered > 0 && (
                          <Badge variant="outline" className="text-xs text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {stats.delivered}
                          </Badge>
                        )}
                        {stats.pending > 0 && (
                          <Badge variant="outline" className="text-xs text-yellow-600">
                            <Clock className="h-3 w-3 mr-1" />
                            {stats.pending}
                          </Badge>
                        )}
                        {stats.pendingReceipts > 0 && (
                          <Badge variant="outline" className="text-xs text-orange-600">
                            <Camera className="h-3 w-3 mr-1" />
                            {stats.pendingReceipts}
                          </Badge>
                        )}
                        {stats.codTotal > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <Banknote className="h-3 w-3 mr-1" />
                            {stats.codTotal.toFixed(0)}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 overflow-y-auto max-h-[320px]">
                    {dayOrders.length === 0 ? (
                      <p className="text-center py-4 text-muted-foreground text-sm">
                        No orders
                      </p>
                    ) : (
                      dayOrders.slice(0, 5).map((order) => renderOrderCard(order))
                    )}
                    {dayOrders.length > 5 && (
                      <p className="text-center text-xs text-muted-foreground py-2">
                        +{dayOrders.length - 5} more orders
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Day Drill-Down Dialog */}
        <FnbOrderDayDialog
          day={selectedDay}
          orders={selectedDayOrders}
          open={!!selectedDay}
          onOpenChange={(open) => !open && setSelectedDay(null)}
        />
      </main>
    </div>
  );
}
