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
import { Loader2, Package, Upload, DollarSign, TrendingUp, Calculator, ChevronDown } from "lucide-react";
import { WarehouseDocumentUpload } from "./WarehouseDocumentUpload";
import { FreightDocumentUpload } from "./FreightDocumentUpload";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DitoAdvisor } from "./DitoAdvisor";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
      const { data: demandData } = await supabase
        .from('demand_patterns')
        .select('product_code, order_frequency, avg_waste_rate')
        .in('product_code', productCodes);

      const demandMap = new Map(
        demandData?.map(d => [d.product_code, {
          frequency: d.order_frequency || 1,
          wasteRate: d.avg_waste_rate || 0
        }]) || []
      );
      setDemandPatterns(demandMap);

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
            freightShare = totalWeight > 0 ? (chargeableWeight / totalWeight) * totalActualFreight : 0;
            break;
            
          case 'cost':
            freightShare = totalCost > 0 ? (productCost / totalCost) * totalActualFreight : 0;
            break;
            
          case 'equal':
            freightShare = totalActualFreight / productsArray.length;
            break;
            
          case 'hybrid':
            const weightShare = totalWeight > 0 ? (chargeableWeight / totalWeight) * totalActualFreight : 0;
            const costShare = totalCost > 0 ? (productCost / totalCost) * totalActualFreight : 0;
            freightShare = (weightShare + costShare) / 2;
            break;
            
          case 'volumeOptimized':
            const totalFrequency = productsArray.reduce((sum, p) => sum + p.orderFrequency, 0);
            const frequencyWeight = totalFrequency > 0 ? (product.orderFrequency / totalFrequency) : 1 / productsArray.length;
            const invertedWeight = 1 - (frequencyWeight / 2);
            freightShare = invertedWeight * (totalActualFreight / productsArray.length);
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
            freightShare = totalStrategicWeight > 0 ? (strategicWeight / totalStrategicWeight) * totalActualFreight : totalActualFreight / productsArray.length;
            break;
            
          case 'customerTier':
            const isWholesaleHeavy = product.orderFrequency > 5;
            const tierMultiplier = isWholesaleHeavy ? 0.85 : 1.15;
            const baseShare = totalActualFreight / productsArray.length;
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
          suppliers: product.suppliers.join(', ')
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
  }, [actualFreightExterior, actualFreightLocal, actualOtherCosts, supplierWeights, exchangeRate, demandPatterns]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const totalActualFreight = 
        parseFloat(actualFreightExterior || "0") + 
        parseFloat(actualFreightLocal || "0");
      const totalEstimatedFreight = estimatedFreightExterior + estimatedFreightLocal;
      const calculations = cifCalculations.byWeight; // Save "by weight" as default

      // Save each product's actual CIF data using UPSERT
      for (const calc of calculations) {
        const { error } = await supabase.from("cif_estimates").upsert(
          {
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
            chargeable_weight_kg: calc.chargeableWeight,
            weight_type_used: calc.weightType,
            variance_amount_usd: totalActualFreight - totalEstimatedFreight,
            variance_percentage: totalEstimatedFreight > 0 
              ? ((totalActualFreight - totalEstimatedFreight) / totalEstimatedFreight) * 100 
              : 0,
            actual_cif_xcg: calc.cifXCG
          },
          {
            onConflict: 'order_id,product_code',
            ignoreDuplicates: false
          }
        );

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

  const renderTable = (results: CIFResult[], title: string, description?: string) => {
    if (!results || results.length === 0) return null;

    // Group results by supplier
    const groupedBySupplier = results.reduce((acc, result) => {
      const suppliers = result.suppliers.split(', ');
      suppliers.forEach(supplier => {
        if (!acc[supplier]) {
          acc[supplier] = [];
        }
        acc[supplier].push(result);
      });
      return acc;
    }, {} as Record<string, CIFResult[]>);

    // Calculate subtotals per supplier
    const supplierSubtotals = Object.entries(groupedBySupplier).map(([supplier, products]) => ({
      supplier,
      totalUnits: products.reduce((sum, p) => sum + p.quantity, 0),
      totalTrays: products.reduce((sum, p) => sum + p.trays, 0),
      totalCostUSD: products.reduce((sum, p) => sum + p.costUSD, 0),
      totalFreight: products.reduce((sum, p) => sum + p.freightCost, 0),
      totalCIFUSD: products.reduce((sum, p) => sum + p.cifUSD, 0),
      totalCIFXCG: products.reduce((sum, p) => sum + p.cifXCG, 0)
    }));

    const toggleSupplier = (supplier: string) => {
      setExpandedSuppliers(prev => ({
        ...prev,
        [supplier]: !prev[supplier]
      }));
    };

    return (
      <div>
        <div className="mb-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Actual (kg)</TableHead>
                <TableHead className="text-right">Vol. (kg)</TableHead>
                <TableHead className="text-right">Chargeable</TableHead>
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
              {Object.entries(groupedBySupplier).map(([supplier, products]) => {
                const isExpanded = expandedSuppliers[supplier] ?? true;
                const subtotal = supplierSubtotals.find(s => s.supplier === supplier);
                
                return (
                  <>
                    {/* Supplier Header Row */}
                    <TableRow 
                      key={`${supplier}-header`}
                      className="bg-muted/50 hover:bg-muted cursor-pointer border-t-2 border-b"
                      onClick={() => toggleSupplier(supplier)}
                    >
                      <TableCell colSpan={16} className="font-semibold">
                        <div className="flex items-center gap-2">
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform duration-200 ${
                              isExpanded ? 'transform rotate-0' : 'transform -rotate-90'
                            }`}
                          />
                          <span>{supplier}</span>
                          <span className="text-muted-foreground text-sm ml-2">
                            ({products.length} {products.length === 1 ? 'product' : 'products'})
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {/* Product Rows */}
                    {isExpanded && products.map((result) => {
                      const wholesaleMarginPercent = result.cifPerUnit > 0 
                        ? ((result.wholesalePrice - result.cifPerUnit) / result.cifPerUnit * 100)
                        : 0;
                      const retailMarginPercent = result.cifPerUnit > 0
                        ? ((result.retailPrice - result.cifPerUnit) / result.cifPerUnit * 100)
                        : 0;

                      return (
                        <TableRow key={`${supplier}-${result.productCode}`}>
                          <TableCell className="font-medium">
                            <div>{result.productName}</div>
                            <div className="text-xs text-muted-foreground">{result.productCode}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-medium">{result.quantity}</div>
                            <div className="text-xs text-muted-foreground">{result.trays} trays</div>
                          </TableCell>
                          <TableCell className="text-right">{result.actualWeight.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{result.volumetricWeight.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {result.chargeableWeight.toFixed(2)}
                            {result.weightType === 'volumetric' && <span className="text-xs text-orange-600 ml-1">V</span>}
                          </TableCell>
                          <TableCell className="text-right">${result.costUSD.toFixed(2)}</TableCell>
                          <TableCell className="text-right">${result.freightCost.toFixed(2)}</TableCell>
                          <TableCell className="text-right">${result.cifUSD.toFixed(2)}</TableCell>
                          <TableCell className="text-right">Cg {result.cifXCG.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold">
                            Cg {result.cifPerUnit.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">Cg {result.wholesalePrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-green-600">
                            Cg {result.wholesaleMargin.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-semibold">
                            {wholesaleMarginPercent.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right">Cg {result.retailPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-green-600">
                            Cg {result.retailMargin.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-semibold">
                            {retailMarginPercent.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    
                    {/* Supplier Subtotal Row */}
                    {isExpanded && subtotal && (
                      <TableRow key={`${supplier}-subtotal`} className="bg-muted/30 font-semibold border-b-2">
                        <TableCell className="text-right">
                          Subtotal: {supplier}
                        </TableCell>
                        <TableCell className="text-right">
                          <div>{subtotal.totalUnits}</div>
                          <div className="text-xs text-muted-foreground font-normal">
                            {subtotal.totalTrays} trays
                          </div>
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right">
                          ${subtotal.totalCostUSD.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${subtotal.totalFreight.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${subtotal.totalCIFUSD.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          Cg {subtotal.totalCIFXCG.toFixed(2)}
                        </TableCell>
                        <TableCell colSpan={7}></TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
              
              {/* Grand Total Row */}
              <TableRow className="bg-primary/10 font-bold border-t-4">
                <TableCell className="text-right">GRAND TOTAL</TableCell>
                <TableCell className="text-right">
                  <div>{results.reduce((sum, r) => sum + r.quantity, 0)}</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    {results.reduce((sum, r) => sum + r.trays, 0)} trays
                  </div>
                </TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">
                  ${results.reduce((sum, r) => sum + r.costUSD, 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  ${results.reduce((sum, r) => sum + r.freightCost, 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  ${results.reduce((sum, r) => sum + r.cifUSD, 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  Cg {results.reduce((sum, r) => sum + r.cifXCG, 0).toFixed(2)}
                </TableCell>
                <TableCell colSpan={7}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    );
  };

  const hasData = actualFreightExterior || actualFreightLocal || supplierWeights.some(sw => sw.actualWeightKg);

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
              onDataExtracted={handleFreightExtraction('exterior')}
              uploadKey={freightUploadKey}
            />
            <FreightDocumentUpload 
              type="local" 
              onDataExtracted={handleFreightExtraction('local')}
              uploadKey={freightUploadKey}
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

      {/* Consolidated Warehouse Document Upload */}
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            <CardTitle>Upload Consolidated Warehouse Receipt</CardTitle>
          </div>
          <CardDescription>
            Upload the consolidated warehouse receipt containing all suppliers to automatically populate weight data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WarehouseDocumentUpload
            onDataExtracted={handleConsolidatedWarehouseExtraction}
            uploadKey={consolidatedUploadKey}
            consolidated={true}
          />
        </CardContent>
      </Card>

      {/* Supplier Weight Data - Manual Entry */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            <CardTitle>Supplier Weight Data</CardTitle>
          </div>
          <CardDescription>
            Review and adjust weight data for each supplier (auto-populated from document upload)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={supplierWeights[0]?.supplierId} className="w-full">
            <TabsList className="w-full justify-start flex-wrap">
              {supplierWeights.map(sw => (
                <TabsTrigger key={sw.supplierId} value={sw.supplierId}>
                  {sw.supplierName}
                </TabsTrigger>
              ))}
            </TabsList>

            {supplierWeights.map(supplier => (
              <TabsContent key={supplier.supplierId} value={supplier.supplierId} className="space-y-4">
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
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Actual CIF Calculations with 7 Methods */}
      {hasData && cifCalculations.byWeight.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  <CardTitle>Actual CIF Results - 7 Allocation Methods</CardTitle>
                </div>
                <CardDescription>Compare different freight allocation strategies using actual costs</CardDescription>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Actual CIF'
                )}
              </Button>
            </div>
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
                <div className="text-xs text-muted-foreground">Total Freight</div>
                <div className="text-lg font-bold text-primary">
                  ${(parseFloat(actualFreightExterior || "0") + parseFloat(actualFreightLocal || "0") + parseFloat(actualOtherCosts || "0")).toFixed(2)}
                </div>
              </div>
            </div>

            <Separator />

            {/* 7 Allocation Methods Tabs */}
            <Tabs defaultValue="byWeight">
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="byWeight">By Weight</TabsTrigger>
                <TabsTrigger value="byCost">By Cost</TabsTrigger>
                <TabsTrigger value="equally">Equally</TabsTrigger>
                <TabsTrigger value="hybrid">Hybrid</TabsTrigger>
                <TabsTrigger value="strategic">Strategic</TabsTrigger>
                <TabsTrigger value="volumeOptimized">Volume Opt.</TabsTrigger>
                <TabsTrigger value="customerTier">Cust. Tier</TabsTrigger>
              </TabsList>

              <TabsContent value="byWeight">
                {renderTable(cifCalculations.byWeight, "By Weight", "Freight allocated proportional to chargeable weight")}
              </TabsContent>

              <TabsContent value="byCost">
                {renderTable(cifCalculations.byCost, "By Cost", "Freight allocated proportional to product cost")}
              </TabsContent>

              <TabsContent value="equally">
                {renderTable(cifCalculations.equally, "Equally", "Freight split equally among all products")}
              </TabsContent>

              <TabsContent value="hybrid">
                {renderTable(cifCalculations.hybrid, "Hybrid", "50% weight-based + 50% cost-based allocation")}
              </TabsContent>

              <TabsContent value="strategic">
                {renderTable(cifCalculations.strategic, "Strategic", "AI-driven: considers waste rates and order velocity")}
              </TabsContent>

              <TabsContent value="volumeOptimized">
                {renderTable(cifCalculations.volumeOptimized, "Volume Optimized", "Favors high-frequency products with lower freight allocation")}
              </TabsContent>

              <TabsContent value="customerTier">
                {renderTable(cifCalculations.customerTier, "Customer Tier", "Wholesale products get preferential freight rates")}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Dito Advisor Integration */}
      {hasData && cifCalculations.byWeight.length > 0 && (
        <DitoAdvisor
          orderItems={cifCalculations.byWeight.map(calc => ({
            code: calc.productCode,
            name: calc.productName,
            quantity: calc.quantity,
            actualWeight: calc.actualWeight,
            volumetricWeight: calc.volumetricWeight,
            chargeableWeight: calc.chargeableWeight,
            weightType: calc.weightType,
            costUSD: calc.costUSD,
            wholesalePriceXCG: calc.wholesalePrice,
            retailPriceXCG: calc.retailPrice,
            profitPerUnit: calc.wholesaleMargin
          }))}
          palletConfiguration={{
            totalPallets: supplierWeights.reduce((sum, sw) => sum + parseFloat(sw.palletsUsed || "0"), 0),
            totalActualWeight: cifCalculations.byWeight.reduce((sum, c) => sum + c.actualWeight, 0),
            totalVolumetricWeight: cifCalculations.byWeight.reduce((sum, c) => sum + c.volumetricWeight, 0),
            totalChargeableWeight: cifCalculations.byWeight.reduce((sum, c) => sum + c.chargeableWeight, 0),
            limitingFactor: cifCalculations.byWeight.some(c => c.weightType === 'volumetric') ? 'volumetric_weight' : 'actual_weight',
            utilizationPercentage: 85,
            heightUtilization: 90
          }}
          freightCostPerKg={(parseFloat(actualFreightExterior || "0") + parseFloat(actualFreightLocal || "0")) / cifCalculations.byWeight.reduce((sum, c) => sum + c.chargeableWeight, 0)}
          exchangeRate={exchangeRate}
        />
      )}
    </div>
  );
}