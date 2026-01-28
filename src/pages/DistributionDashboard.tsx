import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, Package, Truck, Clock, Box
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { DashboardStatsBar } from '@/components/fnb/DashboardStatsBar';
import { DashboardKanbanColumn } from '@/components/fnb/DashboardKanbanColumn';
import { DreSummaryWidget } from '@/components/fnb/DreSummaryWidget';
import { FnbAlertsCard } from '@/components/fnb/FnbAlertsCard';
import { WhatsAppLiveFeed } from '@/components/fnb/WhatsAppLiveFeed';

export default function DistributionDashboard() {
  const today = format(new Date(), 'yyyy-MM-dd');

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['distribution-dashboard-stats', today],
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      // Fetch all active orders for stats
      const { data: allOrders } = await supabase
        .from('distribution_orders')
        .select('id, status, total_xcg, created_at, updated_at')
        .limit(500);

      const orders = (allOrders || []) as any[];
      const todayCreated = orders.filter((o: any) => 
        o.created_at >= todayStart && o.created_at <= todayEnd
      );
      const todayDelivered = orders.filter((o: any) => 
        o.status === 'delivered' && o.updated_at >= todayStart && o.updated_at <= todayEnd
      );

      return {
        todayOrders: todayCreated.length,
        pending: orders.filter((o: any) => o.status === 'pending' || o.status === 'confirmed').length,
        picking: orders.filter((o: any) => o.status === 'picking').length,
        outForDelivery: orders.filter((o: any) => o.status === 'out_for_delivery').length,
        completed: todayDelivered.length,
        todayRevenue: todayDelivered.reduce((sum: number, o: any) => sum + (o.total_xcg || 0), 0),
        activeCustomers: 0,
        sameDayOrders: 0, // Removed since delivery_type doesn't exist
      };
    },
    refetchInterval: 30000,
  });

  // Fetch orders for kanban columns
  const { data: orders } = useQuery({
    queryKey: ['distribution-kanban-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_orders')
        .select(`
          id,
          order_number,
          status,
          delivery_date,
          total_xcg,
          created_at,
          distribution_customers(name, whatsapp_phone, delivery_zone)
        `)
        .in('status', ['pending', 'confirmed', 'picking', 'ready', 'out_for_delivery'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 15000,
  });

  // Group orders by status
  const pendingOrders = orders?.filter(o => o.status === 'pending' || o.status === 'confirmed') || [];
  const pickingOrders = orders?.filter(o => o.status === 'picking') || [];
  const readyOrders = orders?.filter(o => o.status === 'ready') || [];
  const deliveryOrders = orders?.filter(o => o.status === 'out_for_delivery') || [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Page Header with Quick Action */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Distribution</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link to="/distribution/orders/new">
            <Plus className="h-4 w-4" />
            New Order
          </Link>
        </Button>
      </div>

      {/* Stats Bar */}
      <DashboardStatsBar 
        stats={stats || {
          todayOrders: 0,
          pending: 0,
          picking: 0,
          outForDelivery: 0,
          completed: 0,
          todayRevenue: 0,
          activeCustomers: 0,
          sameDayOrders: 0,
        }} 
        isLoading={statsLoading} 
      />

      {/* Main Content Grid */}
      <div className="grid gap-4 lg:grid-cols-4">
        {/* Kanban Columns - Takes 3 columns */}
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3 h-[500px]">
          <DashboardKanbanColumn
            title="New Orders"
            icon={<Clock className="h-4 w-4 text-yellow-500" />}
            orders={pendingOrders}
            color="bg-yellow-500/10"
            emptyMessage="No pending orders"
          />
          <DashboardKanbanColumn
            title="Picking"
            icon={<Box className="h-4 w-4 text-purple-500" />}
            orders={pickingOrders}
            color="bg-purple-500/10"
            emptyMessage="No orders being picked"
          />
          <DashboardKanbanColumn
            title="Ready"
            icon={<Package className="h-4 w-4 text-blue-500" />}
            orders={readyOrders}
            color="bg-blue-500/10"
            emptyMessage="No orders ready"
          />
          <DashboardKanbanColumn
            title="Delivery"
            icon={<Truck className="h-4 w-4 text-orange-500" />}
            orders={deliveryOrders}
            color="bg-orange-500/10"
            emptyMessage="No orders in delivery"
          />
        </div>

        {/* Right Sidebar - Takes 1 column */}
        <div className="space-y-4">
          {/* Dre AI Summary */}
          <DreSummaryWidget />

          {/* Alerts */}
          <FnbAlertsCard showAudioAlerts compact />
        </div>
      </div>

      {/* Live Feed */}
      <WhatsAppLiveFeed />
    </div>
  );
}
