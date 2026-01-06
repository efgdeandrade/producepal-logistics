import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Clock, Truck, CheckCircle, AlertTriangle, Timer, Users } from "lucide-react";
import { format, subDays, differenceInMinutes } from "date-fns";

export function OperationalMetrics() {
  const { data: deliveryMetrics, isLoading: deliveryLoading } = useQuery({
    queryKey: ["delivery-metrics"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      
      // Get today's orders with status
      const { data: orders, error } = await supabase
        .from("fnb_orders")
        .select("id, status, created_at, delivered_at, driver_name")
        .eq("delivery_date", today);

      if (error) throw error;

      const statusCounts = {
        pending: 0,
        picked: 0,
        ready: 0,
        delivered: 0,
        cancelled: 0,
      };

      let totalDeliveryTime = 0;
      let deliveredCount = 0;

      orders?.forEach((order) => {
        const status = order.status as keyof typeof statusCounts;
        if (statusCounts[status] !== undefined) {
          statusCounts[status]++;
        }

        if (order.delivered_at && order.created_at) {
          const created = new Date(order.created_at);
          const delivered = new Date(order.delivered_at);
          totalDeliveryTime += differenceInMinutes(delivered, created);
          deliveredCount++;
        }
      });

      const avgDeliveryTime = deliveredCount > 0 ? Math.round(totalDeliveryTime / deliveredCount) : 0;

      return {
        total: orders?.length || 0,
        ...statusCounts,
        avgDeliveryTimeMinutes: avgDeliveryTime,
        completionRate: orders?.length ? Math.round((statusCounts.delivered / orders.length) * 100) : 0,
      };
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: pickerMetrics, isLoading: pickerLoading } = useQuery({
    queryKey: ["picker-metrics"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");

      const { data: pickerQueue, error } = await supabase
        .from("fnb_picker_queue")
        .select("picker_name, status, claimed_at, completed_at")
        .gte("created_at", `${today}T00:00:00`);

      if (error) throw error;

      const pickerStats: Record<string, { completed: number; avgTime: number; totalTime: number }> = {};

      pickerQueue?.forEach((item) => {
        if (!item.picker_name) return;
        
        if (!pickerStats[item.picker_name]) {
          pickerStats[item.picker_name] = { completed: 0, avgTime: 0, totalTime: 0 };
        }

        if (item.status === "completed" && item.claimed_at && item.completed_at) {
          pickerStats[item.picker_name].completed++;
          const time = differenceInMinutes(new Date(item.completed_at), new Date(item.claimed_at));
          pickerStats[item.picker_name].totalTime += time;
        }
      });

      return Object.entries(pickerStats).map(([name, stats]) => ({
        name,
        completed: stats.completed,
        avgTime: stats.completed > 0 ? Math.round(stats.totalTime / stats.completed) : 0,
      })).sort((a, b) => b.completed - a.completed);
    },
    staleTime: 60 * 1000,
  });

  const { data: driverMetrics, isLoading: driverLoading } = useQuery({
    queryKey: ["driver-metrics"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");

      const { data: orders, error } = await supabase
        .from("fnb_orders")
        .select("driver_name, status, cod_amount_collected")
        .eq("delivery_date", today)
        .not("driver_name", "is", null);

      if (error) throw error;

      const driverStats: Record<string, { delivered: number; pending: number; cod: number }> = {};

      orders?.forEach((order) => {
        if (!order.driver_name) return;

        if (!driverStats[order.driver_name]) {
          driverStats[order.driver_name] = { delivered: 0, pending: 0, cod: 0 };
        }

        if (order.status === "delivered") {
          driverStats[order.driver_name].delivered++;
          driverStats[order.driver_name].cod += order.cod_amount_collected || 0;
        } else if (order.status !== "cancelled") {
          driverStats[order.driver_name].pending++;
        }
      });

      return Object.entries(driverStats).map(([name, stats]) => ({
        name,
        ...stats,
      })).sort((a, b) => b.delivered - a.delivered);
    },
    staleTime: 60 * 1000,
  });

  const chartConfig = {
    pending: { label: "Pending", color: "hsl(var(--muted))" },
    picked: { label: "Picked", color: "hsl(var(--primary))" },
    ready: { label: "Ready", color: "hsl(var(--secondary))" },
    delivered: { label: "Delivered", color: "hsl(142, 76%, 36%)" },
    cancelled: { label: "Cancelled", color: "hsl(var(--destructive))" },
  };

  const statusColors = [
    "hsl(var(--muted))",
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
    "hsl(142, 76%, 36%)",
    "hsl(var(--destructive))",
  ];

  if (deliveryLoading || pickerLoading || driverLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[150px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statusData = [
    { name: "Pending", value: deliveryMetrics?.pending || 0 },
    { name: "Picked", value: deliveryMetrics?.picked || 0 },
    { name: "Ready", value: deliveryMetrics?.ready || 0 },
    { name: "Delivered", value: deliveryMetrics?.delivered || 0 },
    { name: "Cancelled", value: deliveryMetrics?.cancelled || 0 },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Orders</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveryMetrics?.total || 0}</div>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary">{deliveryMetrics?.delivered} delivered</Badge>
              <Badge variant="outline">{deliveryMetrics?.pending} pending</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveryMetrics?.completionRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Of today's orders delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Delivery Time</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveryMetrics?.avgDeliveryTimeMinutes || 0} min</div>
            <p className="text-xs text-muted-foreground">Order to delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{driverMetrics?.length || 0}</div>
            <p className="text-xs text-muted-foreground">With deliveries today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Order Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
            <CardDescription>Today's distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={entry.name} fill={statusColors[index % statusColors.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {statusData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1 text-xs">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: statusColors[index % statusColors.length] }}
                  />
                  <span>{entry.name}: {entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Picker Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Picker Performance</CardTitle>
            <CardDescription>Orders completed today</CardDescription>
          </CardHeader>
          <CardContent>
            {pickerMetrics && pickerMetrics.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[200px]">
                <BarChart data={pickerMetrics.slice(0, 5)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No picker data today
              </div>
            )}
          </CardContent>
        </Card>

        {/* Driver Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Driver Deliveries</CardTitle>
            <CardDescription>Completed today</CardDescription>
          </CardHeader>
          <CardContent>
            {driverMetrics && driverMetrics.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[200px]">
                <BarChart data={driverMetrics.slice(0, 5)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="delivered" fill="hsl(142, 76%, 36%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No driver data today
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
