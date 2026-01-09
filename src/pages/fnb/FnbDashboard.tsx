import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Package, Users, ShoppingCart, ClipboardList, MessageSquare, TrendingUp, Plus, Truck, Banknote, BarChart3, MapPin, Calendar, Camera, CalendarCheck, DollarSign } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { FnbAlertsCard } from '@/components/fnb/FnbAlertsCard';

export default function FnbDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['fnb-dashboard-stats'],
    queryFn: async () => {
      const [ordersResult, customersResult, productsResult, pendingResult] = await Promise.all([
        supabase.from('fnb_orders').select('id', { count: 'exact' }),
        supabase.from('fnb_customers').select('id', { count: 'exact' }),
        supabase.from('fnb_products').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('fnb_orders').select('id', { count: 'exact' }).eq('status', 'pending'),
      ]);

      return {
        totalOrders: ordersResult.count || 0,
        totalCustomers: customersResult.count || 0,
        activeProducts: productsResult.count || 0,
        pendingOrders: pendingResult.count || 0,
      };
    },
  });

  const { data: recentOrders } = useQuery({
    queryKey: ['fnb-recent-orders'],
    queryFn: async () => {
      const { data } = await supabase
        .from('fnb_orders')
        .select(`
          *,
          fnb_customers(name, whatsapp_phone)
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      <Header />
      <main className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Distribution</h1>
            <p className="text-muted-foreground">
              Manage your customers, orders, and WhatsApp integration
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.totalOrders}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-orange-500">{stats?.pendingOrders}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.totalCustomers}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.activeProducts}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-6">
          <Button asChild className="h-24 flex-col gap-2">
            <Link to="/distribution/orders/new">
              <Plus className="h-6 w-6" />
              <span>New Order</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24 flex-col gap-2">
            <Link to="/distribution/orders">
              <ShoppingCart className="h-6 w-6" />
              <span>View Orders</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24 flex-col gap-2">
            <Link to="/distribution/customers">
              <Users className="h-6 w-6" />
              <span>Customers</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24 flex-col gap-2">
            <Link to="/distribution/products">
              <Package className="h-6 w-6" />
              <span>Products</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24 flex-col gap-2">
            <Link to="/distribution/picker">
              <ClipboardList className="h-6 w-6" />
              <span>Picker Station</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24 flex-col gap-2">
            <Link to="/distribution/delivery">
              <Truck className="h-6 w-6" />
              <span>Delivery</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24 flex-col gap-2">
            <Link to="/distribution/cod">
              <Banknote className="h-6 w-6" />
              <span>COD</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24 flex-col gap-2">
            <Link to="/distribution/analytics">
              <BarChart3 className="h-6 w-6" />
              <span>Analytics</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24 flex-col gap-2">
            <Link to="/distribution/zones">
              <MapPin className="h-6 w-6" />
              <span>Zones</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24 flex-col gap-2">
            <Link to="/distribution/driver-portal">
              <Truck className="h-6 w-6" />
              <span>Driver Portal</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24 flex-col gap-2">
            <Link to="/distribution/settings">
              <MessageSquare className="h-6 w-6" />
              <span>WhatsApp Setup</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24 flex-col gap-2 border-primary/50">
            <Link to="/distribution/weekly">
              <Calendar className="h-6 w-6" />
              <span>Weekly Board</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24 flex-col gap-2 border-green-500/50">
            <Link to="/distribution/standing-orders">
              <CalendarCheck className="h-6 w-6" />
              <span>Standing Orders</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24 flex-col gap-2 border-orange-500/50">
            <Link to="/distribution/receipts">
              <Camera className="h-6 w-6" />
              <span>Receipts</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24 flex-col gap-2 border-yellow-500/50">
            <Link to="/distribution/pricing-tiers">
              <DollarSign className="h-6 w-6" />
              <span>Pricing Tiers</span>
            </Link>
          </Button>
        </div>

        {/* Alerts Card */}
        <div className="mb-6">
          <FnbAlertsCard showAudioAlerts />
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-4">
                {recentOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{order.order_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.fnb_customers?.name} • {order.fnb_customers?.whatsapp_phone}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          order.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : order.status === 'confirmed'
                            ? 'bg-blue-100 text-blue-800'
                            : order.status === 'picking'
                            ? 'bg-purple-100 text-purple-800'
                            : order.status === 'ready'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'out_for_delivery'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {order.status}
                      </span>
                      <p className="text-sm text-muted-foreground mt-1">
                        {order.total_xcg?.toFixed(2)} XCG
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No orders yet. Click "New Order" to create your first order.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}