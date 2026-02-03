import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Minus } from "lucide-react";

interface CIFComparisonViewProps {
  estimatedSnapshot: any | null;
  actualSnapshot: any | null;
}

interface CostRow {
  category: string;
  estimated: number;
  actual: number;
  unit: string;
}

export function CIFComparisonView({ estimatedSnapshot, actualSnapshot }: CIFComparisonViewProps) {
  if (!estimatedSnapshot || !actualSnapshot) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            {!estimatedSnapshot 
              ? "No estimate available. Generate an estimate first."
              : "No actual costs entered yet. Enter actual costs to see comparison."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const costRows: CostRow[] = [
    {
      category: "External Freight (Champion)",
      estimated: estimatedSnapshot.freight_exterior_usd || 0,
      actual: actualSnapshot.freight_exterior_usd || 0,
      unit: "$",
    },
    {
      category: "Local Agent (Swissport)",
      estimated: estimatedSnapshot.freight_local_usd || 0,
      actual: actualSnapshot.freight_local_usd || 0,
      unit: "$",
    },
    {
      category: "Local Logistics",
      estimated: estimatedSnapshot.local_logistics_usd || 91,
      actual: actualSnapshot.local_logistics_usd || 91,
      unit: "$",
    },
    {
      category: "Labor & Handling",
      estimated: estimatedSnapshot.labor_xcg || 50,
      actual: actualSnapshot.labor_xcg || 50,
      unit: "Cg",
    },
    {
      category: "Bank/Financial Charges",
      estimated: estimatedSnapshot.bank_charges_usd || 0,
      actual: actualSnapshot.bank_charges_usd || 0,
      unit: "$",
    },
    {
      category: "Other Costs",
      estimated: estimatedSnapshot.other_costs_usd || 0,
      actual: actualSnapshot.other_costs_usd || 0,
      unit: "$",
    },
  ];

  const totalEstimated = estimatedSnapshot.total_freight_usd || 0;
  const totalActual = actualSnapshot.total_freight_usd || 0;
  const totalVariance = totalActual - totalEstimated;
  const totalVariancePercent = totalEstimated > 0 ? (totalVariance / totalEstimated) * 100 : 0;

  const getVarianceBadge = (variance: number, baseValue: number) => {
    const percent = baseValue > 0 ? (variance / baseValue) * 100 : 0;
    
    if (Math.abs(percent) < 5) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Within 5%
        </Badge>
      );
    } else if (variance > 0) {
      return (
        <Badge variant="destructive">
          <TrendingUp className="h-3 w-3 mr-1" />
          +{percent.toFixed(1)}% Over
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
          <TrendingDown className="h-3 w-3 mr-1" />
          {percent.toFixed(1)}% Under
        </Badge>
      );
    }
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp className="h-4 w-4 text-destructive" />;
    if (variance < 0) return <TrendingDown className="h-4 w-4 text-green-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  // Product-level comparison
  const estimatedProducts = estimatedSnapshot.products_data || [];
  const actualProducts = actualSnapshot.products_data || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Estimated</div>
            <div className="text-2xl font-bold">${totalEstimated.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Actual</div>
            <div className="text-2xl font-bold">${totalActual.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card className={totalVariancePercent > 5 ? "border-destructive" : totalVariancePercent < -5 ? "border-blue-500" : "border-green-500"}>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Variance</div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${
                Math.abs(totalVariancePercent) < 5 
                  ? "text-green-600" 
                  : totalVariancePercent > 0 
                    ? "text-destructive" 
                    : "text-blue-600"
              }`}>
                {totalVariance > 0 ? "+" : ""}${totalVariance.toFixed(2)}
              </span>
              {getVarianceIcon(totalVariance)}
            </div>
            <div className="mt-1">{getVarianceBadge(totalVariance, totalEstimated)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Category Comparison</CardTitle>
          <CardDescription>Estimated vs Actual by cost type</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Estimated</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costRows.map((row) => {
                const variance = row.actual - row.estimated;
                const showRow = row.estimated > 0 || row.actual > 0;
                
                if (!showRow) return null;
                
                return (
                  <TableRow key={row.category}>
                    <TableCell className="font-medium">{row.category}</TableCell>
                    <TableCell className="text-right font-mono">
                      {row.unit}{row.estimated.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {row.unit}{row.actual.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={variance > 0 ? "text-destructive" : variance < 0 ? "text-green-600" : ""}>
                        {variance > 0 ? "+" : ""}{row.unit}{variance.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {row.estimated > 0 ? getVarianceBadge(variance, row.estimated) : (
                        row.actual > 0 ? (
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            New Cost
                          </Badge>
                        ) : null
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {/* Total Row */}
              <TableRow className="bg-muted/50 font-bold border-t-2">
                <TableCell>TOTAL FREIGHT</TableCell>
                <TableCell className="text-right font-mono">${totalEstimated.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono">${totalActual.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono">
                  <span className={totalVariance > 0 ? "text-destructive" : totalVariance < 0 ? "text-green-600" : ""}>
                    {totalVariance > 0 ? "+" : ""}${totalVariance.toFixed(2)}
                  </span>
                </TableCell>
                <TableCell>{getVarianceBadge(totalVariance, totalEstimated)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product-Level Comparison */}
      {estimatedProducts.length > 0 && actualProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Product-Level CIF Comparison</CardTitle>
            <CardDescription>Per-product freight allocation analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Est. Freight</TableHead>
                  <TableHead className="text-right">Act. Freight</TableHead>
                  <TableHead className="text-right">Est. CIF/Unit</TableHead>
                  <TableHead className="text-right">Act. CIF/Unit</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimatedProducts.map((estProduct: any) => {
                  const actProduct = actualProducts.find(
                    (p: any) => p.product_code === estProduct.product_code
                  );
                  
                  if (!actProduct) return null;
                  
                  const estFreight = estProduct.freight_usd || 0;
                  const actFreight = actProduct.actual_freight_usd || 0;
                  const variance = actFreight - estFreight;
                  const variancePercent = estFreight > 0 ? (variance / estFreight) * 100 : 0;
                  
                  const estCifPerUnit = estProduct.cif_per_unit_xcg || 0;
                  const actCifPerUnit = actProduct.cif_per_unit_xcg || estCifPerUnit;
                  
                  return (
                    <TableRow key={estProduct.product_code}>
                      <TableCell>
                        <div className="font-medium">{estProduct.product_name}</div>
                        <div className="text-xs text-muted-foreground">{estProduct.product_code}</div>
                      </TableCell>
                      <TableCell className="text-right">{estProduct.quantity || 0}</TableCell>
                      <TableCell className="text-right font-mono">${estFreight.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">${actFreight.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">Cg{estCifPerUnit.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">Cg{actCifPerUnit.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono ${variance > 0 ? "text-destructive" : variance < 0 ? "text-green-600" : ""}`}>
                          {variance > 0 ? "+" : ""}${variance.toFixed(2)}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          ({variancePercent.toFixed(1)}%)
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Learning Insights */}
      {Math.abs(totalVariancePercent) > 10 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-orange-800 dark:text-orange-300">Learning Insight</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-700 dark:text-orange-400">
              This order shows a {Math.abs(totalVariancePercent).toFixed(1)}% variance from estimates.
              {totalVariancePercent > 25 
                ? " This may be flagged as an anomaly and excluded from automatic learning adjustments."
                : " The learning engine will incorporate this data to improve future estimates."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
