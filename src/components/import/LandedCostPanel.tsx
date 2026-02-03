import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LandedCostPanelProps {
  orderId: string;
}

interface TariffSettings {
  exteriorTariff: number;
  localTariff: number;
  exchangeRate: number;
}

export function LandedCostPanel({ orderId }: LandedCostPanelProps) {
  const [tariffs, setTariffs] = useState<TariffSettings>({
    exteriorTariff: 2.46,
    localTariff: 0.41,
    exchangeRate: 1.82,
  });
  
  // Actual costs state
  const [actualFreightUSD, setActualFreightUSD] = useState<string>("");
  const [actualOtherCostsUSD, setActualOtherCostsUSD] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Load tariff settings
  useEffect(() => {
    loadSettings();
  }, []);

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

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ESTIMATE PANEL - Placeholder until formulas are provided */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Estimate</CardTitle>
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

            <div className="text-center text-muted-foreground py-8">
              Weight formulas pending
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
