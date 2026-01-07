import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../ui/chart";
import { BarChart, Bar, XAxis, YAxis, LineChart, Line } from "recharts";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { Package, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { format, subDays } from "date-fns";

export function ProductAnalytics() {
  const { data: productStats, isLoading: statsLoading } = useQuery({
    queryKey: ["product-analytics"],
    queryFn: async () => {
      // Get all products
      const { data: products, error: prodError } = await supabase
        .from("fnb_products")
        .select("id, code, name, price_xcg, is_active");

      if (prodError) throw prodError;

      // Get order items from last 30 days
      const startDate = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const { data: orderItems, error: itemError } = await supabase
        .from("fnb_order_items")
        .select(`
          product_id,
          quantity,
          total_xcg,
          picked_quantity,
          short_quantity,
          fnb_orders!inner(order_date, status)
        `)
        .gte("fnb_orders.order_date", startDate);

      if (itemError) throw itemError;

      // Calculate product metrics
      const productMetrics: Record<string, {
        code: string;
        name: string;
        quantity: number;
        revenue: number;
        orders: number;
        shortages: number;
      }> = {};

      products?.forEach((prod) => {
        productMetrics[prod.id] = {
          code: prod.code,
          name: prod.name,
          quantity: 0,
          revenue: 0,
          orders: 0,
          shortages: 0,
        };
      });

      orderItems?.forEach((item) => {
        if (item.product_id && productMetrics[item.product_id]) {
          productMetrics[item.product_id].quantity += item.quantity || 0;
          productMetrics[item.product_id].revenue += item.total_xcg || 0;
          productMetrics[item.product_id].orders++;
          productMetrics[item.product_id].shortages += item.short_quantity || 0;
        }
      });

      // Top products by quantity
      const topByQuantity = Object.entries(productMetrics)
        .map(([id, data]) => ({ id, ...data }))
        .filter((p) => p.quantity > 0)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      // Top products by revenue
      const topByRevenue = Object.entries(productMetrics)
        .map(([id, data]) => ({ id, ...data }))
        .filter((p) => p.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Products with shortages
      const withShortages = Object.entries(productMetrics)
        .map(([id, data]) => ({ id, ...data }))
        .filter((p) => p.shortages > 0)
        .sort((a, b) => b.shortages - a.shortages)
        .slice(0, 5);

      return {
        totalProducts: products?.length || 0,
        activeProducts: products?.filter((p) => p.is_active).length || 0,
        productsOrdered: Object.values(productMetrics).filter((p) => p.orders > 0).length,
        topByQuantity,
        topByRevenue,
        withShortages,
        totalRevenue: Object.values(productMetrics).reduce((sum, p) => sum + p.revenue, 0),
        totalUnits: Object.values(productMetrics).reduce((sum, p) => sum + p.quantity, 0),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ["product-trends"],
    queryFn: async () => {
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const date = format(subDays(new Date(), i), "yyyy-MM-dd");
        days.push(date);
      }

      const dailyData = await Promise.all(
        days.map(async (date) => {
          const { data: items } = await supabase
            .from("fnb_order_items")
            .select("quantity, total_xcg, fnb_orders!inner(order_date)")
            .eq("fnb_orders.order_date", date);

          return {
            date: format(new Date(date), "MMM d"),
            units: items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0,
            revenue: items?.reduce((sum, i) => sum + (i.total_xcg || 0), 0) || 0,
          };
        })
      );

      return dailyData;
    },
    staleTime: 5 * 60 * 1000,
  });

  const chartConfig = {
    units: { label: "Units", color: "hsl(var(--primary))" },
    revenue: { label: "Revenue", color: "hsl(var(--secondary))" },
    quantity: { label: "Quantity", color: "hsl(var(--primary))" },
  };

  if (statsLoading || trendLoading) {
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
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productStats?.totalProducts}</div>
            <p className="text-xs text-muted-foreground">{productStats?.activeProducts} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products Ordered</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productStats?.productsOrdered}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Units Sold</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productStats?.totalUnits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Product Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ƒ{productStats?.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Trend (14 Days)</CardTitle>
          <CardDescription>Daily units and revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px]">
            <LineChart data={trendData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `ƒ${v}`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line yAxisId="left" type="monotone" dataKey="units" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="hsl(var(--secondary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Products by Quantity */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products by Volume</CardTitle>
            <CardDescription>Units sold (30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <BarChart data={productStats?.topByQuantity.slice(0, 5)} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="code" type="category" tick={{ fontSize: 10 }} width={60} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Shortage Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Products with Shortages
            </CardTitle>
            <CardDescription>Items frequently short (30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Shortages</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productStats?.withShortages.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="font-medium">{product.code}</div>
                      <div className="text-xs text-muted-foreground">{product.name}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive">{product.shortages}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{product.orders}</TableCell>
                  </TableRow>
                ))}
                {(!productStats?.withShortages || productStats.withShortages.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No shortages reported
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Full Product Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Products by Revenue</CardTitle>
          <CardDescription>Last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productStats?.topByRevenue.map((product, index) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">#{index + 1}</span>
                      <div>
                        <div className="font-medium">{product.code}</div>
                        <div className="text-xs text-muted-foreground">{product.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{product.orders}</TableCell>
                  <TableCell className="text-right">{product.quantity}</TableCell>
                  <TableCell className="text-right font-medium">
                    ƒ{product.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}