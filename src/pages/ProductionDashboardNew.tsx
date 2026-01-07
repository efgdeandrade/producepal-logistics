import { useQuery } from "@tanstack/react-query";
import { supabase } from "../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useNavigate } from "react-router-dom";
import {
  Factory,
  Package,
  ClipboardList,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";

export default function ProductionDashboardNew() {
  const navigate = useNavigate();
  const today = new Date();

  // Fetch today's production orders
  const { data: todayProduction } = useQuery({
    queryKey: ["production-orders-today"],
    queryFn: async () => {
      const dayStart = startOfDay(today).toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("production_orders")
        .select("id, status, order_date, notes, created_at")
        .eq("order_date", dayStart);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all production orders for summary
  const { data: allProduction } = useQuery({
    queryKey: ["production-orders-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("id, status, order_date, notes, created_at")
        .order("order_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch products for production
  const { data: products } = useQuery({
    queryKey: ["products-production"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, code, name")
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate stats
  const productionStats = {
    todayOrders: todayProduction?.length || 0,
    pending: allProduction?.filter((p) => p.status === "pending").length || 0,
    inProgress: allProduction?.filter((p) => p.status === "in_progress").length || 0,
    completed: allProduction?.filter((p) => p.status === "completed").length || 0,
  };

  const completionRate = productionStats.todayOrders > 0 
    ? Math.round(
        ((todayProduction?.filter((p) => p.status === "completed").length || 0) / 
         productionStats.todayOrders) * 100
      ) 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Production Dashboard</h1>
          <p className="text-muted-foreground">
            Production orders, scheduling, and inventory
          </p>
        </div>
        <Button onClick={() => navigate("/production/input")}>
          <Factory className="h-4 w-4 mr-2" />
          New Production Order
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Orders</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productionStats.todayOrders}</div>
            <p className="text-xs text-muted-foreground">production orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productionStats.pending}</div>
            <p className="text-xs text-muted-foreground">awaiting start</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Factory className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productionStats.inProgress}</div>
            <p className="text-xs text-muted-foreground">currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productionStats.completed}</div>
            <Progress value={completionRate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/production/input")}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Factory className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Production Input</p>
                <p className="text-sm text-muted-foreground">Create orders</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/production/dashboard")}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Production View</p>
                <p className="text-sm text-muted-foreground">Full dashboard</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/import/products")}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Products</p>
                <p className="text-sm text-muted-foreground">Manage products</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Recent Production Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Production Orders</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/production/dashboard")}>
            View All
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardHeader>
        <CardContent>
          {allProduction && allProduction.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allProduction.slice(0, 5).map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {format(new Date(order.order_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          order.status === "completed"
                            ? "default"
                            : order.status === "in_progress"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {order.notes || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {format(new Date(order.created_at), "MMM d")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No production orders yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
