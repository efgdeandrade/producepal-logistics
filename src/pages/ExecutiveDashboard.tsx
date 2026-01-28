import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Package,
  Truck,
  Users,
  Factory,
  Store,
  Zap,
  Calendar,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { useExecutiveDashboardRealtime } from "@/hooks/useRealtimeUpdates";
import { FnbAlertsCard } from "@/components/fnb/FnbAlertsCard";
import { IntegrationHealthIndicator, IntegrationHealthBadges } from "@/components/IntegrationHealthIndicator";
import { ExecutiveKPIGrid } from "@/components/executive/ExecutiveKPIGrid";
import { ExecutiveInsightsPanel } from "@/components/executive/ExecutiveInsightsPanel";

// Fetch dashboard stats
const useDashboardStats = () => {
  return useQuery({
    queryKey: ["executive-dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();
      const weekAgo = subDays(today, 7).toISOString();

      // Import orders today
      const { count: importOrdersToday } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);

      // Distribution orders today
      const { count: distributionOrdersToday } = await supabase
        .from("distribution_orders")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);

      // Active deliveries
      const { count: activeDeliveries } = await supabase
        .from("distribution_orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["picked", "dispatched", "in_transit"]);

      // Distribution revenue today
      const { data: distributionRevenue } = await supabase
        .from("distribution_orders")
        .select("total_xcg")
        .eq("status", "delivered")
        .gte("delivered_at", todayStart)
        .lte("delivered_at", todayEnd) as { data: { total_xcg: number }[] | null };

      const todayRevenue = distributionRevenue?.reduce((sum, o) => sum + (o.total_xcg || 0), 0) || 0;

      // Pending issues (orders with shortages)
      const { count: pendingIssues } = await supabase
        .from("distribution_order_items")
        .select("*", { count: "exact", head: true })
        .eq("shortage_status", "pending");

      // Weekly comparison data
      const { data: weeklyOrders } = await supabase
        .from("distribution_orders")
        .select("created_at, total_xcg, status")
        .gte("created_at", weekAgo) as { data: { created_at: string; total_xcg: number; status: string }[] | null };

      return {
        importOrdersToday: importOrdersToday || 0,
        distributionOrdersToday: distributionOrdersToday || 0,
        activeDeliveries: activeDeliveries || 0,
        todayRevenue,
        pendingIssues: pendingIssues || 0,
        weeklyOrders: weeklyOrders || [],
      };
    },
    refetchInterval: 30000,
  });
};

// Fetch HR metrics
const useHRMetrics = () => {
  return useQuery({
    queryKey: ["hr-dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 }).toISOString();
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 }).toISOString();

      // Employees currently clocked in
      const { count: clockedIn } = await supabase
        .from("time_entries")
        .select("*", { count: "exact", head: true })
        .is("clock_out", null);

      // Total hours this week
      const { data: weeklyEntries } = await supabase
        .from("time_entries")
        .select("clock_in, clock_out")
        .gte("clock_in", weekStart)
        .lte("clock_in", weekEnd);

      const totalMinutes = weeklyEntries?.reduce((acc, entry) => {
        if (entry.clock_out) {
          const start = new Date(entry.clock_in).getTime();
          const end = new Date(entry.clock_out).getTime();
          return acc + (end - start) / 60000;
        }
        return acc;
      }, 0) || 0;

      // Pending document reviews
      const { count: pendingDocs } = await supabase
        .from("employee_documents")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Expiring documents (within 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const { count: expiringDocs } = await supabase
        .from("employee_documents")
        .select("*", { count: "exact", head: true })
        .lte("expiry_date", thirtyDaysFromNow.toISOString())
        .gte("expiry_date", today.toISOString());

      return {
        clockedIn: clockedIn || 0,
        weeklyHours: Math.round(totalMinutes / 60),
        pendingDocs: pendingDocs || 0,
        expiringDocs: expiringDocs || 0,
      };
    },
    refetchInterval: 60000,
  });
};

// Fetch department health data
const useDepartmentHealth = () => {
  return useQuery({
    queryKey: ["department-health"],
    queryFn: async () => {
      // Distribution health
      const { count: pickingQueue } = await supabase
        .from("distribution_picker_queue")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "in_progress"]);

      const { data: codCollected } = await supabase
        .from("distribution_orders")
        .select("cod_amount_collected")
        .not("cod_amount_collected", "is", null)
        .gte("cod_collected_at", startOfDay(new Date()).toISOString()) as { data: { cod_amount_collected: number }[] | null };

      const todayCOD = codCollected?.reduce((sum, o) => sum + (o.cod_amount_collected || 0), 0) || 0;

      // Logistics health
      const { count: driversActive } = await supabase
        .from("distribution_orders")
        .select("driver_id", { count: "exact", head: true })
        .not("driver_id", "is", null)
        .in("status", ["dispatched", "in_transit"]);

      // Production
      const { count: productionOrders } = await supabase
        .from("production_orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      return {
        distribution: {
          pickingQueue: pickingQueue || 0,
          codCollected: todayCOD,
        },
        logistics: {
          driversActive: driversActive || 0,
        },
        production: {
          pendingOrders: productionOrders || 0,
        },
      };
    },
  });
};

// Fetch Dre AI metrics
const useDreAIMetrics = () => {
  return useQuery({
    queryKey: ["dre-ai-metrics"],
    queryFn: async () => {
      const weekAgo = subDays(new Date(), 7).toISOString();

      const { data: aiLogs } = await supabase
        .from("distribution_ai_match_logs")
        .select("was_corrected, needs_review")
        .gte("created_at", weekAgo);

      const total = aiLogs?.length || 0;
      const correct = aiLogs?.filter(l => !l.was_corrected && !l.needs_review).length || 0;
      const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : '--';

      const { data: healthCheck } = await supabase
        .from("whatsapp_health_checks")
        .select("status")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        accuracy: `${accuracy}%`,
        uptime: healthCheck?.status === 'healthy' ? 100 : 0,
        conversions: 0, // Would need outreach log data
      };
    },
  });
};

export default function ExecutiveDashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: health, isLoading: healthLoading } = useDepartmentHealth();
  const { data: hrMetrics, isLoading: hrLoading } = useHRMetrics();
  const { data: aiMetrics } = useDreAIMetrics();
  const { lastUpdate } = useExecutiveDashboardRealtime();

  // Process weekly data for chart
  const chartData = (() => {
    if (!stats?.weeklyOrders) return [];
    
    const days: Record<string, { date: string; orders: number; revenue: number }> = {};
    
    for (let i = 6; i >= 0; i--) {
      const date = format(subDays(new Date(), i), "EEE");
      days[date] = { date, orders: 0, revenue: 0 };
    }
    
    stats.weeklyOrders.forEach((order) => {
      const date = format(new Date(order.created_at), "EEE");
      if (days[date]) {
        days[date].orders++;
        days[date].revenue += order.total_xcg || 0;
      }
    });
    
    return Object.values(days);
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="hidden md:block text-2xl font-bold tracking-tight">Executive Overview</h1>
          <div className="flex items-center gap-3">
            <IntegrationHealthBadges />
            {lastUpdate && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Zap className="h-3 w-3 text-green-500" />
                Live
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </span>
          <span>Week {format(new Date(), "w")}</span>
        </div>
      </div>

      {/* KPI Grid */}
      <ExecutiveKPIGrid
        stats={stats}
        hrMetrics={hrMetrics}
        health={health}
        aiMetrics={aiMetrics}
        statsLoading={statsLoading}
        hrLoading={hrLoading}
        healthLoading={healthLoading}
      />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column - Charts & Health */}
        <div className="lg:col-span-8 space-y-6">
          {/* Charts Row */}
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-[300px]">
              <TabsTrigger value="orders">Orders Trend</TabsTrigger>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
            </TabsList>
            <TabsContent value="orders">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Weekly Orders</CardTitle>
                  <CardDescription>Distribution orders over the last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="orders"
                          stroke="hsl(var(--primary))"
                          fillOpacity={1}
                          fill="url(#colorOrders)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="revenue">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Daily Revenue</CardTitle>
                  <CardDescription>Revenue trend for the last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => [`ƒ ${value.toLocaleString()}`, "Revenue"]}
                        />
                        <Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Department Quick View */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="overflow-hidden">
              <div className="h-1 bg-blue-500" />
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-500" />
                  Import
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {stats?.importOrdersToday || 0} orders today
              </CardContent>
            </Card>
            <Card className="overflow-hidden">
              <div className="h-1 bg-green-500" />
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Store className="h-4 w-4 text-green-500" />
                  Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {stats?.distributionOrdersToday || 0} orders today
              </CardContent>
            </Card>
            <Card className="overflow-hidden">
              <div className="h-1 bg-orange-500" />
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Truck className="h-4 w-4 text-orange-500" />
                  Logistics
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {health?.logistics?.driversActive || 0} drivers active
              </CardContent>
            </Card>
            <Card className="overflow-hidden">
              <div className="h-1 bg-purple-500" />
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Factory className="h-4 w-4 text-purple-500" />
                  Production
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {health?.production?.pendingOrders || 0} pending
              </CardContent>
            </Card>
          </div>

          {/* Alerts & Integrations Row */}
          <div className="grid gap-4 md:grid-cols-2">
            <FnbAlertsCard compact />
            <IntegrationHealthIndicator />
          </div>
        </div>

        {/* Right Column - AI Insights */}
        <div className="lg:col-span-4">
          <ExecutiveInsightsPanel />
        </div>
      </div>
    </div>
  );
}
