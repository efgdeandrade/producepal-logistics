import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { supabase } from "../integrations/supabase/client";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

interface CIFEstimate {
  product_code: string;
  estimated_freight_exterior_usd: number;
  estimated_freight_local_usd: number;
  estimated_total_freight_usd: number;
  estimated_other_costs_usd: number;
  actual_freight_exterior_usd: number;
  actual_freight_local_usd: number;
  actual_total_freight_usd: number;
  actual_other_costs_usd: number;
  actual_weight_kg: number;
  volumetric_weight_kg: number;
  chargeable_weight_kg: number;
  pallets_used: number;
  weight_type_used: string;
  variance_amount_usd: number;
  variance_percentage: number;
  estimated_date: string;
}

interface CIFComparisonProps {
  orderId: string;
  orderItems: any[];
}

export function CIFComparison({ orderId, orderItems }: CIFComparisonProps) {
  const [estimates, setEstimates] = useState<CIFEstimate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEstimates();
  }, [orderId]);

  const fetchEstimates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cif_estimates")
        .select("*")
        .eq("order_id", orderId)
        .order("estimated_date", { ascending: false });

      if (error) throw error;
      setEstimates(data || []);
    } catch (error: any) {
      console.error("Error fetching CIF estimates:", error);
      toast.error("Failed to load CIF comparison data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading comparison data...</div>
        </CardContent>
      </Card>
    );
  }

  if (estimates.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No actual costs entered yet. Enter actual costs to see comparison.
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalEstimatedFreight = estimates.reduce((sum, e) => sum + (e.estimated_total_freight_usd || 0), 0) / estimates.length;
  const totalActualFreight = estimates.reduce((sum, e) => sum + (e.actual_total_freight_usd || 0), 0) / estimates.length;
  const totalVariance = totalActualFreight - totalEstimatedFreight;
  const totalVariancePercentage = totalEstimatedFreight > 0 ? (totalVariance / totalEstimatedFreight) * 100 : 0;

  const getVarianceBadge = (variance: number) => {
    if (Math.abs(variance) < 5) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Within 5%</Badge>;
    } else if (variance > 0) {
      return <Badge variant="destructive">+{variance.toFixed(1)}% Over</Badge>;
    } else {
      return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">{variance.toFixed(1)}% Under</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>CIF Cost Comparison Summary</CardTitle>
          <CardDescription>Estimated vs Actual costs for this order</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Total Estimated Freight</div>
              <div className="text-2xl font-bold">${totalEstimatedFreight.toFixed(2)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Total Actual Freight</div>
              <div className="text-2xl font-bold">${totalActualFreight.toFixed(2)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Variance</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">
                  {totalVariance > 0 ? "+" : ""}${totalVariance.toFixed(2)}
                </div>
                {totalVariance > 0 ? (
                  <TrendingUp className="h-5 w-5 text-destructive" />
                ) : totalVariance < 0 ? (
                  <TrendingDown className="h-5 w-5 text-green-600" />
                ) : null}
              </div>
              <div>{getVarianceBadge(totalVariancePercentage)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product-Level CIF Breakdown</CardTitle>
          <CardDescription>Complete cost breakdown with estimated vs actual comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead className="text-right">Ext. Est.</TableHead>
                  <TableHead className="text-right">Ext. Act.</TableHead>
                  <TableHead className="text-right">Local Est.</TableHead>
                  <TableHead className="text-right">Local Act.</TableHead>
                  <TableHead className="text-right">Total Est.</TableHead>
                  <TableHead className="text-right">Total Act.</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimates.map((estimate) => {
                  const product = orderItems.find(item => item.product_code === estimate.product_code);
                  return (
                    <TableRow key={estimate.product_code}>
                      <TableCell>
                        <div className="font-medium">{product?.products?.name || estimate.product_code}</div>
                        <div className="text-xs text-muted-foreground">{estimate.product_code}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {estimate.weight_type_used === "volumetric" ? "🔵 Vol" : "🟢 Act"} • {estimate.pallets_used || 0} pallets
                        </div>
                      </TableCell>
                      <TableCell>{product?.quantity || 0}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ${estimate.estimated_freight_exterior_usd?.toFixed(2) || "0.00"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        ${estimate.actual_freight_exterior_usd?.toFixed(2) || "0.00"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ${estimate.estimated_freight_local_usd?.toFixed(2) || "0.00"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        ${estimate.actual_freight_local_usd?.toFixed(2) || "0.00"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${estimate.estimated_total_freight_usd?.toFixed(2) || "0.00"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        ${estimate.actual_total_freight_usd?.toFixed(2) || "0.00"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={estimate.variance_amount_usd > 0 ? "text-destructive" : "text-green-600"}>
                          {estimate.variance_amount_usd > 0 ? "+" : ""}
                          ${estimate.variance_amount_usd?.toFixed(2) || "0.00"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getVarianceBadge(estimate.variance_percentage || 0)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Weight Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Weight Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Actual Weight (kg)</TableHead>
                <TableHead className="text-right">Volumetric Weight (kg)</TableHead>
                <TableHead className="text-right">Chargeable Weight (kg)</TableHead>
                <TableHead>Limiting Factor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimates.map((estimate) => {
                const isVolWeightLimiting = estimate.chargeable_weight_kg === estimate.volumetric_weight_kg;
                return (
                  <TableRow key={`weight-${estimate.product_code}`}>
                    <TableCell className="font-medium">{estimate.product_code}</TableCell>
                    <TableCell className="text-right">{estimate.actual_weight_kg?.toFixed(2) || "0.00"}</TableCell>
                    <TableCell className="text-right">{estimate.volumetric_weight_kg?.toFixed(2) || "0.00"}</TableCell>
                    <TableCell className="text-right font-bold">{estimate.chargeable_weight_kg?.toFixed(2) || "0.00"}</TableCell>
                    <TableCell>
                      {isVolWeightLimiting ? (
                        <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Volumetric
                        </Badge>
                      ) : (
                        <Badge variant="outline">Actual</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}