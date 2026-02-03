import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, DollarSign, FileUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { FreightDocumentUpload } from "@/components/FreightDocumentUpload";

interface CIFActualCostEntryProps {
  orderId: string;
  estimatedSnapshot: any | null;
  onSaved: () => void;
}

interface ActualCosts {
  freightExteriorUsd: string;
  freightLocalUsd: string;
  laborXcg: string;
  bankChargesUsd: string;
  otherCostsUsd: string;
}

export function CIFActualCostEntry({ orderId, estimatedSnapshot, onSaved }: CIFActualCostEntryProps) {
  const [saving, setSaving] = useState(false);
  const [costs, setCosts] = useState<ActualCosts>({
    freightExteriorUsd: "",
    freightLocalUsd: "",
    laborXcg: "",
    bankChargesUsd: "",
    otherCostsUsd: "",
  });
  const [existingActual, setExistingActual] = useState<any>(null);
  const [freightUploadKey, setFreightUploadKey] = useState(0);

  // Load existing actual costs if any
  useEffect(() => {
    const fetchExistingActual = async () => {
      const { data } = await supabase
        .from("cif_calculation_snapshots")
        .select("*")
        .eq("order_id", orderId)
        .eq("snapshot_type", "actual")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setExistingActual(data);
        setCosts({
          freightExteriorUsd: data.freight_exterior_usd?.toString() || "",
          freightLocalUsd: data.freight_local_usd?.toString() || "",
          laborXcg: data.labor_xcg?.toString() || "",
          bankChargesUsd: data.bank_charges_usd?.toString() || "",
          otherCostsUsd: data.other_costs_usd?.toString() || "",
        });
      }
    };
    fetchExistingActual();
  }, [orderId]);

  const handleFreightExtraction = (type: "exterior" | "local") => (amount: number) => {
    setCosts(prev => ({
      ...prev,
      [type === "exterior" ? "freightExteriorUsd" : "freightLocalUsd"]: amount.toString()
    }));
    setFreightUploadKey(prev => prev + 1);
  };

  const totalActualFreight = 
    parseFloat(costs.freightExteriorUsd || "0") +
    parseFloat(costs.freightLocalUsd || "0") +
    parseFloat(costs.bankChargesUsd || "0") +
    parseFloat(costs.otherCostsUsd || "0");

  const estimatedTotal = estimatedSnapshot?.total_freight_usd || 0;
  const variance = totalActualFreight - estimatedTotal;
  const variancePercent = estimatedTotal > 0 ? (variance / estimatedTotal) * 100 : 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Calculate product allocations based on Smart Blend from estimated snapshot
      const productsData = estimatedSnapshot?.products_data || [];
      const totalChargeableWeight = productsData.reduce((sum: number, p: any) => sum + (p.chargeable_weight_kg || 0), 0);
      const totalCost = productsData.reduce((sum: number, p: any) => sum + (p.cost_usd || 0), 0);
      
      const blendRatio = estimatedSnapshot?.blend_ratio || 0.7;
      
      const actualProductsData = productsData.map((product: any) => {
        const weightShare = totalChargeableWeight > 0 
          ? (product.chargeable_weight_kg / totalChargeableWeight) 
          : 0;
        const costShare = totalCost > 0 
          ? (product.cost_usd / totalCost) 
          : 0;
        const freightShare = (weightShare * blendRatio + costShare * (1 - blendRatio)) * totalActualFreight;
        
        return {
          ...product,
          actual_freight_usd: freightShare,
          actual_cif_usd: (product.cost_usd || 0) + freightShare,
        };
      });

      // Save actual snapshot
      const { error: snapshotError } = await supabase
        .from("cif_calculation_snapshots")
        .insert({
          order_id: orderId,
          snapshot_type: "actual",
          total_freight_usd: totalActualFreight,
          freight_exterior_usd: parseFloat(costs.freightExteriorUsd || "0"),
          freight_local_usd: parseFloat(costs.freightLocalUsd || "0"),
          labor_xcg: parseFloat(costs.laborXcg || "0"),
          bank_charges_usd: parseFloat(costs.bankChargesUsd || "0"),
          other_costs_usd: parseFloat(costs.otherCostsUsd || "0"),
          distribution_method: estimatedSnapshot?.distribution_method || "smart_blend",
          blend_ratio: blendRatio,
          exchange_rate: estimatedSnapshot?.exchange_rate,
          products_data: actualProductsData,
          created_by: user?.id,
          notes: `Actuals entered. Variance: ${variancePercent.toFixed(1)}% from estimate.`,
        });

      if (snapshotError) throw snapshotError;

      // Update cif_estimates for each product
      for (const product of actualProductsData) {
        await supabase.from("cif_estimates").upsert(
          {
            order_id: orderId,
            product_code: product.product_code,
            actual_freight_exterior_usd: parseFloat(costs.freightExteriorUsd || "0") * 
              (product.chargeable_weight_kg / totalChargeableWeight),
            actual_freight_local_usd: parseFloat(costs.freightLocalUsd || "0") *
              (product.chargeable_weight_kg / totalChargeableWeight),
            actual_total_freight_usd: product.actual_freight_usd,
            actual_labor_xcg: parseFloat(costs.laborXcg || "0") / productsData.length,
            actual_bank_charges_usd: parseFloat(costs.bankChargesUsd || "0") / productsData.length,
            actual_other_costs_usd: parseFloat(costs.otherCostsUsd || "0") / productsData.length,
            actual_cif_xcg: product.actual_cif_usd * (estimatedSnapshot?.exchange_rate || 1.82),
            actual_weight_kg: product.actual_weight_kg || 0,
            volumetric_weight_kg: product.volumetric_weight_kg || 0,
            chargeable_weight_kg: product.chargeable_weight_kg || 0,
            weight_type_used: product.weight_type_used || "actual",
            variance_amount_usd: (product.actual_freight_usd || 0) - (product.freight_usd || 0),
            variance_percentage: product.freight_usd > 0 
              ? (((product.actual_freight_usd || 0) - product.freight_usd) / product.freight_usd) * 100
              : 0,
          },
          { onConflict: "order_id,product_code" }
        );
      }

      // Trigger learning engine
      try {
        await supabase.functions.invoke("cif-learning-engine", {
          body: { 
            action: "process_actuals",
            orderId,
            variancePercent 
          }
        });
      } catch (err) {
        console.warn("Learning engine trigger failed:", err);
      }

      toast.success("Actual costs saved & variance analyzed!");
      onSaved();
    } catch (error: any) {
      console.error("Error saving actual costs:", error);
      toast.error("Failed to save: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          <CardTitle>Enter Actual Costs</CardTitle>
        </div>
        <CardDescription>
          Input actual freight and handling costs to compare against estimates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Document Upload Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FreightDocumentUpload
            type="exterior"
            onDataExtracted={handleFreightExtraction("exterior")}
            uploadKey={freightUploadKey}
          />
          <FreightDocumentUpload
            type="local"
            onDataExtracted={handleFreightExtraction("local")}
            uploadKey={freightUploadKey}
          />
        </div>

        <Separator />

        {/* Structured Cost Entry */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Cost Categories
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="freightExterior">External Freight (Champion)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="freightExterior"
                  type="number"
                  step="0.01"
                  placeholder={estimatedSnapshot?.freight_exterior_usd?.toFixed(2) || "0.00"}
                  value={costs.freightExteriorUsd}
                  onChange={(e) => setCosts(prev => ({ ...prev, freightExteriorUsd: e.target.value }))}
                  className="pl-7"
                />
              </div>
              {estimatedSnapshot?.freight_exterior_usd && (
                <p className="text-xs text-muted-foreground">
                  Estimated: ${estimatedSnapshot.freight_exterior_usd.toFixed(2)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="freightLocal">Local Agent (Swissport)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="freightLocal"
                  type="number"
                  step="0.01"
                  placeholder={estimatedSnapshot?.freight_local_usd?.toFixed(2) || "0.00"}
                  value={costs.freightLocalUsd}
                  onChange={(e) => setCosts(prev => ({ ...prev, freightLocalUsd: e.target.value }))}
                  className="pl-7"
                />
              </div>
              {estimatedSnapshot?.freight_local_usd && (
                <p className="text-xs text-muted-foreground">
                  Estimated: ${estimatedSnapshot.freight_local_usd.toFixed(2)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="labor">Labor & Handling</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Cg</span>
                <Input
                  id="labor"
                  type="number"
                  step="0.01"
                  placeholder={estimatedSnapshot?.labor_xcg?.toFixed(2) || "50.00"}
                  value={costs.laborXcg}
                  onChange={(e) => setCosts(prev => ({ ...prev, laborXcg: e.target.value }))}
                  className="pl-8"
                />
              </div>
              {estimatedSnapshot?.labor_xcg && (
                <p className="text-xs text-muted-foreground">
                  Estimated: Cg{estimatedSnapshot.labor_xcg.toFixed(2)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankCharges">Bank/Financial Charges</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="bankCharges"
                  type="number"
                  step="0.01"
                  placeholder={estimatedSnapshot?.bank_charges_usd?.toFixed(2) || "0.00"}
                  value={costs.bankChargesUsd}
                  onChange={(e) => setCosts(prev => ({ ...prev, bankChargesUsd: e.target.value }))}
                  className="pl-7"
                />
              </div>
              {estimatedSnapshot?.bank_charges_usd && (
                <p className="text-xs text-muted-foreground">
                  Estimated: ${estimatedSnapshot.bank_charges_usd.toFixed(2)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="otherCosts">Other Costs</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="otherCosts"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={costs.otherCostsUsd}
                  onChange={(e) => setCosts(prev => ({ ...prev, otherCostsUsd: e.target.value }))}
                  className="pl-7"
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Summary Section */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Total Actual Freight</span>
            <span className="text-xl font-bold">${totalActualFreight.toFixed(2)}</span>
          </div>
          
          {estimatedSnapshot && (
            <>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Estimated Total</span>
                <span>${estimatedTotal.toFixed(2)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="font-medium">Variance</span>
                <div className="flex items-center gap-2">
                  {Math.abs(variancePercent) < 5 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className={`h-4 w-4 ${variancePercent > 0 ? "text-destructive" : "text-blue-600"}`} />
                  )}
                  <span className={`font-bold ${
                    Math.abs(variancePercent) < 5 
                      ? "text-green-600" 
                      : variancePercent > 0 
                        ? "text-destructive" 
                        : "text-blue-600"
                  }`}>
                    {variance > 0 ? "+" : ""}${variance.toFixed(2)} ({variancePercent.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            onClick={handleSave}
            disabled={saving || totalActualFreight === 0}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Actuals & Analyze Variance
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
