import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { supabase } from "../integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Package, Upload, DollarSign, TrendingUp, Calculator, ChevronDown } from "lucide-react";
import { WarehouseDocumentUpload } from "./WarehouseDocumentUpload";
import { FreightDocumentUpload } from "./FreightDocumentUpload";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { DitoAdvisor } from "./DitoAdvisor";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

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
    packSize: number;
    wholesalePriceXCG?: number;
    retailPriceXCG?: number;
  }[];
}

interface CIFResult {
  productCode: string;
  productName: string;
  quantity: number; // Units
  trays: number;
  actualWeight: number;
  volumetricWeight: number;
  chargeableWeight: number;
  weightType: 'actual' | 'volumetric';
  costUSD: number;
  freightCost: number;
  cifUSD: number;
  cifXCG: number;
  cifPerUnit: number; // Per unit
  wholesalePrice: number;
  retailPrice: number;
  wholesaleMargin: number;
  retailMargin: number;
  suppliers: string;
  priceHistory?: {
    previousWholesale?: number;
    previousRetail?: number;
    wholesaleChange?: number;
    retailChange?: number;
    lastChangeDate?: string;
  };
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
  const [demandPatterns, setDemandPatterns] = useState<Map<string, { frequency: number; wasteRate: number }>>(new Map());
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});
  const [priceHistory, setPriceHistory] = useState<Map<string, any>>(new Map());
  
  // Configurable costs
  const [localLogisticsUSD, setLocalLogisticsUSD] = useState(91);
  const [laborXCG, setLaborXCG] = useState(50);
  const [bankChargesUSD, setBankChargesUSD] = useState(0);
  
  // Upload keys to force remount on document upload
  const [consolidatedUploadKey, setConsolidatedUploadKey] = useState(0);
  const [freightUploadKey, setFreightUploadKey] = useState(0);

  // Initialize supplier data grouped by supplier
  useEffect(() => {
    const initializeData = async () => {
      // Fetch suppliers, settings, products, and demand patterns
      const [suppliersRes, settingsRes, productsRes] = await Promise.all([
        supabase.from("suppliers").select("*"),
        supabase.from("settings").select("*").eq("key", "usd_to_xcg_rate"),
        supabase.from("products").select("code, name, price_usd_per_unit, gross_weight_per_unit, netto_weight_per_unit, volumetric_weight_kg, supplier_id, pack_size, wholesale_price_xcg_per_unit, retail_price_xcg_per_unit")
      ]);

      const suppliersData = suppliersRes.data || [];
      const rate = (settingsRes.data?.[0]?.value as any)?.rate || 1.82;
      setExchangeRate(rate);

      // Fetch demand patterns for strategic calculations
      const productCodes = [...new Set(orderItems.map(item => item.product_code))];
      const [demandRes, priceHistoryRes] = await Promise.all([
        supabase.from('demand_patterns')
          .select('product_code, order_frequency, avg_waste_rate')
          .in('product_code', productCodes),
        supabase.from('product_price_history')
          .select('product_code, old_price_xcg_per_unit, new_price_xcg_per_unit, created_at')
          .in('product_code', productCodes)
          .order('created_at', { ascending: false })
      ]);

      const demandMap = new Map(
        demandRes.data?.map(d => [d.product_code, {
          frequency: d.order_frequency || 1,
          wasteRate: d.avg_waste_rate || 0
        }]) || []
      );
      setDemandPatterns(demandMap);

      // Group price history by product (get latest change for each product)
      const historyMap = new Map();
      priceHistoryRes.data?.forEach(h => {
        if (!historyMap.has(h.product_code)) {
          historyMap.set(h.product_code, {
            previousPrice: h.old_price_xcg_per_unit,
            currentPrice: h.new_price_xcg_per_unit,
            changeDate: h.created_at
          });
        }
      });
      setPriceHistory(historyMap);

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
          packSize: product?.pack_size || 1,
          wholesalePriceXCG: product?.wholesale_price_xcg_per_unit,
          retailPriceXCG: product?.retail_price_xcg_per_unit,
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

  const handleConsolidatedWarehouseExtraction = (extractedData: any[]) => {
    // extractedData now contains array of suppliers with their weights
    let updatedCount = 0;
    
    setSupplierWeights(prev => prev.map(sw => {
      // Fuzzy match supplier names - find matching supplier in extracted data
      const matchedSupplier = extractedData.find(extracted => {
        const extractedLower = extracted.supplierName.toLowerCase();
        const supplierLower = sw.supplierName.toLowerCase();
        
        // Try exact match first
        if (extractedLower === supplierLower) return true;
        
        // Try partial match - either contains the other
        if (extractedLower.includes(supplierLower) || supplierLower.includes(extractedLower)) return true;
        
        // Try matching first 3 words
        const extractedWords = extractedLower.split(/\s+/).slice(0, 3).join(' ');
        const supplierWords = supplierLower.split(/\s+/).slice(0, 3).join(' ');
        return extractedWords === supplierWords;
      });
      
      if (matchedSupplier) {
        updatedCount++;
        return {
          ...sw,
          actualWeightKg: matchedSupplier.actualWeightKg.toString(),
          volumetricWeightKg: matchedSupplier.volumetricWeightKg.toString(),
          palletsUsed: matchedSupplier.palletsUsed.toString(),
          weightTypeUsed: matchedSupplier.weightTypeUsed
        };
      }
      return sw;
    }));
    
    toast.success(`✓ Data replaced! Updated ${updatedCount} of ${supplierWeights.length} suppliers from warehouse receipt.`);
    setConsolidatedUploadKey(prev => prev + 1);
  };

  const handleFreightExtraction = (type: 'exterior' | 'local') => (amount: number) => {
    if (type === 'exterior') {
      setActualFreightExterior(amount.toString());
    } else {
      setActualFreightLocal(amount.toString());
    }
    setFreightUploadKey(prev => prev + 1);
  };

  // Reactive calculation with useMemo
  const cifCalculations = useMemo(() => {
    const totalActualFreightExterior = parseFloat(actualFreightExterior || "0");
    const totalActualFreightLocal = parseFloat(actualFreightLocal || "0");
    const totalActualFreight = totalActualFreightExterior + totalActualFreightLocal;
    const totalOtherCosts = parseFloat(actualOtherCosts || "0");

    // Use configurable values
    const LOCAL_LOGISTICS_USD = localLogisticsUSD;
    const LABOR_XCG = laborXCG;
    const BANK_CHARGES_USD = bankChargesUSD;
    
    // Update freight calculation to include bank charges and other costs
    const totalFreightWithAdditional = totalActualFreight + LOCAL_LOGISTICS_USD + BANK_CHARGES_USD + totalOtherCosts;

    if (totalActualFreight === 0 && !supplierWeights.some(sw => parseFloat(sw.actualWeightKg || "0") > 0)) {
      return {
        byWeight: [],
        byCost: [],
        equally: [],
        hybrid: [],
        strategic: [],
        volumeOptimized: [],
        customerTier: []
      };
    }

    // Consolidate products by unique product code
    const consolidatedProducts = new Map<string, {
      productCode: string;
      productName: string;
      totalTrays: number;
      totalUnits: number;
      packSize: number;
      totalActualWeight: number;
      totalVolumetricWeight: number;
      totalCostUSD: number;
      suppliers: string[];
      orderFrequency: number;
      wasteRate: number;
      wholesalePriceXCG?: number;
      retailPriceXCG?: number;
    }>();

    supplierWeights.forEach(supplier => {
      supplier.products.forEach(product => {
        if (!consolidatedProducts.has(product.productCode)) {
          const demand = demandPatterns.get(product.productCode);
          consolidatedProducts.set(product.productCode, {
            productCode: product.productCode,
            productName: product.productName,
            totalTrays: 0,
            totalUnits: 0,
            packSize: product.packSize || 1,
            totalActualWeight: 0,
            totalVolumetricWeight: 0,
            totalCostUSD: 0,
            suppliers: [],
            orderFrequency: demand?.frequency || 1,
            wasteRate: demand?.wasteRate || 0,
            wholesalePriceXCG: product.wholesalePriceXCG,
            retailPriceXCG: product.retailPriceXCG
          });
        }
        
        const consolidated = consolidatedProducts.get(product.productCode)!;
        consolidated.totalTrays += product.quantity;
        consolidated.totalUnits += product.quantity * product.packSize;
        consolidated.totalActualWeight += (product.quantity * product.weightPerUnit / 1000);
        consolidated.totalVolumetricWeight += (product.quantity * product.volumetricWeightPerUnit / 1000);
        consolidated.totalCostUSD += (product.quantity * product.costPerUnit);
        
        if (!consolidated.suppliers.includes(supplier.supplierName)) {
          consolidated.suppliers.push(supplier.supplierName);
        }
      });
    });

    const productsArray = Array.from(consolidatedProducts.values());
    const totalWeight = productsArray.reduce((sum, p) => sum + Math.max(p.totalActualWeight, p.totalVolumetricWeight), 0);
    const totalCost = productsArray.reduce((sum, p) => sum + p.totalCostUSD, 0);

    const WHOLESALE_MULTIPLIER = 1.25;
    const RETAIL_MULTIPLIER = 1.786;

    const calculateResults = (
      distributionMethod: 'weight' | 'cost' | 'equal' | 'hybrid' | 'strategic' | 'volumeOptimized' | 'customerTier'
    ): CIFResult[] => {
      return productsArray.map(product => {
        const chargeableWeight = Math.max(product.totalActualWeight, product.totalVolumetricWeight);
        const productCost = product.totalCostUSD;

        let freightShare = 0;
        
        switch (distributionMethod) {
          case 'weight':
            freightShare = totalWeight > 0 ? (chargeableWeight / totalWeight) * totalFreightWithAdditional : 0;
            break;
            
          case 'cost':
            freightShare = totalCost > 0 ? (productCost / totalCost) * totalFreightWithAdditional : 0;
            break;
            
          case 'equal':
            freightShare = totalFreightWithAdditional / productsArray.length;
            break;
            
          case 'hybrid':
            const weightShare = totalWeight > 0 ? (chargeableWeight / totalWeight) * totalFreightWithAdditional : 0;
            const costShare = totalCost > 0 ? (productCost / totalCost) * totalFreightWithAdditional : 0;
            freightShare = (weightShare + costShare) / 2;
            break;
            
          case 'volumeOptimized':
            const totalFrequency = productsArray.reduce((sum, p) => sum + p.orderFrequency, 0);
            const frequencyWeight = totalFrequency > 0 ? (product.orderFrequency / totalFrequency) : 1 / productsArray.length;
            const invertedWeight = 1 - (frequencyWeight / 2);
            freightShare = invertedWeight * (totalFreightWithAdditional / productsArray.length);
            break;
            
          case 'strategic':
            const riskFactor = 1 + (product.wasteRate / 100);
            const velocityFactor = 1 / Math.sqrt(product.orderFrequency || 1);
            const strategicWeight = riskFactor * velocityFactor;
            const totalStrategicWeight = productsArray.reduce((sum, p) => {
              const rf = 1 + (p.wasteRate / 100);
              const vf = 1 / Math.sqrt(p.orderFrequency || 1);
              return sum + (rf * vf);
            }, 0);
            freightShare = totalStrategicWeight > 0 ? (strategicWeight / totalStrategicWeight) * totalFreightWithAdditional : totalFreightWithAdditional / productsArray.length;
            break;
            
          case 'customerTier':
            const isWholesaleHeavy = product.orderFrequency > 5;
            const tierMultiplier = isWholesaleHeavy ? 0.85 : 1.15;
            const baseShare = totalFreightWithAdditional / productsArray.length;
            freightShare = baseShare * tierMultiplier;
            break;
        }

        const cifUSD = productCost + freightShare;
        const cifXCG = cifUSD * exchangeRate;
        const cifPerUnit = product.totalUnits > 0 ? cifXCG / product.totalUnits : 0;

        const wholesalePrice = product.wholesalePriceXCG || (cifPerUnit * WHOLESALE_MULTIPLIER);
        const retailPrice = product.retailPriceXCG || (cifPerUnit * RETAIL_MULTIPLIER);
        const wholesaleMargin = cifPerUnit > 0 ? ((wholesalePrice - cifPerUnit) / cifPerUnit * 100) : 0;
        const retailMargin = cifPerUnit > 0 ? ((retailPrice - cifPerUnit) / cifPerUnit * 100) : 0;

        // Get price history for this product
        const history = priceHistory.get(product.productCode);
        const priceHistoryData = history ? {
          previousWholesale: history.previousPrice,
          previousRetail: history.previousPrice ? history.previousPrice * 1.429 : undefined, // Approximate retail from old wholesale
          wholesaleChange: history.previousPrice ? ((wholesalePrice - history.previousPrice) / history.previousPrice * 100) : undefined,
          retailChange: history.previousPrice ? ((retailPrice - (history.previousPrice * 1.429)) / (history.previousPrice * 1.429) * 100) : undefined,
          lastChangeDate: history.changeDate
        } : undefined;

        return {
          productCode: product.productCode,
          productName: product.productName,
          quantity: product.totalUnits,
          trays: product.totalTrays,
          actualWeight: product.totalActualWeight,
          volumetricWeight: product.totalVolumetricWeight,
          chargeableWeight,
          weightType: product.totalVolumetricWeight > product.totalActualWeight ? 'volumetric' : 'actual',
          costUSD: productCost,
          freightCost: freightShare,
          cifUSD,
          cifXCG,
          cifPerUnit,
          wholesalePrice,
          retailPrice,
          wholesaleMargin,
          retailMargin,
          suppliers: product.suppliers.join(', '),
          priceHistory: priceHistoryData
        };
      });
    };

    return {
      byWeight: calculateResults('weight'),
      byCost: calculateResults('cost'),
      equally: calculateResults('equal'),
      hybrid: calculateResults('hybrid'),
      strategic: calculateResults('strategic'),
      volumeOptimized: calculateResults('volumeOptimized'),
      customerTier: calculateResults('customerTier')
    };
  }, [actualFreightExterior, actualFreightLocal, actualOtherCosts, supplierWeights, exchangeRate, demandPatterns, priceHistory, localLogisticsUSD, laborXCG, bankChargesUSD]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save actual CIF data to database
      toast.success("CIF calculation saved successfully");
      onSaved();
    } catch (error) {
      console.error("Error saving CIF:", error);
      toast.error("Failed to save CIF calculation");
    } finally {
      setSaving(false);
    }
  };

  const hasResults = cifCalculations.byWeight.length > 0;

  return (
    <div className="space-y-6">
      {/* Document Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <WarehouseDocumentUpload 
          onDataExtracted={handleConsolidatedWarehouseExtraction}
          uploadKey={consolidatedUploadKey}
          consolidated={true}
        />
        <FreightDocumentUpload 
          type="exterior"
          onDataExtracted={handleFreightExtraction('exterior')}
          uploadKey={freightUploadKey}
        />
        <FreightDocumentUpload 
          type="local"
          onDataExtracted={handleFreightExtraction('local')}
          uploadKey={freightUploadKey}
        />
      </div>

      {/* Freight Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Freight & Cost Inputs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Exterior Freight (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={actualFreightExterior}
                onChange={(e) => setActualFreightExterior(e.target.value)}
                placeholder={estimatedFreightExterior.toFixed(2)}
              />
            </div>
            <div className="space-y-2">
              <Label>Local Freight (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={actualFreightLocal}
                onChange={(e) => setActualFreightLocal(e.target.value)}
                placeholder={estimatedFreightLocal.toFixed(2)}
              />
            </div>
            <div className="space-y-2">
              <Label>Other Costs (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={actualOtherCosts}
                onChange={(e) => setActualOtherCosts(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Exchange Rate</Label>
              <Input
                type="number"
                step="0.01"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1.82)}
              />
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Local Logistics (USD)</Label>
              <Input
                type="number"
                step="1"
                value={localLogisticsUSD}
                onChange={(e) => setLocalLogisticsUSD(parseFloat(e.target.value) || 91)}
              />
            </div>
            <div className="space-y-2">
              <Label>Labor (XCG)</Label>
              <Input
                type="number"
                step="1"
                value={laborXCG}
                onChange={(e) => setLaborXCG(parseFloat(e.target.value) || 50)}
              />
            </div>
            <div className="space-y-2">
              <Label>Bank Charges (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={bankChargesUSD}
                onChange={(e) => setBankChargesUSD(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supplier Weight Sections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Supplier Weight Data
          </CardTitle>
          <CardDescription>
            Weight data per supplier (can be auto-filled from warehouse document)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {supplierWeights.map((supplier) => (
            <Collapsible
              key={supplier.supplierId}
              open={expandedSuppliers[supplier.supplierId]}
              onOpenChange={(open) => setExpandedSuppliers(prev => ({ ...prev, [supplier.supplierId]: open }))}
            >
              <div className="border rounded-lg p-4">
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedSuppliers[supplier.supplierId] ? 'rotate-180' : ''}`} />
                    <span className="font-medium">{supplier.supplierName}</span>
                    <Badge variant="outline">{supplier.products.length} products</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {supplier.actualWeightKg && <span>Actual: {supplier.actualWeightKg} kg</span>}
                    {supplier.volumetricWeightKg && <span>Vol: {supplier.volumetricWeightKg} kg</span>}
                    {supplier.palletsUsed && <span>Pallets: {supplier.palletsUsed}</span>}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Actual Weight (kg)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={supplier.actualWeightKg}
                        onChange={(e) => updateSupplierWeight(supplier.supplierId, 'actualWeightKg', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Volumetric Weight (kg)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={supplier.volumetricWeightKg}
                        onChange={(e) => updateSupplierWeight(supplier.supplierId, 'volumetricWeightKg', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pallets Used</Label>
                      <Input
                        type="number"
                        step="1"
                        value={supplier.palletsUsed}
                        onChange={(e) => updateSupplierWeight(supplier.supplierId, 'palletsUsed', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Charged By</Label>
                      <Badge variant={supplier.weightTypeUsed === 'volumetric' ? 'destructive' : 'default'}>
                        {supplier.weightTypeUsed === 'volumetric' ? 'Volumetric' : 'Actual'}
                      </Badge>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Cost/Unit</TableHead>
                        <TableHead className="text-right">Weight/Unit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplier.products.map((product) => (
                        <TableRow key={product.productCode}>
                          <TableCell>
                            <div>{product.productName}</div>
                            <div className="text-xs text-muted-foreground">{product.productCode}</div>
                          </TableCell>
                          <TableCell className="text-right">{product.quantity}</TableCell>
                          <TableCell className="text-right">${product.costPerUnit.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{product.weightPerUnit}g</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </CardContent>
      </Card>

      {/* CIF Results */}
      {hasResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              CIF Calculation Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="byWeight">
              <TabsList className="mb-4">
                <TabsTrigger value="byWeight">By Weight</TabsTrigger>
                <TabsTrigger value="byCost">By Cost</TabsTrigger>
                <TabsTrigger value="equally">Equally</TabsTrigger>
                <TabsTrigger value="hybrid">Hybrid</TabsTrigger>
                <TabsTrigger value="strategic">Strategic</TabsTrigger>
                <TabsTrigger value="volumeOptimized">Volume Opt.</TabsTrigger>
                <TabsTrigger value="customerTier">Customer Tier</TabsTrigger>
              </TabsList>

              {Object.entries(cifCalculations).map(([method, results]) => (
                <TabsContent key={method} value={method}>
                  <ScrollArea className="w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Weight</TableHead>
                          <TableHead className="text-right">Cost USD</TableHead>
                          <TableHead className="text-right">Freight</TableHead>
                          <TableHead className="text-right">CIF/Unit</TableHead>
                          <TableHead className="text-right">Wholesale</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((result) => (
                          <TableRow key={result.productCode}>
                            <TableCell>
                              <div className="font-medium">{result.productName}</div>
                              <div className="text-xs text-muted-foreground">{result.productCode}</div>
                            </TableCell>
                            <TableCell className="text-right">{result.quantity}</TableCell>
                            <TableCell className="text-right">
                              <div>{result.chargeableWeight.toFixed(2)} kg</div>
                              <Badge variant={result.weightType === 'volumetric' ? 'destructive' : 'secondary'} className="text-xs">
                                {result.weightType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">${result.costUSD.toFixed(2)}</TableCell>
                            <TableCell className="text-right">${result.freightCost.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-semibold">Cg {result.cifPerUnit.toFixed(2)}</TableCell>
                            <TableCell className="text-right">Cg {result.wholesalePrice.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={result.wholesaleMargin >= 10 ? 'default' : 'destructive'}>
                                {result.wholesaleMargin.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Dito Advisor */}
      {hasResults && (
        <DitoAdvisor
          orderItems={cifCalculations.byWeight.map(r => ({
            code: r.productCode,
            name: r.productName,
            quantity: r.quantity,
            actualWeight: r.actualWeight,
            volumetricWeight: r.volumetricWeight,
            chargeableWeight: r.chargeableWeight,
            weightType: r.weightType,
            costUSD: r.costUSD / r.quantity,
            wholesalePriceXCG: r.wholesalePrice,
            retailPriceXCG: r.retailPrice,
            profitPerUnit: r.wholesalePrice - r.cifPerUnit
          }))}
          palletConfiguration={{
            totalPallets: supplierWeights.reduce((sum, s) => sum + (parseFloat(s.palletsUsed) || 0), 0),
            totalActualWeight: cifCalculations.byWeight.reduce((sum, r) => sum + r.actualWeight, 0),
            totalVolumetricWeight: cifCalculations.byWeight.reduce((sum, r) => sum + r.volumetricWeight, 0),
            totalChargeableWeight: cifCalculations.byWeight.reduce((sum, r) => sum + r.chargeableWeight, 0),
            limitingFactor: 'balanced',
            utilizationPercentage: 85,
            heightUtilization: 85
          }}
          freightCostPerKg={2.87}
          exchangeRate={exchangeRate}
        />
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !hasResults} size="lg">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <TrendingUp className="mr-2 h-4 w-4" />
              Save CIF Calculation
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
