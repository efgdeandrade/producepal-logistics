import { useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
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
  Repeat
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
import { cn } from '@/lib/utils';
import { FnbOrderDetailDialog } from './FnbOrderDetailDialog';

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
  fnb_order_items?: { id: string }[];
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

interface FnbOrderDayDialogProps {
  day: Date | null;
  orders: OrderWithDetails[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FnbOrderDayDialog({ day, orders, open, onOpenChange }: FnbOrderDayDialogProps) {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);

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
  const ordersByDriver = orders.reduce((acc, order) => {
    const driver = order.driver_name || 'Unassigned';
    if (!acc[driver]) acc[driver] = [];
    acc[driver].push(order);
    return acc;
  }, {} as Record<string, OrderWithDetails[]>);

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
          'cursor-pointer hover:shadow-md transition-shadow border-l-4',
          getZoneColor(order.fnb_customers?.delivery_zone || null),
          needsReceipt && 'ring-2 ring-orange-400'
        )}
        onClick={() => setSelectedOrder(order)}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {isStandingOrder(order) && (
                  <Repeat className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                )}
                <p className="font-medium text-sm truncate">{order.fnb_customers?.name || 'Unknown'}</p>
              </div>
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
            <Button variant="ghost" size="sm" className="h-6 px-2">
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
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

              {/* Orders by Driver */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Orders by Driver</h3>
                {Object.entries(ordersByDriver).map(([driver, driverOrders]) => {
                  const driverTotal = driverOrders.reduce((sum, o) => sum + (o.total_xcg || 0), 0);
                  const driverCOD = driverOrders
                    .filter((o) => o.fnb_customers?.customer_type === 'cod' || o.payment_method === 'cod')
                    .reduce((sum, o) => sum + (o.total_xcg || 0), 0);

                  return (
                    <Card key={driver}>
                      <CardHeader className="pb-2">
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
                      <CardContent>
                        <div className="grid gap-2 md:grid-cols-2">
                          {driverOrders.map((order) => renderOrderCard(order))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button asChild variant="outline">
                  <Link to="/fnb/receipts">
                    <Camera className="h-4 w-4 mr-2" />
                    Verify Receipts
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/fnb/cod">
                    <Banknote className="h-4 w-4 mr-2" />
                    COD Reconciliation
                  </Link>
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
