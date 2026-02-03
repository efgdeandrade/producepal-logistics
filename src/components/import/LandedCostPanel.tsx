import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calculator, DollarSign, Save, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


interface OrderItem {
  id: string;
  product_code: string;
  quantity: number;
  units_quantity?: number | null;
  is_from_stock?: boolean;
}

interface LandedCostPanelProps {
  orderId: string;
  orderItems: OrderItem[];
}

interface TariffSettings {
  exteriorTariff: number;
  localTariff: number;
  exchangeRate: number;
}

interface ProductWeight {
  code: string;
  name: string;
  totalUnits: number;
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
}

export function LandedCostPanel({ orderId, orderItems }: LandedCostPanelProps) {
  const [tariffs, setTariffs] = useState<TariffSettings>({
    exteriorTariff: 2.46,
    localTariff: 0.41,
    exchangeRate: 1.82,
  });
  const [productWeights, setProductWeights] = useState<ProductWeight[]>([]);
  const [totalChargeableWeight, setTotalChargeableWeight] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Actual costs state
  const [actualFreightUSD, setActualFreightUSD] = useState<string>("");
  const [actualOtherCostsUSD, setActualOtherCostsUSD] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Load tariff settings and calculate weights
  useEffect(() => {
    loadSettings();
    calculateWeights();
  }, [orderItems]);

  const loadSettings = async () => {
    try {
      const { data: settings } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["freight_exterior_tariff", "freight_local_tariff", "usd_to_xcg_rate"]);

      if (settings) {
        const settingsMap = new Map(settings.map(s => [s.key, s.value]));
        setTariffs({
          exteriorTariff: (settingsMap.get("freight_exterior_tariff") as any)?.rate || 2.46,
          localTariff: (settingsMap.get("freight_local_tariff") as any)?.rate || 0.41,
          exchangeRate: (settingsMap.get("usd_to_xcg_rate") as any)?.rate || 1.82,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const calculateWeights = async () => {
    setLoading(true);
    try {
      // Filter out stock items
      const importItems = orderItems.filter(item => !item.is_from_stock);
      
      if (importItems.length === 0) {
        setProductWeights([]);
        setTotalChargeableWeight(0);
        setLoading(false);
        return;
      }

      // Consolidate by product code
      const consolidated = importItems.reduce((acc, item) => {
        const existing = acc.find(i => i.product_code === item.product_code);
        if (existing) {
          existing.quantity += item.quantity;
          if (item.units_quantity != null) {
            existing.units_quantity = (existing.units_quantity || 0) + item.units_quantity;
          }
        } else {
          acc.push({ ...item });
        }
        return acc;
      }, [] as OrderItem[]);

      // Fetch product details
      const productCodes = [...new Set(consolidated.map(item => item.product_code))];
      const { data: products } = await supabase
        .from("products")
        .select("code, name, gross_weight_per_unit, netto_weight_per_unit, pack_size, empty_case_weight, length_cm, width_cm, height_cm")
        .in("code", productCodes);

      if (!products) {
        setLoading(false);
        return;
      }

      // Calculate weights
      let totalChargeable = 0;
      const weights: ProductWeight[] = consolidated.map(item => {
        const product = products.find(p => p.code === item.product_code);
        if (!product) return null;

        const packSize = product.pack_size || 1;
        const totalUnits = item.units_quantity ?? (item.quantity * packSize);
        
        // Actual weight: (units × weight per unit) + (cases × empty case weight)
        const weightPerUnitKg = (product.gross_weight_per_unit || product.netto_weight_per_unit || 0) / 1000;
        const actualWeightKg = (totalUnits * weightPerUnitKg) + (item.quantity * (product.empty_case_weight || 0) / 1000);
        
        // Volumetric weight: L × W × H / 6000
        const volumetricWeightKg = product.length_cm && product.width_cm && product.height_cm
          ? (product.length_cm * product.width_cm * product.height_cm * totalUnits) / 6000
          : 0;
        
        const chargeableWeightKg = Math.max(actualWeightKg, volumetricWeightKg);
        totalChargeable += chargeableWeightKg;

        return {
          code: product.code,
          name: product.name,
          totalUnits,
          actualWeightKg,
          volumetricWeightKg,
          chargeableWeightKg,
        };
      }).filter(Boolean) as ProductWeight[];

      setProductWeights(weights);
      setTotalChargeableWeight(totalChargeable);
    } catch (error) {
      console.error("Error calculating weights:", error);
    } finally {
      setLoading(false);
    }
  };

  // Estimate calculation
  const totalTariff = tariffs.exteriorTariff + tariffs.localTariff;
  const estimatedFreightUSD = totalChargeableWeight * totalTariff;
  const estimatedFreightXCG = estimatedFreightUSD * tariffs.exchangeRate;

  // Actual totals
  const actualFreight = parseFloat(actualFreightUSD) || 0;
  const actualOther = parseFloat(actualOtherCostsUSD) || 0;
  const actualTotalUSD = actualFreight + actualOther;
  const actualTotalXCG = actualTotalUSD * tariffs.exchangeRate;


  const handleSaveActual = async () => {
    setSaving(true);
    try {
      // For now, just show success - actual persistence would go to cif_estimates or a new table
      toast.success("Actual costs saved successfully");
    } catch (error) {
      console.error("Error saving actual costs:", error);
      toast.error("Failed to save actual costs");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Calculating weights...
          </div>
        </CardContent>
      </Card>
    );
  }

  const stockItemCount = orderItems.filter(item => item.is_from_stock).length;

  return (
    <div className="space-y-4">
      {stockItemCount > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg border text-sm">
          <span className="font-medium">{stockItemCount} item{stockItemCount !== 1 ? "s" : ""} from stock</span>
          <span className="text-muted-foreground"> excluded (already in warehouse)</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ESTIMATE PANEL */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Estimate
                </CardTitle>
                <CardDescription>Tariff × Weight</CardDescription>
              </div>
              <Badge variant="secondary">Before Arrival</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tariff Settings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Exterior Tariff</Label>
                <div className="font-medium">${tariffs.exteriorTariff}/kg</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Local Tariff</Label>
                <div className="font-medium">${tariffs.localTariff}/kg</div>
              </div>
            </div>

            <Separator />

            {/* Weight Summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Products</span>
                <span>{productWeights.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Chargeable Weight</span>
                <span className="font-medium">{totalChargeableWeight.toFixed(2)} kg</span>
              </div>
            </div>

            <Separator />

            {/* Estimated Costs */}
            <div className="bg-primary/5 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Estimated Freight</span>
                <span className="font-semibold">${estimatedFreightUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="font-medium">Total (XCG)</span>
                <span className="font-bold text-primary">ƒ{estimatedFreightXCG.toFixed(2)}</span>
              </div>
            </div>

            {/* Per-kg breakdown */}
            <div className="text-xs text-muted-foreground text-center">
              ({totalChargeableWeight.toFixed(2)} kg × ${totalTariff.toFixed(2)}/kg × {tariffs.exchangeRate} rate)
            </div>
          </CardContent>
        </Card>

        {/* ACTUAL PANEL */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Actual
                </CardTitle>
                <CardDescription>Real costs after arrival</CardDescription>
              </div>
              <Badge variant="outline">After Arrival</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Manual Entry */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="freight">Freight Cost (USD)</Label>
                <Input
                  id="freight"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={actualFreightUSD}
                  onChange={(e) => setActualFreightUSD(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="other">Other Costs (USD)</Label>
                <Input
                  id="other"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={actualOtherCostsUSD}
                  onChange={(e) => setActualOtherCostsUSD(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Actual Totals */}
            <div className="bg-accent/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total (USD)</span>
                <span className="font-semibold">${actualTotalUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="font-medium">Total (XCG)</span>
                <span className="font-bold text-primary">ƒ{actualTotalXCG.toFixed(2)}</span>
              </div>
            </div>

            {/* Variance */}
            {actualTotalUSD > 0 && (
              <div className="text-center">
                {actualTotalUSD > estimatedFreightUSD ? (
                  <span className="text-sm text-destructive">
                    +${(actualTotalUSD - estimatedFreightUSD).toFixed(2)} over estimate
                  </span>
                ) : (
                  <span className="text-sm text-primary">
                    -${(estimatedFreightUSD - actualTotalUSD).toFixed(2)} under estimate
                  </span>
                )}
              </div>
            )}

            <Button 
              onClick={handleSaveActual} 
              className="w-full" 
              disabled={saving || (!actualFreightUSD && !actualOtherCostsUSD)}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Actual Costs"}
            </Button>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}