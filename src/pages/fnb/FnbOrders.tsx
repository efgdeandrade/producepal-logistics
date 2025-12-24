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
  ChevronDown,
  ChevronUp,
  Package,
  Store,
  Banknote,
  CreditCard,
  CheckCircle,
  Clock,
  Camera,
  AlertCircle,
  Truck,
  Target,
  Edit,
  X,
  PlusCircle,
  ClipboardList
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link, useNavigate } from 'react-router-dom';
import { format, addDays, startOfWeek, isSameDay, parseISO, getISOWeek } from 'date-fns';
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
import { QuickAddItemDialog } from '@/components/fnb/QuickAddItemDialog';

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
  is_pickup: boolean | null;
  fnb_customers: {
    name: string;
    whatsapp_phone?: string;
    delivery_zone: string | null;
    customer_type: CustomerType;
  } | null;
  fnb_order_items?: { 
    id: string;
    quantity: number;
    picked_quantity: number | null;
    short_quantity: number | null;
    unit_price_xcg: number;
    fnb_products: {
      name: string;
      code: string;
    } | null;
  }[];
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
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [quickAddOrder, setQuickAddOrder] = useState<{ id: string; orderNumber: string } | null>(null);

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

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
          is_pickup,
          fnb_customers (name, whatsapp_phone, delivery_zone, customer_type),
          fnb_order_items (id, quantity, picked_quantity, short_quantity, unit_price_xcg, fnb_products (name, code))
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
    
    // Total items count
    const totalItems = dayOrders.reduce((sum, order) => {
      return sum + (order.fnb_order_items?.reduce((itemSum, item) => 
        itemSum + (item.quantity || 0), 0) || 0);
    }, 0);
    
    // Picking accuracy calculation
    let totalOrdered = 0;
    let totalPicked = 0;
    dayOrders.forEach(order => {
      order.fnb_order_items?.forEach(item => {
        if (item.picked_quantity !== null) {
          totalOrdered += item.quantity || 0;
          totalPicked += item.picked_quantity || 0;
        }
      });
    });
    const pickingAccuracy = totalOrdered > 0 
      ? Math.round((totalPicked / totalOrdered) * 100) 
      : null;
    
    return { total, delivered, pending, pendingReceipts, codTotal, totalXCG, totalItems, pickingAccuracy };
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
    const isExpanded = expandedOrders.has(order.id);
    const totalItems = order.fnb_order_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

    return (
      <Collapsible
        key={order.id}
        open={isExpanded}
        onOpenChange={() => toggleOrderExpanded(order.id)}
      >
        <Card
          className={cn(
            'mb-2 transition-shadow border-l-4',
            getZoneColor(order.fnb_customers?.delivery_zone || null),
            needsReceipt && 'ring-2 ring-orange-400',
            isExpanded && 'shadow-md'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <CollapsibleTrigger asChild>
            <CardContent className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="space-y-1">
                {/* Customer name on its own row */}
                <p className="font-medium text-sm line-clamp-2">{order.fnb_customers?.name || 'Unknown'}</p>
                
                {/* Amount, items, status, and chevron - all aligned on one row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{order.total_xcg?.toFixed(2)} XCG</span>
                    {totalItems > 0 && (
                      <span className="text-xs text-muted-foreground">({totalItems} items)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {order.is_pickup && (
                      <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 border-amber-300">
                        Pickup
                      </Badge>
                    )}
                    <Badge className={cn('text-xs', statusColors[order.status])}>
                      {order.status?.replace('_', ' ')}
                    </Badge>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-3 pb-3 border-t pt-2 space-y-2">
              {/* Order details */}
              <div className="text-xs text-muted-foreground">
                Order: {order.order_number}
              </div>

              {/* Customer type and zone */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  {customerTypeIcons[customerType]}
                  <span className="text-xs">{customerTypeLabels[customerType]}</span>
                </div>
                {order.fnb_customers?.delivery_zone && (
                  <Badge variant="outline" className="text-xs">
                    {order.fnb_customers.delivery_zone}
                  </Badge>
                )}
              </div>

              {/* Driver info */}
              {order.driver_name && (
                <div className="flex items-center gap-1 text-xs">
                  <Truck className="h-3 w-3" />
                  <span>Driver: {order.driver_name}</span>
                </div>
              )}

              {/* Payment method */}
              {order.payment_method && (
                <div className="flex items-center gap-1 text-xs">
                  <Banknote className="h-3 w-3" />
                  <span>Payment: {order.payment_method}</span>
                </div>
              )}

              {/* Order Items */}
              {order.fnb_order_items && order.fnb_order_items.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium">Items:</p>
                  <div className="space-y-1 pl-2 max-h-32 overflow-y-auto">
                    {order.fnb_order_items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="truncate flex-1">{item.fnb_products?.name || 'Unknown Product'}</span>
                        <span className="text-muted-foreground ml-2">x {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status indicators for supermarket orders */}
              {isSupermarket && order.status === 'delivered' && (
                <div className="flex items-center gap-2 text-xs">
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

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 flex-wrap">
                {['pending', 'confirmed', 'picking'].includes(order.status) && (
                  <Button
                    variant="default"
                    size="sm"
                    className="text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/fnb/picker/${order.id}`);
                    }}
                  >
                    <ClipboardList className="h-3 w-3 mr-1" />
                    Go to Picking
                  </Button>
                )}
                {!['delivered', 'cancelled'].includes(order.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickAddOrder({ id: order.id, orderNumber: order.order_number });
                    }}
                  >
                    <PlusCircle className="h-3 w-3 mr-1" />
                    Add Item
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/fnb/orders/edit/${order.id}`);
                  }}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                {!['delivered', 'cancelled'].includes(order.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Cancel order logic would go here
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
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
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-sm font-semibold">
                      Week {getISOWeek(weekStart)}
                    </Badge>
                    <h2 className="text-lg font-semibold">
                      {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 5), 'MMM d, yyyy')}
                    </h2>
                  </div>
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
                        {stats.totalItems > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <Package className="h-3 w-3 mr-1" />
                            {stats.totalItems}
                          </Badge>
                        )}
                        {stats.pickingAccuracy !== null && (
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              stats.pickingAccuracy >= 95 && "text-green-600 border-green-300",
                              stats.pickingAccuracy >= 80 && stats.pickingAccuracy < 95 && "text-yellow-600 border-yellow-300",
                              stats.pickingAccuracy < 80 && "text-red-600 border-red-300"
                            )}
                          >
                            <Target className="h-3 w-3 mr-1" />
                            {stats.pickingAccuracy}%
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 overflow-y-auto max-h-[500px]">
                    {dayOrders.length === 0 ? (
                      <p className="text-center py-4 text-muted-foreground text-sm">
                        No orders
                      </p>
                    ) : (
                      dayOrders.map((order) => renderOrderCard(order))
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

        {/* Quick Add Item Dialog */}
        {quickAddOrder && (
          <QuickAddItemDialog
            orderId={quickAddOrder.id}
            orderNumber={quickAddOrder.orderNumber}
            open={!!quickAddOrder}
            onOpenChange={(open) => !open && setQuickAddOrder(null)}
          />
        )}
      </main>
    </div>
  );
}
