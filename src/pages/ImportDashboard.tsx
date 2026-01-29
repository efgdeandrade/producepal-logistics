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
  Calculator,
  Package,
  Plane,
  ArrowRight,
  Clock,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { MarketNewsWidget } from "@/components/import/MarketNewsWidget";

export default function ImportDashboard() {
  const navigate = useNavigate();

  // Fetch recent CIF calculations
  const { data: recentCIF } = useQuery({
    queryKey: ["recent-cif-calculations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cif_calculations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

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

  // Calculate CIF stats
  const cifStats = {
    totalCalculations: recentCIF?.length || 0,
    avgFreight:
      recentCIF && recentCIF.length > 0
        ? (
            recentCIF.reduce(
              (sum, c) => sum + (c.freight_exterior_per_kg || 0),
              0
            ) / recentCIF.length
          ).toFixed(2)
        : "0.00",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Dashboard</h1>
          <p className="text-muted-foreground">
            CIF calculations, supplier orders, and import logistics
          </p>
        </div>
        <Button onClick={() => navigate("/import/cif")}>
          <Calculator className="h-4 w-4 mr-2" />
          New CIF Calculation
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CIF Calculations</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cifStats.totalCalculations}</div>
            <p className="text-xs text-muted-foreground">recent calculations</p>
          </CardContent>
        </Card>

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
            <CardTitle className="text-sm font-medium">Avg Freight Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${cifStats.avgFreight}/kg</div>
            <p className="text-xs text-muted-foreground">exterior freight</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/import/cif")}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calculator className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">CIF Calculator</p>
                <p className="text-sm text-muted-foreground">Calculate import costs</p>
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
          onClick={() => navigate("/import/cif/history")}
        >
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">CIF History</p>
                <p className="text-sm text-muted-foreground">Past calculations</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: News + CIF History */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Market News Intelligence */}
        <MarketNewsWidget />

        {/* Recent CIF Calculations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent CIF Calculations</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/import/cif/history")}>
              View All
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentCIF && recentCIF.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Exchange Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCIF.map((calc) => (
                    <TableRow key={calc.id}>
                      <TableCell className="font-medium">
                        {calc.calculation_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{calc.calculation_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {Array.isArray(calc.products) ? calc.products.length : 0}
                      </TableCell>
                      <TableCell>
                        {format(new Date(calc.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        {calc.exchange_rate?.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No CIF calculations yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
