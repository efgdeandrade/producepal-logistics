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
import { Loader2, Package, Upload, DollarSign, TrendingUp } from "lucide-react";
import { WarehouseDocumentUpload } from "./WarehouseDocumentUpload";
import { FreightDocumentUpload } from "./FreightDocumentUpload";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SupplierWeightData {
  supplierId: string;
  supplierName: string;
  actualWeightKg: string;
  volumetricWeightKg: string;
  palletsUsed: string;
  weightTypeUsed: "actual" | "volumetric";
  products: {
    productCode: string;
    productName: string;
    quantity: number;
    costPerUnit: number;
    weightPerUnit: number;
    volumetricWeightPerUnit: number;
  }[];
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
  const [supplierWeights, setSupplierWeights] = useState<SupplierWeightData[]>([]);
  const [exchangeRate, setExchangeRate] = useState(1.82);

  // Initialize supplier data grouped by supplier
  useEffect(() => {
    const initializeData = async () => {
      // Fetch suppliers and settings
      const [suppliersRes, settingsRes, productsRes] = await Promise.all([
        supabase.from("suppliers").select("*"),
        supabase.from("settings").select("*").eq("key", "usd_to_xcg_rate"),
        supabase.from("products").select("*")
      ]);

      const suppliersData = suppliersRes.data || [];
      const rate = (settingsRes.data?.[0]?.value as any)?.rate || 1.82;
      setExchangeRate(rate);

      // Group products by supplier
      const supplierGroups = new Map<string, any[]>();
      
      orderItems.forEach(item => {
        const product = productsRes.data?.find(p => p.code === item.product_code);
        const supplierId = product?.supplier_id;
        
        // Skip products without supplier
        if (!supplierId) return;
        
        if (!supplierGroups.has(supplierId)) {
          supplierGroups.set(supplierId, []);
        }
        
        supplierGroups.get(supplierId)!.push({
          productCode: item.product_code,
          productName: product?.name || item.product_code,
          quantity: item.quantity,
          costPerUnit: product?.price_usd_per_unit || 0,
          weightPerUnit: product?.gross_weight_per_unit || product?.netto_weight_per_unit || 0,
          volumetricWeightPerUnit: product?.volumetric_weight_kg || 0,
        });
      });

      // Create supplier weight data
      const weights: SupplierWeightData[] = Array.from(supplierGroups.entries()).map(([supplierId, products]) => {
        const supplier = suppliersData.find(s => s.id === supplierId);
        return {
          supplierId,
          supplierName: supplier?.name || "Unknown",
          actualWeightKg: "",
          volumetricWeightKg: "",
          palletsUsed: "",
          weightTypeUsed: "actual" as const,
          products
        };
      });
      
      setSupplierWeights(weights);
    };

    initializeData();
  }, [orderItems]);

  const updateSupplierWeight = (supplierId: string, field: keyof SupplierWeightData, value: any) => {
    setSupplierWeights(prev => prev.map(sw => 
      sw.supplierId === supplierId ? { ...sw, [field]: value } : sw
    ));
  };

  const handleWarehouseDocumentExtraction = (supplierId: string) => (extractedData: any[]) => {
    // Extract per-supplier totals (not per product)
    // The warehouse document provides total weight for entire supplier shipment
    const totalActualWeight = extractedData.reduce((sum, item) => sum + (item.actualWeightKg || 0), 0);
    const totalVolumetricWeight = extractedData.reduce((sum, item) => sum + (item.volumetricWeightKg || 0), 0);
    const totalPallets = extractedData.reduce((sum, item) => sum + (item.palletsUsed || 0), 0);
    
    // Determine which weight type was charged
    const weightTypeUsed = totalVolumetricWeight > totalActualWeight ? "volumetric" : "actual";
    
    updateSupplierWeight(supplierId, "actualWeightKg", totalActualWeight.toString());
    updateSupplierWeight(supplierId, "volumetricWeightKg", totalVolumetricWeight.toString());
    updateSupplierWeight(supplierId, "palletsUsed", totalPallets.toString());
    updateSupplierWeight(supplierId, "weightTypeUsed", weightTypeUsed);
    
    toast.success(`Warehouse data extracted for supplier`);
  };

  const calculateActualCIF = () => {
    const totalActualFreightExterior = parseFloat(actualFreightExterior || "0");
    const totalActualFreightLocal = parseFloat(actualFreightLocal || "0");
    const totalActualFreight = totalActualFreightExterior + totalActualFreightLocal;
    const totalOtherCosts = parseFloat(actualOtherCosts || "0");

    // Calculate total chargeable weight across all suppliers
    const totalChargeableWeight = supplierWeights.reduce((sum, sw) => {
      const actualWt = parseFloat(sw.actualWeightKg || "0");
      const volWt = parseFloat(sw.volumetricWeightKg || "0");
      return sum + (sw.weightTypeUsed === "actual" ? actualWt : volWt);
    }, 0);

    // Calculate CIF for each product
    const allProducts: any[] = [];
    
    supplierWeights.forEach(supplier => {
      const supplierActualWt = parseFloat(supplier.actualWeightKg || "0");
      const supplierVolWt = parseFloat(supplier.volumetricWeightKg || "0");
      const supplierChargeableWt = supplier.weightTypeUsed === "actual" ? supplierActualWt : supplierVolWt;
      
      // Allocate freight to this supplier based on weight
      const supplierFreightShare = totalChargeableWeight > 0 
        ? (supplierChargeableWt / totalChargeableWeight) * totalActualFreight 
        : 0;

      // Calculate total product weight for this supplier
      const supplierProductWeight = supplier.products.reduce((sum, p) => 
        sum + (p.quantity * p.weightPerUnit / 1000), 0
      );

      supplier.products.forEach(product => {
        const productActualWeight = product.quantity * product.weightPerUnit / 1000;
        const productVolWeight = product.quantity * product.volumetricWeightPerUnit / 1000;
        const productCost = product.quantity * product.costPerUnit;
        
        // Distribute supplier's freight to products by weight
        const productWeightRatio = supplierProductWeight > 0 
          ? productActualWeight / supplierProductWeight 
          : 1 / supplier.products.length;
        const productFreight = supplierFreightShare * productWeightRatio;
        
        const cifUSD = productCost + productFreight;
        const cifXCG = cifUSD * exchangeRate;
        const cifPerUnit = product.quantity > 0 ? cifXCG / product.quantity : 0;

        // Calculate wholesale and retail prices
        const wholesalePrice = cifPerUnit * 1.25;
        const retailPrice = cifPerUnit * 1.786;

        allProducts.push({
          productCode: product.productCode,
          productName: product.productName,
          quantity: product.quantity,
          actualWeight: productActualWeight,
          volumetricWeight: productVolWeight,
          weightType: productVolWeight > productActualWeight ? 'volumetric' : 'actual',
          costUSD: productCost,
          freightCost: productFreight,
          cifUSD,
          cifXCG,
          cifPerUnit,
          wholesalePrice,
          retailPrice,
          wholesaleMargin: wholesalePrice - cifPerUnit,
          retailMargin: retailPrice - cifPerUnit,
          supplierName: supplier.supplierName
        });
      });
    });

    return allProducts;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const totalActualFreight = 
        parseFloat(actualFreightExterior || "0") + 
        parseFloat(actualFreightLocal || "0");
      const totalEstimatedFreight = estimatedFreightExterior + estimatedFreightLocal;
      const calculations = calculateActualCIF();

      // Save each product's actual CIF data
      for (const calc of calculations) {
        const { error } = await supabase.from("cif_estimates").insert({
          order_id: orderId,
          product_code: calc.productCode,
          estimated_freight_exterior_usd: estimatedFreightExterior,
          estimated_freight_local_usd: estimatedFreightLocal,
          estimated_total_freight_usd: totalEstimatedFreight,
          estimated_other_costs_usd: 0,
          actual_freight_exterior_usd: parseFloat(actualFreightExterior || "0"),
          actual_freight_local_usd: parseFloat(actualFreightLocal || "0"),
          actual_total_freight_usd: totalActualFreight,
          actual_other_costs_usd: parseFloat(actualOtherCosts || "0"),
          actual_weight_kg: calc.actualWeight,
          volumetric_weight_kg: calc.volumetricWeight,
          chargeable_weight_kg: calc.weightType === "actual" ? calc.actualWeight : calc.volumetricWeight,
          weight_type_used: calc.weightType,
          variance_amount_usd: totalActualFreight - totalEstimatedFreight,
          variance_percentage: totalEstimatedFreight > 0 
            ? ((totalActualFreight - totalEstimatedFreight) / totalEstimatedFreight) * 100 
            : 0,
          actual_cif_xcg: calc.cifXCG
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

  const hasData = actualFreightExterior || actualFreightLocal || supplierWeights.some(sw => sw.actualWeightKg);
  const cifCalculations = hasData ? calculateActualCIF() : [];

  if (supplierWeights.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No products with assigned suppliers in this order</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Freight Cost Input Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            <CardTitle>Actual Freight Costs</CardTitle>
          </div>
          <CardDescription>Upload invoices or enter actual freight charges</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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

          <Separator />

          {/* Manual Input */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="actualFreightExterior">Exterior Freight (USD)</Label>
              <Input
                id="actualFreightExterior"
                type="number"
                step="0.01"
                placeholder={`Estimated: $${estimatedFreightExterior.toFixed(2)}`}
                value={actualFreightExterior}
                onChange={(e) => setActualFreightExterior(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actualFreightLocal">Local Freight (USD)</Label>
              <Input
                id="actualFreightLocal"
                type="number"
                step="0.01"
                placeholder={`Estimated: $${estimatedFreightLocal.toFixed(2)}`}
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

      {/* Supplier Weight Data */}
      <Tabs defaultValue={supplierWeights[0]?.supplierId} className="w-full">
        <TabsList className="w-full justify-start">
          {supplierWeights.map(sw => (
            <TabsTrigger key={sw.supplierId} value={sw.supplierId}>
              {sw.supplierName}
            </TabsTrigger>
          ))}
        </TabsList>

        {supplierWeights.map(supplier => (
          <TabsContent key={supplier.supplierId} value={supplier.supplierId} className="space-y-4">
            <WarehouseDocumentUpload 
              onDataExtracted={handleWarehouseDocumentExtraction(supplier.supplierId)} 
            />
            
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  <CardTitle>{supplier.supplierName} - Weight Data</CardTitle>
                </div>
                <CardDescription>
                  Enter total weight data from warehouse receipt for all products from this supplier
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Actual Weight (kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={supplier.actualWeightKg}
                      onChange={(e) => updateSupplierWeight(supplier.supplierId, "actualWeightKg", e.target.value)}
                      placeholder="Total actual weight"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Volumetric Weight (kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={supplier.volumetricWeightKg}
                      onChange={(e) => updateSupplierWeight(supplier.supplierId, "volumetricWeightKg", e.target.value)}
                      placeholder="Total volumetric weight"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pallets Used</Label>
                    <Input
                      type="number"
                      value={supplier.palletsUsed}
                      onChange={(e) => updateSupplierWeight(supplier.supplierId, "palletsUsed", e.target.value)}
                      placeholder="Number of pallets"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Weight Type Charged</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={supplier.weightTypeUsed}
                      onChange={(e) => updateSupplierWeight(supplier.supplierId, "weightTypeUsed", e.target.value as "actual" | "volumetric")}
                    >
                      <option value="actual">Actual Weight</option>
                      <option value="volumetric">Volumetric Weight</option>
                    </select>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-3">Products in this shipment:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {supplier.products.map(p => (
                      <div key={p.productCode} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                        <span className="text-sm font-medium">{p.productName}</span>
                        <Badge variant="secondary">{p.quantity} units</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Actual CIF Calculations */}
      {hasData && cifCalculations.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <CardTitle>Actual CIF Results</CardTitle>
            </div>
            <CardDescription>Calculated using actual freight costs and supplier weight data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <div className="text-xs text-muted-foreground">Exterior Freight</div>
                <div className="text-lg font-bold">
                  ${parseFloat(actualFreightExterior || "0").toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Local Freight</div>
                <div className="text-lg font-bold">
                  ${parseFloat(actualFreightLocal || "0").toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Other Costs</div>
                <div className="text-lg font-bold">
                  ${parseFloat(actualOtherCosts || "0").toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total CIF</div>
                <div className="text-lg font-bold text-primary">
                  ${(parseFloat(actualFreightExterior || "0") + parseFloat(actualFreightLocal || "0") + parseFloat(actualOtherCosts || "0")).toFixed(2)}
                </div>
              </div>
            </div>

            <Separator />

            {/* CIF Table */}
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Actual (kg)</TableHead>
                    <TableHead className="text-right">Vol. (kg)</TableHead>
                    <TableHead className="text-right">Type</TableHead>
                    <TableHead className="text-right">Cost USD</TableHead>
                    <TableHead className="text-right">Freight</TableHead>
                    <TableHead className="text-right">CIF USD</TableHead>
                    <TableHead className="text-right">CIF Cg</TableHead>
                    <TableHead className="text-right">CIF/Unit</TableHead>
                    <TableHead className="text-right">Wholesale</TableHead>
                    <TableHead className="text-right">W. Margin</TableHead>
                    <TableHead className="text-right">W. %</TableHead>
                    <TableHead className="text-right">Retail</TableHead>
                    <TableHead className="text-right">R. Margin</TableHead>
                    <TableHead className="text-right">R. %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cifCalculations.map((calc) => {
                    const wholesaleMarginPercent = calc.cifPerUnit > 0 
                      ? ((calc.wholesalePrice - calc.cifPerUnit) / calc.cifPerUnit * 100)
                      : 0;
                    const retailMarginPercent = calc.cifPerUnit > 0
                      ? ((calc.retailPrice - calc.cifPerUnit) / calc.cifPerUnit * 100)
                      : 0;

                    return (
                      <TableRow key={calc.productCode}>
                        <TableCell className="font-medium">
                          {calc.productName}
                          <div className="text-xs text-muted-foreground">{calc.productCode}</div>
                        </TableCell>
                        <TableCell className="text-right">{calc.quantity}</TableCell>
                        <TableCell className="text-right">{calc.actualWeight.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{calc.volumetricWeight.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={calc.weightType === 'volumetric' ? 'default' : 'secondary'}>
                            {calc.weightType === 'volumetric' ? 'Vol' : 'Act'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">${calc.costUSD.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${calc.freightCost.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${calc.cifUSD.toFixed(2)}</TableCell>
                        <TableCell className="text-right">Cg {calc.cifXCG.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-bold">
                          Cg {calc.cifPerUnit.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">Cg {calc.wholesalePrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-green-600">
                          Cg {calc.wholesaleMargin.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">
                          {wholesaleMarginPercent.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">Cg {calc.retailPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-green-600">
                          Cg {calc.retailMargin.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">
                          {retailMarginPercent.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
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
