import { useState } from 'react';
import { format, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Package, 
  Store, 
  Banknote, 
  CreditCard,
  CheckCircle,
  Clock,
  Truck,
  Camera,
  AlertCircle,
  Eye,
  Repeat,
  Edit,
  CalendarDays,
  GripVertical,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { FnbOrderDetailDialog } from './FnbOrderDetailDialog';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  notes: string | null;
  fnb_customers: {
    name: string;
    whatsapp_phone?: string;
    delivery_zone: string | null;
    customer_type: CustomerType;
  } | null;
  fnb_order_items?: { id: string; quantity?: number }[];
}

const isStandingOrder = (order: OrderWithDetails) => {
  return order.notes?.startsWith('Auto-generated from standing order:') ?? false;
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  picking: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  out_for_delivery: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  delivered: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  cancelled: 'bg-destructive/10 text-destructive',
};

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'picking', label: 'Picking' },
  { value: 'ready', label: 'Ready' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

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

// Sortable Order Card for popup
function SortablePopupOrderCard({ 
  order,
  children 
}: { 
  order: OrderWithDetails; 
  children: React.ReactNode;
}) {
  const isDisabled = order.status === 'delivered' || order.status === 'cancelled';
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: order.id,
    disabled: isDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group',
        isDragging && 'opacity-50 z-50'
      )}
    >
      {!isDisabled && (
        <div
          {...listeners}
          {...attributes}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 opacity-0 group-hover:opacity-100 
                     cursor-grab active:cursor-grabbing p-1 rounded bg-muted/80 transition-opacity z-10"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      {children}
    </div>
  );
}

interface FnbOrderDayDialogProps {
  day: Date | null;
  orders: OrderWithDetails[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated?: () => void;
}

export function FnbOrderDayDialog({ day, orders, open, onOpenChange, onOrderUpdated }: FnbOrderDayDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [activeOrder, setActiveOrder] = useState<OrderWithDetails | null>(null);
  const [localOrders, setLocalOrders] = useState<OrderWithDetails[]>([]);

  // Sync local orders when props change
  useState(() => {
    setLocalOrders(orders);
  });

  // Keep local orders in sync with prop orders
  if (JSON.stringify(orders.map(o => o.id)) !== JSON.stringify(localOrders.map(o => o.id))) {
    setLocalOrders(orders);
  }

  // Configure DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  if (!day) return null;

  const getZoneColor = (zone: string | null) => {
    return zone ? (zoneColors[zone] || zoneColors.default) : zoneColors.default;
  };

  const stats = {
    total: orders.length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    pending: orders.filter((o) => o.status === 'pending').length,
    pendingReceipts: orders.filter(
      (o) => o.fnb_customers?.customer_type === 'supermarket' && o.status === 'delivered' && !o.receipt_verified_at
    ).length,
    codTotal: orders
      .filter((o) => o.fnb_customers?.customer_type === 'cod' || o.payment_method === 'cod')
      .reduce((sum, o) => sum + (o.total_xcg || 0), 0),
    totalXCG: orders.reduce((sum, o) => sum + (o.total_xcg || 0), 0),
  };

  // Group orders by driver
  const ordersByDriver = localOrders.reduce((acc, order) => {
    const driver = order.driver_name || 'Unassigned';
    if (!acc[driver]) acc[driver] = [];
    acc[driver].push(order);
    return acc;
  }, {} as Record<string, OrderWithDetails[]>);

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus, oldStatus }: { orderId: string; newStatus: string; oldStatus: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Log the status change
      await supabase.from('fnb_order_modifications').insert({
        order_id: orderId,
        modified_by: user?.id,
        modified_by_email: user?.email,
        modification_type: 'status_changed',
        previous_value: { status: oldStatus },
        new_value: { status: newStatus },
      });

      const { error } = await supabase
        .from('fnb_orders')
        .update({ status: newStatus })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-orders-weekly'] });
      onOrderUpdated?.();
      toast.success('Status updated');
    },
    onError: () => {
      toast.error('Failed to update status');
    }
  });

  // Change date mutation
  const changeDateMutation = useMutation({
    mutationFn: async ({ orderId, newDate }: { orderId: string; newDate: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Log the date change
      await supabase.from('fnb_order_modifications').insert({
        order_id: orderId,
        modified_by: user?.id,
        modified_by_email: user?.email,
        modification_type: 'date_changed',
        new_value: { delivery_date: newDate },
      });

      const { error } = await supabase
        .from('fnb_orders')
        .update({ delivery_date: newDate })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-orders-weekly'] });
      onOrderUpdated?.();
      toast.success('Delivery date updated');
    },
    onError: () => {
      toast.error('Failed to update date');
    }
  });

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: async (reorderedOrders: OrderWithDetails[]) => {
      const updates = reorderedOrders.map((o, index) => 
        supabase.from('fnb_orders').update({ priority: index }).eq('id', o.id)
      );
      
      const results = await Promise.all(updates);
      const hasError = results.some(r => r.error);
      if (hasError) throw new Error('Failed to update order sequence');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-orders-weekly'] });
      onOrderUpdated?.();
      toast.success('Order sequence updated');
    },
    onError: () => {
      toast.error('Failed to update order sequence');
    }
  });

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const order = localOrders.find(o => o.id === event.active.id);
    setActiveOrder(order || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOrder(null);

    if (!over || active.id === over.id) return;

    const oldIndex = localOrders.findIndex(o => o.id === active.id);
    const newIndex = localOrders.findIndex(o => o.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(localOrders, oldIndex, newIndex);
      setLocalOrders(reordered);
      reorderMutation.mutate(reordered);
    }
  };

  const renderOrderCard = (order: OrderWithDetails) => {
    const customerType = order.fnb_customers?.customer_type || 'regular';
    const isSupermarket = customerType === 'supermarket';
    const needsReceipt = isSupermarket && order.status === 'delivered' && !order.receipt_verified_at;
    const hasReceipt = !!order.receipt_photo_url;
    const isVerified = !!order.receipt_verified_at;
    const totalItems = order.fnb_order_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

    return (
      <Card
        className={cn(
          'transition-shadow border-l-4',
          getZoneColor(order.fnb_customers?.delivery_zone || null),
          needsReceipt && 'ring-2 ring-orange-400'
        )}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div 
              className="flex-1 min-w-0 cursor-pointer" 
              onClick={() => setSelectedOrder(order)}
            >
              <div className="flex items-center gap-1.5">
                {isStandingOrder(order) && (
                  <Repeat className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                )}
                <p className="font-medium text-sm truncate">{order.fnb_customers?.name || 'Unknown'}</p>
              </div>
              <p className="text-xs text-muted-foreground">{order.order_number}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Package className="h-3 w-3" />
                <span>{totalItems} items</span>
                <span className="font-medium">{order.total_xcg?.toFixed(2)} XCG</span>
              </div>
            </div>
            
            {/* Actions column */}
            <div className="flex flex-col gap-1.5 shrink-0">
              {/* Status selector */}
              <Select 
                value={order.status} 
                onValueChange={(status) => updateStatusMutation.mutate({ 
                  orderId: order.id, 
                  newStatus: status, 
                  oldStatus: order.status 
                })}
              >
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Action buttons row */}
              <div className="flex items-center gap-1">
                {/* Quick date navigation */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    const prevDate = format(addDays(day, -1), 'yyyy-MM-dd');
                    changeDateMutation.mutate({ orderId: order.id, newDate: prevDate });
                  }}
                  title="Move to previous day"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                
                {/* Date picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Change date">
                      <CalendarDays className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={order.delivery_date ? new Date(order.delivery_date) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          changeDateMutation.mutate({ 
                            orderId: order.id, 
                            newDate: format(date, 'yyyy-MM-dd') 
                          });
                        }
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    const nextDate = format(addDays(day, 1), 'yyyy-MM-dd');
                    changeDateMutation.mutate({ orderId: order.id, newDate: nextDate });
                  }}
                  title="Move to next day"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>

                {/* Edit button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => navigate(`/fnb/orders/edit/${order.id}`)}
                  title="Edit order"
                >
                  <Edit className="h-3 w-3" />
                </Button>

                {/* View details */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedOrder(order)}
                  title="View details"
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Customer type and zone badges */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-4">
              <span>{format(day, 'EEEE, MMMM d, yyyy')}</span>
              <Badge>{stats.total} orders</Badge>
            </DialogTitle>
          </DialogHeader>

          {orders.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No orders for this day</p>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <p className="text-xs text-muted-foreground">Total Orders</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
                    <p className="text-xs text-muted-foreground">Delivered</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-orange-600">{stats.pendingReceipts}</div>
                    <p className="text-xs text-muted-foreground">Pending Receipts</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{stats.totalXCG.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Total XCG</p>
                  </CardContent>
                </Card>
              </div>

              {/* Instructions */}
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <GripVertical className="h-3 w-3" />
                Drag orders to reorder. Use controls to change status or date.
              </p>

              {/* Orders with DnD - Flat list for reordering */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">All Orders</h3>
                  <SortableContext
                    items={localOrders.map(o => o.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {localOrders.map((order) => (
                        <SortablePopupOrderCard key={order.id} order={order}>
                          {renderOrderCard(order)}
                        </SortablePopupOrderCard>
                      ))}
                    </div>
                  </SortableContext>
                </div>

                {/* Drag Overlay */}
                <DragOverlay>
                  {activeOrder ? (
                    <Card className={cn(
                      "w-full opacity-95 shadow-xl rotate-1 border-l-4",
                      getZoneColor(activeOrder.fnb_customers?.delivery_zone || null)
                    )}>
                      <CardContent className="p-3">
                        <p className="font-semibold">{activeOrder.fnb_customers?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{activeOrder.order_number}</p>
                      </CardContent>
                    </Card>
                  ) : null}
                </DragOverlay>
              </DndContext>

              {/* Orders by Driver Summary */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-lg">By Driver</h3>
                {Object.entries(ordersByDriver).map(([driver, driverOrders]) => {
                  const driverTotal = driverOrders.reduce((sum, o) => sum + (o.total_xcg || 0), 0);
                  const driverCOD = driverOrders
                    .filter((o) => o.fnb_customers?.customer_type === 'cod' || o.payment_method === 'cod')
                    .reduce((sum, o) => sum + (o.total_xcg || 0), 0);

                  return (
                    <Card key={driver}>
                      <CardHeader className="py-2 px-4">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            <span>{driver}</span>
                            <Badge variant="outline">{driverOrders.length} orders</Badge>
                          </div>
                          <div className="flex gap-2 text-xs">
                            <span>{driverTotal.toFixed(2)} XCG</span>
                            {driverCOD > 0 && (
                              <Badge variant="outline" className="text-orange-600">
                                COD: {driverCOD.toFixed(2)}
                              </Badge>
                            )}
                          </div>
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button asChild variant="outline">
                  <a href="/fnb/receipts">
                    <Camera className="h-4 w-4 mr-2" />
                    Verify Receipts
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href="/fnb/cod">
                    <Banknote className="h-4 w-4 mr-2" />
                    COD Reconciliation
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <FnbOrderDetailDialog
        order={selectedOrder}
        open={!!selectedOrder}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
      />
    </>
  );
}
