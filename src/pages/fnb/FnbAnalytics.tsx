import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, TrendingUp, Package, Users, Truck, DollarSign, Calendar, Clock, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { format, subDays, startOfWeek, startOfMonth, differenceInMinutes } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

type DateRange = "7d" | "30d" | "90d";

export default function FnbAnalytics() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  const getDateRangeStart = () => {
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
    return subDays(new Date(), days).toISOString();
  };

  // Fetch all orders within date range
  const { data: orders, isLoading } = useQuery({
    queryKey: ["fnb-analytics-orders", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fnb_orders")
        .select(`
          *,
          fnb_customers (name, delivery_zone),
          fnb_order_items (quantity, total_xcg, product_id, fnb_products (name, code))
        `)
        .gte("created_at", getDateRangeStart())
        .not("status", "eq", "cancelled")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Calculate metrics
  const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_xcg || 0), 0) || 0;
  const totalOrders = orders?.length || 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const deliveredOrders = orders?.filter((o) => o.status === "delivered") || [];

  // Daily revenue chart data
  const dailyRevenue = orders?.reduce((acc: Record<string, number>, order) => {
    const date = format(new Date(order.created_at), "MMM d");
    acc[date] = (acc[date] || 0) + (order.total_xcg || 0);
    return acc;
  }, {});

  const revenueChartData = Object.entries(dailyRevenue || {}).map(([date, revenue]) => ({
    date,
    revenue: Number(revenue.toFixed(2)),
  }));

  // Top products
  const productSales = orders?.reduce((acc: Record<string, { name: string; quantity: number; revenue: number }>, order) => {
    order.fnb_order_items?.forEach((item: any) => {
      const name = item.fnb_products?.name || "Unknown";
      if (!acc[name]) acc[name] = { name, quantity: 0, revenue: 0 };
      acc[name].quantity += item.quantity || 0;
      acc[name].revenue += item.total_xcg || 0;
    });
    return acc;
  }, {});

  const topProducts = Object.values(productSales || {})
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const productChartData = topProducts.slice(0, 6).map((p) => ({
    name: p.name.length > 15 ? p.name.substring(0, 15) + "..." : p.name,
    revenue: Number(p.revenue.toFixed(2)),
  }));

  // Top customers
  const customerSales = orders?.reduce((acc: Record<string, { name: string; orders: number; revenue: number }>, order) => {
    const name = order.fnb_customers?.name || "Unknown";
    if (!acc[name]) acc[name] = { name, orders: 0, revenue: 0 };
    acc[name].orders += 1;
    acc[name].revenue += order.total_xcg || 0;
    return acc;
  }, {});

  const topCustomers = Object.values(customerSales || {})
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Zone performance
  const zoneStats = orders?.reduce((acc: Record<string, { zone: string; orders: number; revenue: number }>, order) => {
    const zone = order.fnb_customers?.delivery_zone || "Unassigned";
    if (!acc[zone]) acc[zone] = { zone, orders: 0, revenue: 0 };
    acc[zone].orders += 1;
    acc[zone].revenue += order.total_xcg || 0;
    return acc;
  }, {});

  const zoneChartData = Object.values(zoneStats || {})
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Delivery performance
  const deliveryTimes = deliveredOrders
    .filter((o) => o.assigned_at && o.delivered_at)
    .map((o) => differenceInMinutes(new Date(o.delivered_at), new Date(o.assigned_at)));

  const avgDeliveryTime = deliveryTimes.length > 0
    ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
    : 0;

  // Orders by status
  const statusCounts = orders?.reduce((acc: Record<string, number>, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  const statusChartData = Object.entries(statusCounts || {}).map(([name, value]) => ({
    name,
    value,
  }));

  // Orders by day of week
  const dayOfWeekOrders = orders?.reduce((acc: Record<string, number>, order) => {
    const day = format(new Date(order.created_at), "EEE");
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});

  const daysOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayOfWeekChartData = daysOrder.map((day) => ({
    day,
    orders: dayOfWeekOrders?.[day] || 0,
  }));

  // Driver performance metrics
  const driverStats = orders?.reduce((acc: Record<string, {
    name: string;
    deliveries: number;
    totalDeliveryTime: number;
    deliveriesWithTime: number;
    codDue: number;
    codCollected: number;
  }>, order) => {
    const driverName = order.driver_name || "Unassigned";
    if (!acc[driverName]) {
      acc[driverName] = {
        name: driverName,
        deliveries: 0,
        totalDeliveryTime: 0,
        deliveriesWithTime: 0,
        codDue: 0,
        codCollected: 0,
      };
    }
    
    if (order.status === "delivered") {
      acc[driverName].deliveries += 1;
      
      if (order.assigned_at && order.delivered_at) {
        const deliveryTime = differenceInMinutes(new Date(order.delivered_at), new Date(order.assigned_at));
        if (deliveryTime > 0 && deliveryTime < 480) { // Filter out unrealistic times (> 8 hours)
          acc[driverName].totalDeliveryTime += deliveryTime;
          acc[driverName].deliveriesWithTime += 1;
        }
      }
    }
    
    if (order.cod_amount_due && order.cod_amount_due > 0) {
      acc[driverName].codDue += order.cod_amount_due;
      acc[driverName].codCollected += order.cod_amount_collected || 0;
    }
    
    return acc;
  }, {});

  const driverPerformance = Object.values(driverStats || {})
    .filter(d => d.name !== "Unassigned")
    .map(d => ({
      name: d.name,
      deliveries: d.deliveries,
      avgDeliveryTime: d.deliveriesWithTime > 0 ? Math.round(d.totalDeliveryTime / d.deliveriesWithTime) : 0,
      codCollectionRate: d.codDue > 0 ? Math.round((d.codCollected / d.codDue) * 100) : 0,
      codCollected: d.codCollected,
      codDue: d.codDue,
    }))
    .sort((a, b) => b.deliveries - a.deliveries);

  const driverDeliveriesChartData = driverPerformance.slice(0, 8).map(d => ({
    name: d.name.length > 12 ? d.name.substring(0, 12) + "..." : d.name,
    deliveries: d.deliveries,
  }));

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
            <h1 className="text-3xl font-bold tracking-tight">F&B Analytics</h1>
            <p className="text-muted-foreground">Sales performance and insights</p>
          </div>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-center py-12 text-muted-foreground">Loading analytics...</p>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalRevenue.toFixed(2)} XCG</div>
                  <p className="text-xs text-muted-foreground">{totalOrders} orders</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgOrderValue.toFixed(2)} XCG</div>
                  <p className="text-xs text-muted-foreground">per order</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Delivered</CardTitle>
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{deliveredOrders.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalOrders > 0 ? ((deliveredOrders.length / totalOrders) * 100).toFixed(0) : 0}% completion
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Delivery Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgDeliveryTime} min</div>
                  <p className="text-xs text-muted-foreground">from assignment</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 1 */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Revenue Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Revenue Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {revenueChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={revenueChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center py-12 text-muted-foreground">No data</p>
                  )}
                </CardContent>
              </Card>

              {/* Top Products */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Top Products
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {productChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={productChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                          }}
                        />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center py-12 text-muted-foreground">No data</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Zone Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Revenue by Zone
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {zoneChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={zoneChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="revenue"
                          nameKey="zone"
                          label={({ zone }) => zone.length > 10 ? zone.substring(0, 10) + "..." : zone}
                        >
                          {zoneChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center py-12 text-muted-foreground">No data</p>
                  )}
                </CardContent>
              </Card>

              {/* Order Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Order Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statusChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                          label={({ name }) => name}
                        >
                          {statusChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center py-12 text-muted-foreground">No data</p>
                  )}
                </CardContent>
              </Card>

              {/* Orders by Day */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Orders by Day
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dayOfWeekChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                        }}
                      />
                      <Bar dataKey="orders" fill="hsl(var(--primary))" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Driver Performance Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Driver Performance
              </h2>
              
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Deliveries per Driver Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Deliveries per Driver</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {driverDeliveriesChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={driverDeliveriesChartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                            }}
                          />
                          <Bar dataKey="deliveries" fill="hsl(var(--primary))" radius={4} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center py-12 text-muted-foreground">No driver data</p>
                    )}
                  </CardContent>
                </Card>

                {/* Driver Performance Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Performance Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {driverPerformance.length > 0 ? (
                        driverPerformance.map((driver, index) => (
                          <div key={driver.name} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{driver.name}</p>
                                <p className="text-xs text-muted-foreground">{driver.deliveries} deliveries</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-right">
                              <div>
                                <p className="text-sm font-medium">{driver.avgDeliveryTime} min</p>
                                <p className="text-xs text-muted-foreground">avg time</p>
                              </div>
                              <Badge 
                                variant={driver.codCollectionRate >= 90 ? "default" : driver.codCollectionRate >= 70 ? "secondary" : "destructive"}
                              >
                                {driver.codCollectionRate}% COD
                              </Badge>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center py-4 text-muted-foreground">No driver data</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Tables Row */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Top Customers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Top Customers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topCustomers.length > 0 ? (
                      topCustomers.map((customer, index) => (
                        <div key={customer.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{customer.name}</p>
                              <p className="text-xs text-muted-foreground">{customer.orders} orders</p>
                            </div>
                          </div>
                          <Badge variant="secondary">{customer.revenue.toFixed(2)} XCG</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-4 text-muted-foreground">No data</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Top Products Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Product Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topProducts.length > 0 ? (
                      topProducts.map((product, index) => (
                        <div key={product.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{product.quantity} units sold</p>
                            </div>
                          </div>
                          <Badge variant="secondary">{product.revenue.toFixed(2)} XCG</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-4 text-muted-foreground">No data</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
