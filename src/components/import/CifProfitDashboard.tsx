import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  Store,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { formatUSD, formatXCG } from "@/lib/cifEngine";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#f59e0b", "#10b981", "#6366f1", "#ec4899"];

export function CifProfitDashboard() {
  // Fetch final actual CIF versions
  const { data: finalVersions } = useQuery({
    queryKey: ["cif-profit-finals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cif_versions")
        .select("*, cif_allocations(*), cif_pricing_suggestions(*)")
        .eq("is_final", true)
        .eq("version_type", "actual")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const profitData = useMemo(() => {
    if (!finalVersions || finalVersions.length === 0) return null;

    let totalLandedUsd = 0;
    let totalWholesaleRevenue = 0;
    let totalRetailRevenue = 0;
    const orderProfits: Array<{
      orderId: string;
      landed: number;
      wholesaleRev: number;
      retailRev: number;
      profit: number;
      margin: number;
    }> = [];

    for (const v of finalVersions) {
      const allocs = (v.cif_allocations as any[]) || [];
      const pricing = (v.cif_pricing_suggestions as any[]) || [];
      const totals = v.totals_json as any;
      const landedUsd = totals?.total_landed_usd || allocs.reduce((s: number, a: any) => s + (a.landed_total_usd || 0), 0);
      totalLandedUsd += landedUsd;

      // Estimate revenue from pricing (assume 60% wholesale, 40% retail split)
      let orderWholesale = 0;
      let orderRetail = 0;
      for (const p of pricing) {
        const cases = allocs.find((a: any) => a.product_code === p.product_code)?.qty_cases || 0;
        orderWholesale += (p.wholesale_price_per_case_usd || 0) * cases * 0.6;
        orderRetail += (p.retail_price_per_case_usd || 0) * cases * 0.4;
      }
      totalWholesaleRevenue += orderWholesale;
      totalRetailRevenue += orderRetail;

      const totalRev = orderWholesale + orderRetail;
      const profit = totalRev - landedUsd;
      orderProfits.push({
        orderId: v.import_order_id?.slice(0, 8) || "Calc",
        landed: landedUsd,
        wholesaleRev: orderWholesale,
        retailRev: orderRetail,
        profit,
        margin: totalRev > 0 ? (profit / totalRev) * 100 : 0,
      });
    }

    const totalRevenue = totalWholesaleRevenue + totalRetailRevenue;
    const totalProfit = totalRevenue - totalLandedUsd;
    const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      totalLandedUsd,
      totalRevenue,
      totalProfit,
      overallMargin,
      totalWholesaleRevenue,
      totalRetailRevenue,
      orderProfits,
      channelSplit: [
        { name: "Wholesale", value: totalWholesaleRevenue },
        { name: "Retail", value: totalRetailRevenue },
      ],
    };
  }, [finalVersions]);

  if (!profitData) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No finalized actual CIF versions yet. Profit reporting requires at least one FINAL actual CIF.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Landed Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUSD(profitData.totalLandedUsd)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Est. Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUSD(profitData.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Est. Profit</CardTitle>
            {profitData.totalProfit >= 0 ? (
              <ArrowUpRight className="h-4 w-4 text-green-600" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profitData.totalProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatUSD(profitData.totalProfit)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blended Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profitData.overallMargin.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Channel Split */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Revenue by Channel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie
                    data={profitData.channelSplit}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                  >
                    {profitData.channelSplit.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatUSD(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  <span className="text-sm">Wholesale: {formatUSD(profitData.totalWholesaleRevenue)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  <span className="text-sm">Retail: {formatUSD(profitData.totalRetailRevenue)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profit per Order */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Profit per Order</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={profitData.orderProfits.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="orderId" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(v: number) => formatUSD(v)} />
                <Bar dataKey="profit" name="Profit" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Order Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Order Profit Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Landed</TableHead>
                <TableHead className="text-right">Wholesale Rev</TableHead>
                <TableHead className="text-right">Retail Rev</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profitData.orderProfits.map((op, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-sm">{op.orderId}</TableCell>
                  <TableCell className="text-right text-sm">{formatUSD(op.landed)}</TableCell>
                  <TableCell className="text-right text-sm">{formatUSD(op.wholesaleRev)}</TableCell>
                  <TableCell className="text-right text-sm">{formatUSD(op.retailRev)}</TableCell>
                  <TableCell className={`text-right text-sm font-medium ${op.profit >= 0 ? "text-green-600" : "text-destructive"}`}>
                    {formatUSD(op.profit)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <Badge variant={op.margin >= 20 ? "default" : "destructive"} className="text-xs">
                      {op.margin.toFixed(1)}%
                    </Badge>
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
