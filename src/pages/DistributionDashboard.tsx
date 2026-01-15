import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  Users,
  DollarSign,
  ArrowRight,
  ClipboardList,
  TrendingUp,
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { FnbAlertsCard } from "@/components/fnb/FnbAlertsCard";

export default function DistributionDashboard() {
  const navigate = useNavigate();
  const today = new Date();

  // Fetch today's FnB orders
  const { data: todayOrders } = useQuery({
    queryKey: ["fnb-orders-today"],
    queryFn: async () => {
      const dayStart = startOfDay(today).toISOString();
      const dayEnd = endOfDay(today).toISOString();
      
      const { data, error } = await supabase
        .from("distribution_orders")
        .select("*, distribution_customers(name)")
        .gte("delivery_date", dayStart.split("T")[0])
        .lte("delivery_date", dayEnd.split("T")[0]);
      if (error) throw error;
      return data as any[] || [];
    },
  });

  // Fetch picker queue
  const { data: pickerQueue } = useQuery({
    queryKey: ["picker-queue-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distribution_picker_queue")
        .select("*")
        .in("status", ["pending", "in_progress"]);
      if (error) throw error;
      return data as any[] || [];
    },
  });

  // Calculate stats
  const orderStats = {
    total: todayOrders?.length || 0,
    pending: todayOrders?.filter((o: any) => o.status === "pending").length || 0,
    picking: todayOrders?.filter((o: any) => o.status === "picking").length || 0,
    ready: todayOrders?.filter((o: any) => o.status === "ready").length || 0,
    delivered: todayOrders?.filter((o: any) => o.status === "delivered").length || 0,
    totalValue: todayOrders?.reduce((sum: number, o: any) => sum + (o.total_xcg || 0), 0) || 0,
    codCollected: todayOrders
      ?.filter((o: any) => o.cod_amount_collected)
      .reduce((sum: number, o: any) => sum + (o.cod_amount_collected || 0), 0) || 0,
  };

  const completionRate = orderStats.total > 0 
    ? Math.round((orderStats.delivered / orderStats.total) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Distribution Dashboard</h1>
          <p className="text-muted-foreground">
            Orders, picking, and delivery management
          </p>
        </div>
        <Button onClick={() => navigate("/distribution/orders/new")}>
          <ShoppingCart className="h-4 w-4 mr-2" />
          New Order
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderStats.total}</div>
            <div className="flex gap-2 mt-2">
              {orderStats.pending > 0 && (
                <Badge variant="secondary">{orderStats.pending} pending</Badge>
              )}
              {orderStats.picking > 0 && (
                <Badge variant="outline">{orderStats.picking} picking</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Picker Queue</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pickerQueue?.length || 0}</div>
            <p className="text-xs text-muted-foreground">orders waiting</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">COD Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${orderStats.codCollected.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate}%</div>
            <Progress value={completionRate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/distribution/orders")}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Orders</p>
                <p className="text-sm text-muted-foreground">View all orders</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/distribution/picker")}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Picker Station</p>
                <p className="text-sm text-muted-foreground">Pick orders</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/distribution/customers")}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Customers</p>
                <p className="text-sm text-muted-foreground">Manage customers</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/distribution/cod")}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">COD</p>
                <p className="text-sm text-muted-foreground">Reconciliation</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Alerts and Order Status */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Operational Alerts */}
        <FnbAlertsCard compact={true} />

        {/* Order Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Order Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-5">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-yellow-600">{orderStats.pending}</div>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-blue-600">{orderStats.picking}</div>
                <p className="text-xs text-muted-foreground">Picking</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-purple-600">{orderStats.ready}</div>
                <p className="text-xs text-muted-foreground">Ready</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-green-600">{orderStats.delivered}</div>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-primary/10">
                <div className="text-2xl font-bold text-primary">
                  ${orderStats.totalValue.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
