import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import {
  Truck,
  MapPin,
  Users,
  Clock,
  ArrowRight,
  Route,
  Package,
  Navigation,
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";

export default function LogisticsDashboard() {
  const navigate = useNavigate();
  const today = new Date();

  // Fetch today's deliveries
  const { data: todayDeliveries } = useQuery({
    queryKey: ["deliveries-today"],
    queryFn: async () => {
      const dayStart = startOfDay(today).toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("deliveries")
        .select("id, status, delivery_date")
        .eq("delivery_date", dayStart);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch active routes
  const { data: routes } = useQuery({
    queryKey: ["routes-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select("id, route_number, status")
        .neq("status", "completed");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch drivers (profiles with driver role)
  const { data: drivers } = useQuery({
    queryKey: ["drivers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate stats
  const deliveryStats = {
    total: todayDeliveries?.length || 0,
    pending: todayDeliveries?.filter((d) => d.status === "pending").length || 0,
    inProgress: todayDeliveries?.filter((d) => d.status === "in_progress").length || 0,
    completed: todayDeliveries?.filter((d) => d.status === "completed").length || 0,
  };

  const completionRate = deliveryStats.total > 0 
    ? Math.round((deliveryStats.completed / deliveryStats.total) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logistics Dashboard</h1>
          <p className="text-muted-foreground">
            Route management, deliveries, and driver coordination
          </p>
        </div>
        <Button onClick={() => navigate("/logistics/routes")}>
          <Route className="h-4 w-4 mr-2" />
          Manage Routes
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Deliveries</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveryStats.total}</div>
            <div className="flex gap-2 mt-2">
              {deliveryStats.inProgress > 0 && (
                <Badge variant="outline">{deliveryStats.inProgress} active</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Routes</CardTitle>
            <Route className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{routes?.length || 0}</div>
            <p className="text-xs text-muted-foreground">configured routes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drivers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{drivers?.length || 0}</div>
            <p className="text-xs text-muted-foreground">team members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
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
          onClick={() => navigate("/logistics/routes")}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Route className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Routes</p>
                <p className="text-sm text-muted-foreground">Manage routes</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/logistics/deliveries")}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Deliveries</p>
                <p className="text-sm text-muted-foreground">Track deliveries</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/logistics/driver-portal")}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Navigation className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Driver Portal</p>
                <p className="text-sm text-muted-foreground">Driver view</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/logistics/schedule")}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Schedule</p>
                <p className="text-sm text-muted-foreground">Driver schedule</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Delivery Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Delivery Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-yellow-600">{deliveryStats.pending}</div>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-blue-600">{deliveryStats.inProgress}</div>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-green-600">{deliveryStats.completed}</div>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-primary/10">
              <div className="text-3xl font-bold text-primary">{routes?.length || 0}</div>
              <p className="text-sm text-muted-foreground">Active Routes</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
