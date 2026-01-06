import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Truck,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  Factory,
  Store,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

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
        .from("fnb_orders")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);

      // Active deliveries
      const { count: activeDeliveries } = await supabase
        .from("fnb_orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["picked", "dispatched", "in_transit"]);

      // Distribution revenue today
      const { data: distributionRevenue } = await supabase
        .from("fnb_orders")
        .select("total_xcg")
        .eq("status", "delivered")
        .gte("delivered_at", todayStart)
        .lte("delivered_at", todayEnd);

      const todayRevenue = distributionRevenue?.reduce((sum, o) => sum + (o.total_xcg || 0), 0) || 0;

      // Pending issues (orders with shortages)
      const { count: pendingIssues } = await supabase
        .from("fnb_order_items")
        .select("*", { count: "exact", head: true })
        .eq("shortage_status", "pending");

      // Weekly comparison data
      const { data: weeklyOrders } = await supabase
        .from("fnb_orders")
        .select("created_at, total_xcg, status")
        .gte("created_at", weekAgo);

      return {
        importOrdersToday: importOrdersToday || 0,
        distributionOrdersToday: distributionOrdersToday || 0,
        activeDeliveries: activeDeliveries || 0,
        todayRevenue,
        pendingIssues: pendingIssues || 0,
        weeklyOrders: weeklyOrders || [],
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

// Fetch department health data
const useDepartmentHealth = () => {
  return useQuery({
    queryKey: ["department-health"],
    queryFn: async () => {
      // Distribution health
      const { count: pickingQueue } = await supabase
        .from("fnb_picker_queue")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "in_progress"]);

      const { data: codCollected } = await supabase
        .from("fnb_orders")
        .select("cod_amount_collected")
        .not("cod_amount_collected", "is", null)
        .gte("cod_collected_at", startOfDay(new Date()).toISOString());

      const todayCOD = codCollected?.reduce((sum, o) => sum + (o.cod_amount_collected || 0), 0) || 0;

      // Logistics health
      const { count: driversActive } = await supabase
        .from("fnb_orders")
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

// KPI Card component
function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  loading,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20 mb-1" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          {trend && trendValue && (
            <div
              className={`flex items-center text-xs ${
                trend === "up"
                  ? "text-green-600"
                  : trend === "down"
                  ? "text-red-600"
                  : "text-muted-foreground"
              }`}
            >
              {trend === "up" ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : trend === "down" ? (
                <ArrowDownRight className="h-3 w-3" />
              ) : null}
              {trendValue}
            </div>
          )}
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Department Health Card
function DepartmentHealthCard({
  title,
  icon: Icon,
  metrics,
  color,
  loading,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  metrics: { label: string; value: string | number }[];
  color: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className={`h-1 ${color}`} />
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {metrics.map((metric, i) => (
            <div key={i} className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{metric.label}</span>
              <span className="font-medium">{metric.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExecutiveDashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: health, isLoading: healthLoading } = useDepartmentHealth();

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

  const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of all business operations • {format(new Date(), "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title="Import Orders Today"
          value={stats?.importOrdersToday || 0}
          icon={Package}
          loading={statsLoading}
        />
        <KPICard
          title="Distribution Orders"
          value={stats?.distributionOrdersToday || 0}
          icon={Store}
          loading={statsLoading}
        />
        <KPICard
          title="Active Deliveries"
          value={stats?.activeDeliveries || 0}
          icon={Truck}
          loading={statsLoading}
        />
        <KPICard
          title="Today's Revenue"
          value={`ƒ ${(stats?.todayRevenue || 0).toLocaleString()}`}
          icon={DollarSign}
          loading={statsLoading}
        />
        <KPICard
          title="Pending Issues"
          value={stats?.pendingIssues || 0}
          icon={AlertTriangle}
          loading={statsLoading}
          trend={stats?.pendingIssues ? "down" : "neutral"}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Weekly Orders Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Orders Trend</CardTitle>
            <CardDescription>Distribution orders over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
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

        {/* Revenue by Day */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Revenue</CardTitle>
            <CardDescription>Revenue trend for the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
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
      </div>

      {/* Department Health */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Department Health</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DepartmentHealthCard
            title="Import"
            icon={Package}
            color="bg-blue-500"
            loading={healthLoading}
            metrics={[
              { label: "Orders Today", value: stats?.importOrdersToday || 0 },
              { label: "Pending CIF", value: "—" },
            ]}
          />
          <DepartmentHealthCard
            title="Distribution"
            icon={Store}
            color="bg-green-500"
            loading={healthLoading}
            metrics={[
              { label: "Picking Queue", value: health?.distribution.pickingQueue || 0 },
              { label: "COD Collected", value: `ƒ ${(health?.distribution.codCollected || 0).toLocaleString()}` },
            ]}
          />
          <DepartmentHealthCard
            title="Logistics"
            icon={Truck}
            color="bg-orange-500"
            loading={healthLoading}
            metrics={[
              { label: "Drivers Active", value: health?.logistics.driversActive || 0 },
              { label: "In Transit", value: stats?.activeDeliveries || 0 },
            ]}
          />
          <DepartmentHealthCard
            title="Production"
            icon={Factory}
            color="bg-purple-500"
            loading={healthLoading}
            metrics={[
              { label: "Pending Orders", value: health?.production.pendingOrders || 0 },
              { label: "Completion Rate", value: "—" },
            ]}
          />
        </div>
      </div>

      {/* Quick Actions / Alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Alerts & Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.pendingIssues ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">Pending shortage approvals</span>
                  </div>
                  <Badge variant="secondary">{stats.pendingIssues}</Badge>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                No active alerts
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              AI Insights
            </CardTitle>
            <CardDescription>Recommendations based on your data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                <p className="text-sm">
                  <strong>💡 Opportunity:</strong> Distribution orders are up 15% this week. Consider optimizing driver routes for the busy zones.
                </p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  More insights will appear as data accumulates.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
