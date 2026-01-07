import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { Users, Star, TrendingUp, ShoppingBag } from "lucide-react";
import { format, subDays } from "date-fns";

export function CustomerInsights() {
  const { data: customerStats, isLoading: statsLoading } = useQuery({
    queryKey: ["customer-insights"],
    queryFn: async () => {
      // Get all customers
      const { data: customers, error: custError } = await supabase
        .from("fnb_customers")
        .select("id, name, customer_type, pricing_tier_id");

      if (custError) throw custError;

      // Get orders from last 30 days
      const startDate = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const { data: orders, error: ordError } = await supabase
        .from("fnb_orders")
        .select("customer_id, total_xcg, order_date")
        .gte("order_date", startDate)
        .in("status", ["delivered", "picked", "ready"]);

      if (ordError) throw ordError;

      // Calculate customer metrics
      const customerOrders: Record<string, { count: number; revenue: number; name: string; type: string }> = {};

      customers?.forEach((cust) => {
        customerOrders[cust.id] = {
          count: 0,
          revenue: 0,
          name: cust.name,
          type: cust.customer_type,
        };
      });

      orders?.forEach((order) => {
        if (order.customer_id && customerOrders[order.customer_id]) {
          customerOrders[order.customer_id].count++;
          customerOrders[order.customer_id].revenue += order.total_xcg || 0;
        }
      });

      // Top customers by revenue
      const topByRevenue = Object.entries(customerOrders)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Customer type distribution
      const typeDistribution: Record<string, number> = {};
      customers?.forEach((cust) => {
        typeDistribution[cust.customer_type] = (typeDistribution[cust.customer_type] || 0) + 1;
      });

      // Active vs inactive (ordered in last 30 days)
      const activeCustomers = new Set(orders?.map((o) => o.customer_id).filter(Boolean));

      return {
        totalCustomers: customers?.length || 0,
        activeCustomers: activeCustomers.size,
        topByRevenue,
        typeDistribution: Object.entries(typeDistribution).map(([type, count]) => ({
          type: type.charAt(0).toUpperCase() + type.slice(1),
          count,
        })),
        avgOrdersPerCustomer: activeCustomers.size > 0 
          ? Math.round((orders?.length || 0) / activeCustomers.size * 10) / 10
          : 0,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: retentionData, isLoading: retentionLoading } = useQuery({
    queryKey: ["customer-retention"],
    queryFn: async () => {
      // Get orders grouped by week
      const weeks = [];
      for (let i = 0; i < 8; i++) {
        const weekEnd = subDays(new Date(), i * 7);
        const weekStart = subDays(weekEnd, 7);
        weeks.push({
          label: format(weekStart, "MMM d"),
          start: format(weekStart, "yyyy-MM-dd"),
          end: format(weekEnd, "yyyy-MM-dd"),
        });
      }

      const weeklyData = await Promise.all(
        weeks.map(async (week) => {
          const { data: orders } = await supabase
            .from("fnb_orders")
            .select("customer_id")
            .gte("order_date", week.start)
            .lt("order_date", week.end);

          const uniqueCustomers = new Set(orders?.map((o) => o.customer_id).filter(Boolean));
          return {
            week: week.label,
            customers: uniqueCustomers.size,
          };
        })
      );

      return weeklyData.reverse();
    },
    staleTime: 10 * 60 * 1000,
  });

  const chartConfig = {
    count: { label: "Customers", color: "hsl(var(--primary))" },
    revenue: { label: "Revenue", color: "hsl(var(--secondary))" },
  };

  const typeColors = [
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
    "hsl(var(--accent))",
    "hsl(var(--muted))",
  ];

  if (statsLoading || retentionLoading) {
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
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerStats?.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Registered customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active (30d)</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerStats?.activeCustomers}</div>
            <p className="text-xs text-muted-foreground">
              {customerStats?.totalCustomers
                ? Math.round((customerStats.activeCustomers / customerStats.totalCustomers) * 100)
                : 0}% activity rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Orders/Customer</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerStats?.avgOrdersPerCustomer}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(customerStats?.totalCustomers || 0) - (customerStats?.activeCustomers || 0)}
            </div>
            <p className="text-xs text-muted-foreground">No orders in 30 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Customer Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Types</CardTitle>
            <CardDescription>Distribution by type</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <PieChart>
                <Pie
                  data={customerStats?.typeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="type"
                >
                  {customerStats?.typeDistribution.map((entry, index) => (
                    <Cell key={entry.type} fill={typeColors[index % typeColors.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {customerStats?.typeDistribution.map((entry, index) => (
                <div key={entry.type} className="flex items-center gap-1 text-xs">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: typeColors[index % typeColors.length] }}
                  />
                  <span>{entry.type}: {entry.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Active Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Active Customers</CardTitle>
            <CardDescription>Unique ordering customers per week</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <BarChart data={retentionData}>
                <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="customers" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Customers by Revenue</CardTitle>
          <CardDescription>Last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerStats?.topByRevenue.map((customer, index) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">#{index + 1}</span>
                      {customer.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {customer.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{customer.count}</TableCell>
                  <TableCell className="text-right font-medium">
                    ƒ{customer.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
              {(!customerStats?.topByRevenue || customerStats.topByRevenue.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No customer data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}