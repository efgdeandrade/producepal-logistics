import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { formatUSD, formatXCG } from "@/lib/cifEngine";
import { CifProfitDashboard } from "@/components/import/CifProfitDashboard";

export default function ImportCIFReports() {
  // Fetch all CIF versions with allocations
  const { data: cifVersions } = useQuery({
    queryKey: ["cif-reports-versions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cif_versions")
        .select("*, cif_allocations(*), cif_components(*)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Fetch variances
  const { data: variances } = useQuery({
    queryKey: ["cif-reports-variances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cif_variances")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Compute stats
  const stats = useMemo(() => {
    if (!cifVersions) return { estimates: 0, actuals: 0, finals: 0, totalLanded: 0 };
    return {
      estimates: cifVersions.filter(v => v.version_type === "estimate").length,
      actuals: cifVersions.filter(v => v.version_type === "actual").length,
      finals: cifVersions.filter(v => v.is_final).length,
      totalLanded: cifVersions.reduce((sum, v) => {
        const totals = v.totals_json as any;
        return sum + (totals?.total_landed_usd || 0);
      }, 0),
    };
  }, [cifVersions]);

  // Variance chart data
  const varianceChartData = useMemo(() => {
    if (!variances) return [];
    return variances.slice(0, 10).map(v => {
      const vj = v.variance_json as any;
      return {
        order: v.import_order_id?.slice(0, 6) || "—",
        estimate: vj?.estimate_total_usd || 0,
        actual: vj?.actual_total_usd || 0,
        variance: vj?.variance_usd || 0,
      };
    });
  }, [variances]);

  // Component breakdown across versions
  const componentBreakdown = useMemo(() => {
    if (!cifVersions) return [];
    const breakdown: Record<string, { total: number; count: number }> = {};
    cifVersions.forEach(v => {
      const components = v.cif_components as any[];
      components?.forEach((c: any) => {
        const type = c.component_type || "other";
        if (!breakdown[type]) breakdown[type] = { total: 0, count: 0 };
        breakdown[type].total += c.amount_usd || 0;
        breakdown[type].count += 1;
      });
    });
    return Object.entries(breakdown)
      .map(([name, { total, count }]) => ({ name, total, avg: total / count }))
      .sort((a, b) => b.total - a.total);
  }, [cifVersions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-8 w-8" />
          CIF Reports
        </h1>
        <p className="text-muted-foreground">
          Landed cost analysis, variance tracking, and profit reporting
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimates</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.estimates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actuals</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.actuals}</div>
            <p className="text-xs text-muted-foreground">{stats.finals} finalized</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Landed (USD)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUSD(stats.totalLanded)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variances Tracked</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{variances?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="profit">
        <TabsList>
          <TabsTrigger value="profit">Profit</TabsTrigger>
          <TabsTrigger value="variance">Estimate vs Actual</TabsTrigger>
          <TabsTrigger value="components">Cost Breakdown</TabsTrigger>
          <TabsTrigger value="history">Version History</TabsTrigger>
        </TabsList>

        <TabsContent value="profit">
          <CifProfitDashboard />
        </TabsContent>

        {/* Variance Tab */}
        <TabsContent value="variance" className="space-y-4">
          {varianceChartData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Estimate vs Actual Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={varianceChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="order" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                    <Legend />
                    <Bar dataKey="estimate" name="Estimate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="actual" name="Actual" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No variance data yet. Variances are computed when both estimate and actual CIF exist for an order.
              </CardContent>
            </Card>
          )}

          {/* Variance Table */}
          {variances && variances.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead className="text-right">Estimate</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variances.map(v => {
                      const vj = v.variance_json as any;
                      const varianceUsd = vj?.variance_usd || 0;
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium text-sm">
                            {v.import_order_id?.slice(0, 8) || "—"}
                          </TableCell>
                          <TableCell className="text-right">{formatUSD(vj?.estimate_total_usd)}</TableCell>
                          <TableCell className="text-right">{formatUSD(vj?.actual_total_usd)}</TableCell>
                          <TableCell className="text-right">
                            <span className={varianceUsd > 0 ? "text-destructive" : "text-green-600"}>
                              {varianceUsd > 0 ? <ArrowUpRight className="inline h-3 w-3" /> : <ArrowDownRight className="inline h-3 w-3" />}
                              {formatUSD(Math.abs(varianceUsd))}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {v.summary_notes || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Component Breakdown Tab */}
        <TabsContent value="components" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Component Breakdown (All Orders)</CardTitle>
            </CardHeader>
            <CardContent>
              {componentBreakdown.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead className="text-right">Total (USD)</TableHead>
                      <TableHead className="text-right">Avg per Version</TableHead>
                      <TableHead className="text-right">Occurrences</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {componentBreakdown.map(item => (
                      <TableRow key={item.name}>
                        <TableCell className="font-medium capitalize">{item.name.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-right">{formatUSD(item.total)}</TableCell>
                        <TableCell className="text-right">{formatUSD(item.avg)}</TableCell>
                        <TableCell className="text-right">{componentBreakdown.find(b => b.name === item.name)?.total ? Math.round(item.total / item.avg) : 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-muted-foreground">No component data</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Version History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent CIF Versions</CardTitle>
            </CardHeader>
            <CardContent>
              {cifVersions && cifVersions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>FX Rate</TableHead>
                      <TableHead className="text-right">Landed Total</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cifVersions.slice(0, 30).map(v => {
                      const totals = v.totals_json as any;
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium text-sm">
                            {v.import_order_id?.slice(0, 8) || "Calculator"}
                          </TableCell>
                          <TableCell>v{v.version_no}</TableCell>
                          <TableCell>
                            <Badge variant={v.version_type === "actual" ? "default" : "secondary"} className="text-xs">
                              {v.version_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{v.fx_rate_usd_to_xcg}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatUSD(totals?.total_landed_usd)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(v.created_at), "MMM d, HH:mm")}
                          </TableCell>
                          <TableCell>
                            {v.is_final ? (
                              <Badge className="bg-green-600 text-xs">Final</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Draft</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-muted-foreground">No CIF versions yet</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
