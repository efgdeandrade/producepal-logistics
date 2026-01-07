import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { DriverOverviewCards } from "./DriverOverviewCards";
import { DriverPerformanceTable, type DriverPerformance } from "./DriverPerformanceTable";
import { DriverPerformanceCharts } from "./DriverPerformanceCharts";
import { DriverLeaderboard } from "./DriverLeaderboard";

export function DriverAdminDashboard() {
  const [dateRange, setDateRange] = useState("7");
  
  // Fetch all drivers with their roles
  const { data: drivers, isLoading: driversLoading } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: async () => {
      // Get users with driver role
      const { data: driverRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "driver");
      
      if (rolesError) throw rolesError;
      
      if (!driverRoles?.length) return [];
      
      const driverIds = driverRoles.map(r => r.user_id);
      
      // Get profiles for these drivers
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", driverIds);
      
      if (profilesError) throw profilesError;
      return profiles || [];
    },
  });

  // Fetch today's orders for all drivers
  const { data: todayOrders, isLoading: ordersLoading, refetch } = useQuery({
    queryKey: ["admin-driver-orders-today"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("fnb_orders")
        .select(`
          id,
          order_number,
          status,
          driver_id,
          driver_name,
          total_xcg,
          cod_amount_collected,
          payment_method_used,
          assigned_at,
          delivered_at,
          delivery_date,
          fnb_customers (name, customer_type)
        `)
        .gte("delivery_date", today)
        .not("driver_id", "is", null);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch historical data for charts
  const { data: historicalOrders, isLoading: historyLoading } = useQuery({
    queryKey: ["admin-driver-orders-history", dateRange],
    queryFn: async () => {
      const startDate = format(subDays(new Date(), parseInt(dateRange)), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("fnb_orders")
        .select(`
          id,
          status,
          driver_id,
          driver_name,
          total_xcg,
          cod_amount_collected,
          payment_method_used,
          assigned_at,
          delivered_at,
          delivery_date
        `)
        .gte("delivery_date", startDate)
        .eq("status", "delivered");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate overview stats
  const stats = {
    activeDrivers: new Set(todayOrders?.filter(o => o.status === "out_for_delivery").map(o => o.driver_id)).size,
    totalDeliveries: todayOrders?.filter(o => o.status === "delivered").length || 0,
    pendingDeliveries: todayOrders?.filter(o => o.status === "out_for_delivery").length || 0,
    avgDeliveryTime: calculateAvgDeliveryTime(todayOrders || []),
    totalCodCollected: todayOrders?.reduce((sum, o) => sum + (o.cod_amount_collected || 0), 0) || 0,
    onTimeRate: 95, // Placeholder - would need scheduled times to calculate
  };

  // Calculate driver performance
  const driverPerformance: DriverPerformance[] = (drivers || []).map(driver => {
    const driverOrders = todayOrders?.filter(o => o.driver_id === driver.id) || [];
    const completedOrders = driverOrders.filter(o => o.status === "delivered");
    const pendingOrders = driverOrders.filter(o => o.status === "out_for_delivery");
    
    const avgTime = calculateAvgDeliveryTime(driverOrders);
    const codCollected = completedOrders.reduce((sum, o) => sum + (o.cod_amount_collected || 0), 0);
    
    // Calculate efficiency score (weighted: 40% completion, 30% speed, 30% COD)
    const completionRate = driverOrders.length > 0 ? (completedOrders.length / driverOrders.length) * 100 : 0;
    const speedScore = avgTime <= 10 ? 100 : avgTime <= 15 ? 80 : avgTime <= 20 ? 60 : 40;
    const efficiency = Math.round(completionRate * 0.4 + speedScore * 0.3 + (codCollected > 0 ? 100 : 50) * 0.3);
    
    let status: "active" | "idle" | "completed" = "idle";
    if (pendingOrders.length > 0) status = "active";
    else if (completedOrders.length > 0) status = "completed";
    
    return {
      driverId: driver.id,
      driverName: driver.full_name || "Unknown",
      driverEmail: driver.email,
      routesToday: 1, // Simplified - would need route data
      stopsCompleted: completedOrders.length,
      totalStops: driverOrders.length,
      avgTimePerStop: avgTime,
      codCollected,
      efficiencyScore: efficiency || 0,
      status,
    };
  }).sort((a, b) => b.efficiencyScore - a.efficiencyScore);

  // Prepare chart data
  const dailyData = prepareDailyData(historicalOrders || [], parseInt(dateRange));
  const driverComparison = driverPerformance.slice(0, 5).map(d => ({
    name: d.driverName.split(" ")[0],
    deliveries: d.stopsCompleted,
    efficiency: d.efficiencyScore,
  }));
  const paymentMethods = preparePaymentMethodData(todayOrders || []);

  // Prepare leaderboard data
  const sortedByDeliveries = [...driverPerformance].sort((a, b) => b.stopsCompleted - a.stopsCompleted);
  const sortedByCod = [...driverPerformance].sort((a, b) => b.codCollected - a.codCollected);
  const sortedBySpeed = [...driverPerformance]
    .filter(d => d.avgTimePerStop > 0)
    .sort((a, b) => a.avgTimePerStop - b.avgTimePerStop);

  const topDeliveries = sortedByDeliveries.slice(0, 3).map((d, i) => ({
    driverName: d.driverName,
    value: d.stopsCompleted,
    rank: i + 1,
  }));

  const topCod = sortedByCod.slice(0, 3).map((d, i) => ({
    driverName: d.driverName,
    value: d.codCollected.toFixed(2),
    rank: i + 1,
  }));

  const fastestDrivers = sortedBySpeed.slice(0, 3).map((d, i) => ({
    driverName: d.driverName,
    value: d.avgTimePerStop,
    rank: i + 1,
  }));

  const isLoading = driversLoading || ordersLoading;

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Driver Dashboard</h2>
          <p className="text-muted-foreground">Real-time driver performance and delivery metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <DriverOverviewCards stats={stats} isLoading={isLoading} />

      {/* Driver Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Driver Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <DriverPerformanceTable drivers={driverPerformance} isLoading={isLoading} />
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Today's Leaderboard</h3>
        <DriverLeaderboard
          topDeliveries={topDeliveries}
          topCod={topCod}
          fastestDrivers={fastestDrivers}
          isLoading={isLoading}
        />
      </div>

      {/* Charts */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Performance Analytics</h3>
        <DriverPerformanceCharts
          dailyData={dailyData}
          driverComparison={driverComparison}
          paymentMethods={paymentMethods}
          isLoading={historyLoading}
        />
      </div>
    </div>
  );
}

// Helper functions
function calculateAvgDeliveryTime(orders: any[]): number {
  const completedWithTimes = orders.filter(o => o.assigned_at && o.delivered_at);
  if (completedWithTimes.length === 0) return 0;
  
  const totalMinutes = completedWithTimes.reduce((sum, o) => {
    const assigned = new Date(o.assigned_at).getTime();
    const delivered = new Date(o.delivered_at).getTime();
    return sum + (delivered - assigned) / 1000 / 60;
  }, 0);
  
  return Math.round(totalMinutes / completedWithTimes.length);
}

function prepareDailyData(orders: any[], days: number) {
  const data: { date: string; deliveries: number; cod: number }[] = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOrders = orders.filter(o => o.delivery_date === dateStr);
    
    data.push({
      date: format(date, "MM/dd"),
      deliveries: dayOrders.length,
      cod: dayOrders.reduce((sum, o) => sum + (o.cod_amount_collected || 0), 0),
    });
  }
  
  return data;
}

function preparePaymentMethodData(orders: any[]) {
  const methodCounts: Record<string, number> = {};
  
  orders.forEach(o => {
    if (o.status === "delivered" && o.payment_method_used) {
      methodCounts[o.payment_method_used] = (methodCounts[o.payment_method_used] || 0) + 1;
    }
  });
  
  return Object.entries(methodCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));
}
