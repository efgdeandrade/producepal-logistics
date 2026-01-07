import { useEffect } from 'react';
import { Header } from '../../components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { ArrowLeft, Trophy, AlertTriangle, Check, X, Activity, MapPin, Users, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/ui/badge';
import { PickerLeaderboard } from '../../components/fnb/PickerLeaderboard';
import { LivePickerStatusCards } from '../../components/fnb/LivePickerStatusCards';
import { ZoneQueueOverview } from '../../components/fnb/ZoneQueueOverview';
import { FnbAlertsCard } from '../../components/fnb/FnbAlertsCard';
import { NewOrderToast } from '../../components/fnb/NewOrderToast';
import { useNewOrderNotifications } from '../../hooks/useNewOrderNotifications';
import { cn } from '../../lib/utils';

export default function FnbPickerSupervisor() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // New order notifications
  const {
    notifications,
    isMinimized: notificationsMinimized,
    soundEnabled,
    toggleSound,
    minimize: minimizeNotifications,
    expand: expandNotifications,
    dismissNotification,
  } = useNewOrderNotifications();

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('supervisor-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fnb_picker_queue' }, () => {
        queryClient.invalidateQueries({ queryKey: ['fnb-picker-leaderboard'] });
        queryClient.invalidateQueries({ queryKey: ['fnb-active-pickers'] });
        queryClient.invalidateQueries({ queryKey: ['fnb-zone-stats'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fnb_order_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['fnb-pending-shortages'] });
        queryClient.invalidateQueries({ queryKey: ['fnb-active-pickers'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch leaderboard stats
  const { data: leaderboardStats } = useQuery({
    queryKey: ['fnb-picker-leaderboard'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('fnb_picker_queue')
        .select('picker_name, completed_at, pick_start_time, order_id')
        .eq('status', 'completed')
        .gte('completed_at', today)
        .not('picker_name', 'is', null);

      const { data: activePickers } = await supabase
        .from('fnb_picker_queue')
        .select('picker_name')
        .eq('status', 'in_progress')
        .not('picker_name', 'is', null);

      const activeNames = new Set(activePickers?.map((p: any) => p.picker_name) || []);
      const statsMap: Record<string, { orders: number; totalTime: number; items: number }> = {};
      
      data?.forEach((row: any) => {
        const name = row.picker_name;
        if (!statsMap[name]) statsMap[name] = { orders: 0, totalTime: 0, items: 0 };
        statsMap[name].orders++;
        if (row.pick_start_time && row.completed_at) {
          statsMap[name].totalTime += (new Date(row.completed_at).getTime() - new Date(row.pick_start_time).getTime()) / 60000;
        }
      });

      return Object.entries(statsMap).map(([name, stats]) => ({
        picker_name: name,
        orders_completed: stats.orders,
        avg_pick_time_minutes: stats.orders > 0 ? stats.totalTime / stats.orders : 0,
        items_picked: stats.items,
        is_active: activeNames.has(name),
      }));
    },
    refetchInterval: 10000,
  });

  // Fetch active pickers with their current order
  const { data: activePickersData } = useQuery({
    queryKey: ['fnb-active-pickers'],
    queryFn: async () => {
      const { data: activeQueues } = await supabase
        .from('fnb_picker_queue')
        .select(`
          id,
          picker_name,
          pick_start_time,
          order_id,
          fnb_orders!inner(
            id,
            order_number,
            fnb_customers(name)
          )
        `)
        .eq('status', 'in_progress')
        .not('picker_name', 'is', null);

      if (!activeQueues || activeQueues.length === 0) {
        return { active: [], idle: [] };
      }

      // Get item counts for each order
      const orderIds = activeQueues.map(q => q.order_id);
      const { data: itemCounts } = await supabase
        .from('fnb_order_items')
        .select('order_id, picked_quantity')
        .in('order_id', orderIds);

      const orderItemStats: Record<string, { total: number; picked: number }> = {};
      itemCounts?.forEach((item: any) => {
        if (!orderItemStats[item.order_id]) {
          orderItemStats[item.order_id] = { total: 0, picked: 0 };
        }
        orderItemStats[item.order_id].total++;
        if (item.picked_quantity !== null) {
          orderItemStats[item.order_id].picked++;
        }
      });

      const activePickers = activeQueues.map((q: any) => ({
        id: q.id,
        picker_name: q.picker_name,
        order_id: q.order_id,
        order_number: q.fnb_orders?.order_number || 'N/A',
        customer_name: q.fnb_orders?.fnb_customers?.name || 'Unknown',
        pick_start_time: q.pick_start_time || new Date().toISOString(),
        items_count: orderItemStats[q.order_id]?.total || 0,
        items_picked: orderItemStats[q.order_id]?.picked || 0,
      }));

      // Get idle pickers (completed today but not currently active)
      const activeNames = new Set(activePickers.map(p => p.picker_name));
      const today = new Date().toISOString().split('T')[0];
      const { data: todaysPickers } = await supabase
        .from('fnb_picker_queue')
        .select('picker_name')
        .gte('completed_at', today)
        .not('picker_name', 'is', null);

      const allTodayNames = new Set(todaysPickers?.map((p: any) => p.picker_name) || []);
      const idlePickers = Array.from(allTodayNames).filter(name => !activeNames.has(name));

      return { active: activePickers, idle: idlePickers };
    },
    refetchInterval: 3000,
  });

  // Fetch zone stats
  const { data: zoneStats } = useQuery({
    queryKey: ['fnb-zone-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: queueData } = await supabase
        .from('fnb_picker_queue')
        .select(`
          id,
          status,
          created_at,
          fnb_orders!inner(
            fnb_customers(delivery_zone)
          )
        `)
        .gte('created_at', today);

      if (!queueData) return [];

      const zoneMap: Record<string, { 
        queued: number; 
        in_progress: number; 
        completed: number; 
        waitTimes: number[] 
      }> = {};

      queueData.forEach((q: any) => {
        const zone = q.fnb_orders?.fnb_customers?.delivery_zone || 'Unknown';
        if (!zoneMap[zone]) {
          zoneMap[zone] = { queued: 0, in_progress: 0, completed: 0, waitTimes: [] };
        }
        
        if (q.status === 'queued') {
          zoneMap[zone].queued++;
          const waitMinutes = (Date.now() - new Date(q.created_at).getTime()) / 60000;
          zoneMap[zone].waitTimes.push(waitMinutes);
        } else if (q.status === 'in_progress') {
          zoneMap[zone].in_progress++;
        } else if (q.status === 'completed') {
          zoneMap[zone].completed++;
        }
      });

      return Object.entries(zoneMap).map(([name, stats]) => ({
        zone_name: name,
        total_orders: stats.queued + stats.in_progress + stats.completed,
        queued_orders: stats.queued,
        in_progress_orders: stats.in_progress,
        completed_orders: stats.completed,
        avg_wait_minutes: stats.waitTimes.length > 0 
          ? stats.waitTimes.reduce((a, b) => a + b, 0) / stats.waitTimes.length 
          : 0,
      }));
    },
    refetchInterval: 10000,
  });

  // Fetch pending shortages
  const { data: pendingShortages } = useQuery({
    queryKey: ['fnb-pending-shortages'],
    queryFn: async () => {
      const { data } = await supabase
        .from('fnb_order_items')
        .select(`*, fnb_products(name, code), fnb_orders(order_number, fnb_customers(name))`)
        .eq('shortage_status', 'pending');
      return data || [];
    },
    refetchInterval: 10000,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ itemId, approved }: { itemId: string; approved: boolean }) => {
      await supabase
        .from('fnb_order_items')
        .update({
          shortage_status: approved ? 'approved' : 'rejected',
          shortage_approved_by: user?.id,
          shortage_approved_at: new Date().toISOString(),
        })
        .eq('id', itemId);
    },
    onSuccess: (_, { approved }) => {
      queryClient.invalidateQueries({ queryKey: ['fnb-pending-shortages'] });
      toast.success(approved ? 'Shortage approved' : 'Shortage rejected');
    },
  });

  const totalQueued = zoneStats?.reduce((acc, z) => acc + z.queued_orders, 0) || 0;
  const totalActive = activePickersData?.active.length || 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Floating notification stack */}
      <NewOrderToast
        notifications={notifications}
        isMinimized={notificationsMinimized}
        onMinimize={minimizeNotifications}
        onExpand={expandNotifications}
        onPickOrder={(notification) => {
          dismissNotification(notification.id);
          toast.info(`Order for ${notification.customerName} ready for picking`);
        }}
        onDismiss={dismissNotification}
      />
      
      <main className="container py-6 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/fnb"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Picker Supervisor Dashboard</h1>
              <p className="text-muted-foreground">Real-time monitoring of picker operations</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSound}
              className={cn(
                "relative",
                soundEnabled ? "text-primary" : "text-muted-foreground"
              )}
              title={soundEnabled ? "Sound notifications on" : "Sound notifications off"}
            >
              {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </Button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-blue-600 dark:text-blue-400">{totalActive} Active</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900">
              <Activity className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-amber-600 dark:text-amber-400">{totalQueued} Queued</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Live Status */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Pickers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-500" />
                  Live Picker Status
                  {totalActive > 0 && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      {totalActive} picking
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LivePickerStatusCards 
                  activePickers={activePickersData?.active || []}
                  idlePickers={activePickersData?.idle || []}
                />
              </CardContent>
            </Card>

            {/* Zone Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-500" />
                  Zone Queue Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ZoneQueueOverview zones={zoneStats || []} />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Leaderboard & Alerts */}
          <div className="space-y-6">
            {/* Leaderboard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  Today's Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PickerLeaderboard stats={leaderboardStats || []} />
              </CardContent>
            </Card>

            {/* Alerts Card */}
            <FnbAlertsCard showAudioAlerts />

            {/* Pending Shortages */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Pending Shortage Approvals
                  {pendingShortages && pendingShortages.length > 0 && (
                    <Badge variant="destructive">{pendingShortages.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingShortages && pendingShortages.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {pendingShortages.map((item: any) => (
                      <div key={item.id} className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-sm">{item.fnb_products?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.fnb_orders?.order_number} • {item.fnb_orders?.fnb_customers?.name}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">{item.short_reason}</Badge>
                        </div>
                        <p className="text-xs mb-2">
                          {item.quantity} → {item.picked_quantity} (−{item.short_quantity})
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs" onClick={() => approveMutation.mutate({ itemId: item.id, approved: true })}>
                            <Check className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => approveMutation.mutate({ itemId: item.id, approved: false })}>
                            <X className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-6 text-muted-foreground text-sm">No pending approvals</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
