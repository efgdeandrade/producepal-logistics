import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ProductWeightInput {
  productCode: string;
  productName: string;
  quantity: number;
  estimatedWeight: number;
  estimatedVolWeight: number;
  actualWeightKg: string;
  palletsUsed: string;
  weightTypeUsed: "actual" | "volumetric";
}

interface ActualCIFFormProps {
  orderId: string;
  orderItems: any[];
  estimatedFreightExterior: number;
  estimatedFreightLocal: number;
  onSaved: () => void;
}

export function ActualCIFForm({ 
  orderId, 
  orderItems, 
  estimatedFreightExterior,
  estimatedFreightLocal,
  onSaved 
}: ActualCIFFormProps) {
  const [saving, setSaving] = useState(false);
  const [actualFreightExterior, setActualFreightExterior] = useState("");
  const [actualFreightLocal, setActualFreightLocal] = useState("");
  const [actualOtherCosts, setActualOtherCosts] = useState("");
  const [productWeights, setProductWeights] = useState<ProductWeightInput[]>(
    orderItems.map(item => ({
      productCode: item.product_code,
      productName: item.products?.name || item.product_code,
      quantity: item.quantity,
      estimatedWeight: (item.products?.gross_weight_per_unit || 0) * item.quantity,
      estimatedVolWeight: (item.products?.volumetric_weight_kg || 0) * item.quantity,
      actualWeightKg: "",
      palletsUsed: "",
      weightTypeUsed: "actual" as const
    }))
  );

  const updateProductWeight = (index: number, field: keyof ProductWeightInput, value: any) => {
    const updated = [...productWeights];
    updated[index] = { ...updated[index], [field]: value };
    setProductWeights(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const totalActualFreight = 
        parseFloat(actualFreightExterior || "0") + 
        parseFloat(actualFreightLocal || "0");
      
      const totalEstimatedFreight = estimatedFreightExterior + estimatedFreightLocal;

      // Save each product's actual CIF data
      for (const pw of productWeights) {
        const actualWeight = parseFloat(pw.actualWeightKg || "0");
        const volumetricWeight = pw.estimatedVolWeight;
        const chargeableWeight = Math.max(actualWeight, volumetricWeight);
        
        const { error } = await supabase.from("cif_estimates").insert({
          order_id: orderId,
          product_code: pw.productCode,
          estimated_freight_exterior_usd: estimatedFreightExterior,
          estimated_freight_local_usd: estimatedFreightLocal,
          estimated_total_freight_usd: totalEstimatedFreight,
          estimated_other_costs_usd: 0,
          actual_freight_exterior_usd: parseFloat(actualFreightExterior || "0"),
          actual_freight_local_usd: parseFloat(actualFreightLocal || "0"),
          actual_total_freight_usd: totalActualFreight,
          actual_other_costs_usd: parseFloat(actualOtherCosts || "0"),
          actual_weight_kg: actualWeight,
          volumetric_weight_kg: volumetricWeight,
          chargeable_weight_kg: chargeableWeight,
          pallets_used: parseInt(pw.palletsUsed || "0"),
          weight_type_used: pw.weightTypeUsed,
          variance_amount_usd: totalActualFreight - totalEstimatedFreight,
          variance_percentage: totalEstimatedFreight > 0 
            ? ((totalActualFreight - totalEstimatedFreight) / totalEstimatedFreight) * 100 
            : 0
        });

        if (error) throw error;
      }

      toast.success("Actual CIF costs saved successfully");
      onSaved();
    } catch (error: any) {
      console.error("Error saving actual CIF:", error);
      toast.error("Failed to save actual costs: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter Actual CIF Costs</CardTitle>
        <CardDescription>
          Record the actual costs incurred for this order to improve future estimates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Freight Costs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="actualFreightExterior">Actual Freight Exterior (USD)</Label>
            <Input
              id="actualFreightExterior"
              type="number"
              step="0.01"
              placeholder={`Est: $${estimatedFreightExterior.toFixed(2)}`}
              value={actualFreightExterior}
              onChange={(e) => setActualFreightExterior(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="actualFreightLocal">Actual Freight Local (USD)</Label>
            <Input
              id="actualFreightLocal"
              type="number"
              step="0.01"
              placeholder={`Est: $${estimatedFreightLocal.toFixed(2)}`}
              value={actualFreightLocal}
              onChange={(e) => setActualFreightLocal(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="actualOtherCosts">Actual Other Costs (USD)</Label>
            <Input
              id="actualOtherCosts"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={actualOtherCosts}
              onChange={(e) => setActualOtherCosts(e.target.value)}
            />
          </div>
        </div>

        {/* Product Weight Details */}
        <div className="space-y-2">
          <Label>Product Weight Details</Label>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Est. Actual (kg)</TableHead>
                  <TableHead>Est. Vol. (kg)</TableHead>
                  <TableHead>Actual Weight (kg)</TableHead>
                  <TableHead>Pallets Used</TableHead>
                  <TableHead>Weight Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productWeights.map((pw, index) => (
                  <TableRow key={pw.productCode}>
                    <TableCell className="font-medium">
                      {pw.productName}
                      <div className="text-xs text-muted-foreground">{pw.productCode}</div>
                    </TableCell>
                    <TableCell>{pw.quantity}</TableCell>
                    <TableCell>{pw.estimatedWeight.toFixed(2)}</TableCell>
                    <TableCell>{pw.estimatedVolWeight.toFixed(2)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        className="w-24"
                        value={pw.actualWeightKg}
                        onChange={(e) => updateProductWeight(index, "actualWeightKg", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-20"
                        value={pw.palletsUsed}
                        onChange={(e) => updateProductWeight(index, "palletsUsed", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <select
                        className="border rounded px-2 py-1 text-sm"
                        value={pw.weightTypeUsed}
                        onChange={(e) => updateProductWeight(index, "weightTypeUsed", e.target.value as "actual" | "volumetric")}
                      >
                        <option value="actual">Actual</option>
                        <option value="volumetric">Volumetric</option>
                      </select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Actual Costs"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
