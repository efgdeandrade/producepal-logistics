import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../ui/chart";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, LineChart, Line } from "recharts";
import { Skeleton } from "../ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface RevenueData {
  date: string;
  revenue: number;
  orders: number;
  avgOrderValue: number;
}

interface RevenueMetrics {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  revenueChange: number;
  ordersChange: number;
}

export function RevenueAnalytics() {
  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ["revenue-analytics"],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = subDays(endDate, 30);

      const { data: orders, error } = await supabase
        .from("fnb_orders")
        .select("order_date, total_xcg, status")
        .gte("order_date", format(startDate, "yyyy-MM-dd"))
        .lte("order_date", format(endDate, "yyyy-MM-dd"))
        .in("status", ["delivered", "picked", "ready"]);

      if (error) throw error;

      // Group by date
      const dailyData: Record<string, { revenue: number; orders: number }> = {};
      
      for (let i = 0; i <= 30; i++) {
        const date = format(subDays(endDate, 30 - i), "yyyy-MM-dd");
        dailyData[date] = { revenue: 0, orders: 0 };
      }

      orders?.forEach((order) => {
        const date = order.order_date;
        if (dailyData[date]) {
          dailyData[date].revenue += order.total_xcg || 0;
          dailyData[date].orders += 1;
        }
      });

      return Object.entries(dailyData).map(([date, data]) => ({
        date,
        displayDate: format(new Date(date), "MMM d"),
        revenue: Math.round(data.revenue * 100) / 100,
        orders: data.orders,
        avgOrderValue: data.orders > 0 ? Math.round((data.revenue / data.orders) * 100) / 100 : 0,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["revenue-metrics"],
    queryFn: async () => {
      const today = new Date();
      const thisWeekStart = subDays(today, 7);
      const lastWeekStart = subDays(today, 14);

      // This week
      const { data: thisWeekOrders } = await supabase
        .from("fnb_orders")
        .select("total_xcg")
        .gte("order_date", format(thisWeekStart, "yyyy-MM-dd"))
        .in("status", ["delivered", "picked", "ready"]);

      // Last week
      const { data: lastWeekOrders } = await supabase
        .from("fnb_orders")
        .select("total_xcg")
        .gte("order_date", format(lastWeekStart, "yyyy-MM-dd"))
        .lt("order_date", format(thisWeekStart, "yyyy-MM-dd"))
        .in("status", ["delivered", "picked", "ready"]);

      const thisWeekRevenue = thisWeekOrders?.reduce((sum, o) => sum + (o.total_xcg || 0), 0) || 0;
      const lastWeekRevenue = lastWeekOrders?.reduce((sum, o) => sum + (o.total_xcg || 0), 0) || 0;

      const thisWeekCount = thisWeekOrders?.length || 0;
      const lastWeekCount = lastWeekOrders?.length || 0;

      return {
        totalRevenue: thisWeekRevenue,
        totalOrders: thisWeekCount,
        avgOrderValue: thisWeekCount > 0 ? thisWeekRevenue / thisWeekCount : 0,
        revenueChange: lastWeekRevenue > 0 ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : 0,
        ordersChange: lastWeekCount > 0 ? ((thisWeekCount - lastWeekCount) / lastWeekCount) * 100 : 0,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const chartConfig = {
    revenue: { label: "Revenue", color: "hsl(var(--primary))" },
    orders: { label: "Orders", color: "hsl(var(--secondary))" },
    avgOrderValue: { label: "Avg Order", color: "hsl(var(--accent))" },
  };

  if (revenueLoading || metricsLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ƒ{metrics?.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div className={`flex items-center text-xs ${(metrics?.revenueChange || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
              {(metrics?.revenueChange || 0) >= 0 ? (
                <TrendingUp className="mr-1 h-3 w-3" />
              ) : (
                <TrendingDown className="mr-1 h-3 w-3" />
              )}
              {Math.abs(metrics?.revenueChange || 0).toFixed(1)}% vs last week
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalOrders}</div>
            <div className={`flex items-center text-xs ${(metrics?.ordersChange || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
              {(metrics?.ordersChange || 0) >= 0 ? (
                <TrendingUp className="mr-1 h-3 w-3" />
              ) : (
                <TrendingDown className="mr-1 h-3 w-3" />
              )}
              {Math.abs(metrics?.ordersChange || 0).toFixed(1)}% vs last week
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ƒ{(metrics?.avgOrderValue || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Per order this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ƒ{((metrics?.totalRevenue || 0) / 7).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Revenue per day</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend (30 Days)</CardTitle>
          <CardDescription>Daily revenue and order volume</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="displayDate" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `ƒ${v}`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                fill="url(#revenueGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Orders vs Revenue Comparison */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Order Volume</CardTitle>
            <CardDescription>Daily order count</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <BarChart data={revenueData?.slice(-14)}>
                <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Order Value</CardTitle>
            <CardDescription>Daily AOV trend</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <LineChart data={revenueData?.slice(-14)}>
                <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `ƒ${v}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="avgOrderValue" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
