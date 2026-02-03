import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import {
  Package,
  Plane,
  ArrowRight,
  Clock,
  ShoppingCart,
} from "lucide-react";
import { format } from "date-fns";
import { MarketNewsWidget } from "@/components/import/MarketNewsWidget";

export default function ImportDashboard() {
  const navigate = useNavigate();

  // Fetch active orders in transit
  const { data: ordersInTransit } = useQuery({
    queryKey: ["orders-in-transit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .in("status", ["in_transit", "processing"])
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch recent orders
  const { data: recentOrders } = useQuery({
    queryKey: ["recent-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch supplier summary
  const { data: suppliers } = useQuery({
    queryKey: ["supplier-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, country")
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Dashboard</h1>
          <p className="text-muted-foreground">
            Supplier orders, shipments, and import logistics
          </p>
        </div>
        <Button onClick={() => navigate("/import/orders/new")}>
          <ShoppingCart className="h-4 w-4 mr-2" />
          New Order
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ordersInTransit?.length || 0}</div>
            <p className="text-xs text-muted-foreground">active shipments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers?.length || 0}</div>
            <p className="text-xs text-muted-foreground">in database</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentOrders?.length || 0}</div>
            <p className="text-xs text-muted-foreground">this week</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/import/orders")}
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
          onClick={() => navigate("/import/suppliers")}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Suppliers</p>
                <p className="text-sm text-muted-foreground">Manage suppliers</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/import/shipments")}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Plane className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Shipments</p>
                <p className="text-sm text-muted-foreground">Track shipments</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: News + Recent Orders */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Market News Intelligence */}
        <MarketNewsWidget />

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Orders</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/import/orders")}>
              View All
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders && recentOrders.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Week</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => (
                    <TableRow 
                      key={order.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/import/orders/${order.id}`)}
                    >
                      <TableCell className="font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell>Week {order.week_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{order.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(order.created_at), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No orders yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}