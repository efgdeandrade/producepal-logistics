import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Package } from "lucide-react";
import { WarehouseDocumentUpload } from "./WarehouseDocumentUpload";
import { FreightDocumentUpload } from "./FreightDocumentUpload";

interface ProductWeightInput {
  productCode: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  quantity: number;
  estimatedWeight: number;
  estimatedVolWeight: number;
  actualWeightKg: string;
  volumetricWeightKg: string;
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
  const [productWeights, setProductWeights] = useState<ProductWeightInput[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // Fetch suppliers and initialize product weights
  useEffect(() => {
    const initializeData = async () => {
      // Fetch suppliers
      const { data: suppliersData } = await supabase
        .from("suppliers")
        .select("*");
      
      setSuppliers(suppliersData || []);

      // Initialize product weights with supplier info
      const weights: ProductWeightInput[] = orderItems.map(item => {
        const supplierName = suppliersData?.find(s => s.id === item.products?.supplier_id)?.name || "Unknown Supplier";
        return {
          productCode: item.product_code,
          productName: item.products?.name || item.product_code,
          supplierId: item.products?.supplier_id || "",
          supplierName,
          quantity: item.quantity,
          estimatedWeight: (item.products?.gross_weight_per_unit || 0) * item.quantity,
          estimatedVolWeight: (item.products?.volumetric_weight_kg || 0) * item.quantity,
          actualWeightKg: "",
          volumetricWeightKg: "",
          palletsUsed: "",
          weightTypeUsed: "actual" as const
        };
      });
      
      setProductWeights(weights);
    };

    initializeData();
  }, [orderItems]);

  // Group products by supplier
  const productsBySupplier = useMemo(() => {
    const grouped = new Map<string, ProductWeightInput[]>();
    
    productWeights.forEach(product => {
      const key = product.supplierId || "unknown";
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(product);
    });
    
    return Array.from(grouped.entries()).map(([supplierId, products]) => ({
      supplierId,
      supplierName: products[0]?.supplierName || "Unknown Supplier",
      products
    }));
  }, [productWeights]);

  const updateProductWeight = (productCode: string, field: keyof ProductWeightInput, value: any) => {
    setProductWeights(prev => prev.map(pw => 
      pw.productCode === productCode ? { ...pw, [field]: value } : pw
    ));
  };

  const handleWarehouseDocumentExtraction = (supplierId: string) => (extractedData: any[]) => {
    extractedData.forEach(extracted => {
      const product = productWeights.find(pw => 
        pw.productCode === extracted.productCode && pw.supplierId === supplierId
      );
      if (product) {
        updateProductWeight(product.productCode, "actualWeightKg", extracted.actualWeightKg.toString());
        updateProductWeight(product.productCode, "volumetricWeightKg", extracted.volumetricWeightKg.toString());
        updateProductWeight(product.productCode, "palletsUsed", extracted.palletsUsed.toString());
        updateProductWeight(product.productCode, "weightTypeUsed", extracted.weightTypeUsed);
      }
    });
  };

  const calculateActualCIF = () => {
    const totalActualFreight = parseFloat(actualFreightExterior || "0") + parseFloat(actualFreightLocal || "0");
    const totalOtherCosts = parseFloat(actualOtherCosts || "0");
    const totalCosts = totalActualFreight + totalOtherCosts;

    const productCalculations = productWeights.map(pw => {
      const actualWeight = parseFloat(pw.actualWeightKg || "0");
      const volWeight = parseFloat(pw.volumetricWeightKg || pw.estimatedVolWeight.toString());
      const chargeableWeight = pw.weightTypeUsed === "actual" ? actualWeight : volWeight;
      
      return {
        ...pw,
        actualWeight,
        volWeight,
        chargeableWeight
      };
    });

    const totalChargeableWeight = productCalculations.reduce((sum, p) => sum + p.chargeableWeight, 0);

    return productCalculations.map(product => {
      const weightRatio = totalChargeableWeight > 0 ? product.chargeableWeight / totalChargeableWeight : 0;
      const allocatedFreight = totalActualFreight * weightRatio;
      const allocatedOther = totalOtherCosts * weightRatio;
      const totalAllocated = allocatedFreight + allocatedOther;
      const cifPerUnit = product.quantity > 0 ? totalAllocated / product.quantity : 0;

      return {
        productCode: product.productCode,
        productName: product.productName,
        quantity: product.quantity,
        chargeableWeight: product.chargeableWeight,
        allocatedFreight,
        allocatedOther,
        totalAllocated,
        cifPerUnit
      };
    });
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
        const volumetricWeight = parseFloat(pw.volumetricWeightKg || pw.estimatedVolWeight.toString());
        const chargeableWeight = pw.weightTypeUsed === "actual" ? actualWeight : volumetricWeight;
        
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

  const hasData = actualFreightExterior || actualFreightLocal || productWeights.some(pw => pw.actualWeightKg);
  const cifCalculations = hasData ? calculateActualCIF() : [];

  return (
    <div className="space-y-6">
      {/* Document Uploads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FreightDocumentUpload 
          type="exterior" 
          onDataExtracted={(amount) => setActualFreightExterior(amount.toString())} 
        />
        <FreightDocumentUpload 
          type="local" 
          onDataExtracted={(amount) => setActualFreightLocal(amount.toString())} 
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Freight Costs</CardTitle>
          <CardDescription>Enter or upload actual freight charges</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Label htmlFor="actualOtherCosts">Other Costs (USD)</Label>
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
        </CardContent>
      </Card>

      {/* Warehouse Weight Data by Supplier */}
      {productsBySupplier.map(({ supplierId, supplierName, products }) => (
        <div key={supplierId} className="space-y-4">
          <WarehouseDocumentUpload 
            onDataExtracted={handleWarehouseDocumentExtraction(supplierId)} 
          />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {supplierName}
              </CardTitle>
              <CardDescription>Enter actual weight data for products from this supplier</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Est. Weight (kg)</TableHead>
                      <TableHead>Actual Weight (kg)</TableHead>
                      <TableHead>Vol. Weight (kg)</TableHead>
                      <TableHead>Pallets</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((pw) => (
                      <TableRow key={pw.productCode}>
                        <TableCell className="font-medium">
                          {pw.productName}
                          <div className="text-xs text-muted-foreground">{pw.productCode}</div>
                        </TableCell>
                        <TableCell>{pw.quantity}</TableCell>
                        <TableCell>{pw.estimatedWeight.toFixed(2)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-24"
                            value={pw.actualWeightKg}
                            onChange={(e) => updateProductWeight(pw.productCode, "actualWeightKg", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-24"
                            placeholder={pw.estimatedVolWeight.toFixed(2)}
                            value={pw.volumetricWeightKg}
                            onChange={(e) => updateProductWeight(pw.productCode, "volumetricWeightKg", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="w-20"
                            value={pw.palletsUsed}
                            onChange={(e) => updateProductWeight(pw.productCode, "palletsUsed", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <select
                            className="border rounded px-2 py-1 text-sm"
                            value={pw.weightTypeUsed}
                            onChange={(e) => updateProductWeight(pw.productCode, "weightTypeUsed", e.target.value as "actual" | "volumetric")}
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
            </CardContent>
          </Card>
        </div>
      ))}

      {/* Actual CIF Calculations */}
      {hasData && cifCalculations.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Actual CIF Calculations</CardTitle>
            <CardDescription>Based on entered actual costs and weights</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Total Freight</div>
                  <div className="text-2xl font-bold">
                    ${(parseFloat(actualFreightExterior || "0") + parseFloat(actualFreightLocal || "0")).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Other Costs</div>
                  <div className="text-2xl font-bold">
                    ${parseFloat(actualOtherCosts || "0").toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total CIF</div>
                  <div className="text-2xl font-bold text-primary">
                    ${(parseFloat(actualFreightExterior || "0") + parseFloat(actualFreightLocal || "0") + parseFloat(actualOtherCosts || "0")).toFixed(2)}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Chargeable Weight</TableHead>
                      <TableHead>Allocated Freight</TableHead>
                      <TableHead>Allocated Other</TableHead>
                      <TableHead>Total CIF</TableHead>
                      <TableHead>CIF per Unit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cifCalculations.map((calc) => (
                      <TableRow key={calc.productCode}>
                        <TableCell className="font-medium">
                          {calc.productName}
                          <div className="text-xs text-muted-foreground">{calc.productCode}</div>
                        </TableCell>
                        <TableCell>{calc.quantity}</TableCell>
                        <TableCell>{calc.chargeableWeight.toFixed(2)} kg</TableCell>
                        <TableCell>${calc.allocatedFreight.toFixed(2)}</TableCell>
                        <TableCell>${calc.allocatedOther.toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">${calc.totalAllocated.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">${calc.cifPerUnit.toFixed(2)}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Button onClick={handleSave} disabled={saving || !hasData} className="w-full" size="lg">
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving Actual CIF Data...
          </>
        ) : (
          "Save Actual CIF Costs"
        )}
      </Button>
    </div>
  );
}
