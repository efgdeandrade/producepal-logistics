import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Calculator, Award, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface OrderItem {
  product_code: string;
  quantity: number;
}

interface CIFResult {
  productCode: string;
  productName: string;
  quantity: number;
  trays: number;
  actualWeight: number;
  volumetricWeight: number;
  totalWeight: number;
  weightType: 'actual' | 'volumetric';
  costUSD: number;
  freightCost: number;
  cifUSD: number;
  cifXCG: number;
  cifPerUnit: number;
  wholesalePrice: number;
  retailPrice: number;
  wholesaleMargin: number;
  retailMargin: number;
  supplier: string;
  priceHistory?: {
    previousWholesale?: number;
    previousRetail?: number;
    wholesaleChange?: number;
    retailChange?: number;
    lastChangeDate?: string;
  };
}

interface OrderCIFTableProps {
  orderItems: OrderItem[];
  recommendedMethod?: string;
}

const EXCHANGE_RATE_KEY = 'cif_exchange_rate';
const DEFAULT_EXCHANGE_RATE = 1.82;

export const OrderCIFTable = ({ orderItems, recommendedMethod }: OrderCIFTableProps) => {
  const [cifResults, setCifResults] = useState<{
    byWeight: CIFResult[];
    byCost: CIFResult[];
    equally: CIFResult[];
    hybrid: CIFResult[];
    strategic: CIFResult[];
    volumeOptimized: CIFResult[];
    customerTier: CIFResult[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [productsWeightData, setProductsWeightData] = useState<any[]>([]);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});
  const [priceHistory, setPriceHistory] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    calculateCIF();
  }, [orderItems]);

  const calculateCIF = async () => {
    try {
      setLoading(true);

      // Consolidate products by code
      const consolidatedItems = orderItems.reduce((acc, item) => {
        const existing = acc.find(i => i.product_code === item.product_code);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          acc.push({ ...item });
        }
        return acc;
      }, [] as OrderItem[]);

      // Fetch settings
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('*')
        .in('key', ['freight_exterior_tariff', 'freight_local_tariff', 'usd_to_xcg_rate', 'local_logistics_usd', 'labor_xcg']);

      if (settingsError) throw settingsError;

      const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);
      const exchangeRate = (settingsMap.get('usd_to_xcg_rate') as any)?.rate || DEFAULT_EXCHANGE_RATE;
      const freightExteriorPerKg = (settingsMap.get('freight_exterior_tariff') as any)?.rate || 2.46;
      const freightLocalPerKg = (settingsMap.get('freight_local_tariff') as any)?.rate || 0.41;
      const localLogisticsUsd = Number(settingsMap.get('local_logistics_usd')) || 91;
      const laborXcg = Number(settingsMap.get('labor_xcg')) || 50;

      // Fetch product data with supplier information
      const productCodes = [...new Set(consolidatedItems.map(item => item.product_code))];
      const [productsRes, demandRes, priceHistoryRes] = await Promise.all([
        supabase.from('products')
          .select('code, name, price_usd_per_unit, netto_weight_per_unit, gross_weight_per_unit, pack_size, empty_case_weight, wholesale_price_xcg_per_unit, retail_price_xcg_per_unit, length_cm, width_cm, height_cm, volumetric_weight_kg, supplier_id, suppliers(name)')
          .in('code', productCodes),
        supabase.from('demand_patterns')
          .select('product_code, order_frequency, avg_waste_rate')
          .in('product_code', productCodes),
        supabase.from('product_price_history')
          .select('product_code, old_price_xcg_per_unit, new_price_xcg_per_unit, created_at')
          .in('product_code', productCodes)
          .order('created_at', { ascending: false })
      ]);

      const { data: products, error } = productsRes;
      if (error) throw error;

      // Fetch historical order frequency for volume-optimized method
      const { data: demandPatterns } = demandRes;

      const demandMap = new Map(
        demandPatterns?.map(d => [d.product_code, {
          frequency: d.order_frequency || 1,
          wasteRate: d.avg_waste_rate || 0
        }]) || []
      );

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

      const productMap = new Map(
        products?.map(p => {
          const packSize = p.pack_size || 1;
          const weightPerUnit = (p.gross_weight_per_unit && p.gross_weight_per_unit > 0) 
            ? p.gross_weight_per_unit 
            : (p.netto_weight_per_unit || 0);
          const emptyCaseWeight = p.empty_case_weight || 0;
          
          // Calculate volumetric weight per unit if dimensions exist
          const volumetricWeightPerUnit = p.volumetric_weight_kg || 
            (p.length_cm && p.width_cm && p.height_cm 
              ? (p.length_cm * p.width_cm * p.height_cm) / 6000
              : 0);
          
          // Chargeable weight is the greater of actual or volumetric
          const chargeableWeightPerUnit = Math.max(weightPerUnit, volumetricWeightPerUnit);
          
          return [
            p.code,
            {
              name: p.name,
              costPerUnit: p.price_usd_per_unit || 0,
              weightPerUnit: weightPerUnit,
              volumetricWeightPerUnit: volumetricWeightPerUnit,
              chargeableWeightPerUnit: chargeableWeightPerUnit,
              packSize: packSize,
              emptyCaseWeight: emptyCaseWeight,
              wholesalePriceXCG: p.wholesale_price_xcg_per_unit || 0,
              retailPriceXCG: p.retail_price_xcg_per_unit || 0,
              supplier: (p.suppliers as any)?.name || 'Unknown Supplier',
            },
          ];
        }) || []
      );

      const LOCAL_LOGISTICS_XCG = 50;
      const LOCAL_LOGISTICS_USD = 91;
      const LABOR_XCG = 50;
      const WHOLESALE_MULTIPLIER = 1.25;
      const RETAIL_MULTIPLIER = 1.786;

      // Prepare products with data
      const productsWithData = consolidatedItems.map(item => {
        const productData = productMap.get(item.product_code);
        const packSize = productData?.packSize || 1;
        const totalUnits = item.quantity * packSize;
        const demand = demandMap.get(item.product_code);
        
        return {
          code: item.product_code,
          name: productData?.name || item.product_code,
          numberOfCases: item.quantity,
          totalUnits: totalUnits,
          costPerUnit: productData?.costPerUnit || 0,
          weightPerUnit: productData?.weightPerUnit || 0,
          volumetricWeightPerUnit: productData?.volumetricWeightPerUnit || 0,
          chargeableWeightPerUnit: productData?.chargeableWeightPerUnit || 0,
          emptyCaseWeight: productData?.emptyCaseWeight || 0,
          wholesalePriceXCG: productData?.wholesalePriceXCG || 0,
          retailPriceXCG: productData?.retailPriceXCG || 0,
          orderFrequency: demand?.frequency || 1,
          wasteRate: demand?.wasteRate || 0,
          supplier: productData?.supplier || 'Unknown Supplier',
        };
      });

      // Calculate weights using chargeable weight (max of actual vs volumetric)
      const productsWithWeight = productsWithData.map(p => {
        const actualProductWeight = (p.totalUnits * p.weightPerUnit / 1000);
        const volumetricProductWeight = (p.totalUnits * p.volumetricWeightPerUnit / 1000);
        const caseWeight = (p.numberOfCases * p.emptyCaseWeight / 1000);
        
        // Total weight is chargeable weight of products + case weight
        const productWeight = Math.max(actualProductWeight, volumetricProductWeight) + caseWeight;
        
        return { 
          ...p, 
          totalWeight: productWeight,
          actualWeight: actualProductWeight + caseWeight,
          volumetricWeight: volumetricProductWeight + caseWeight,
          weightType: volumetricProductWeight > actualProductWeight ? 'volumetric' : 'actual'
        };
      });

      const totalWeight = productsWithWeight.reduce((sum, p) => sum + p.totalWeight, 0);
      const totalCost = productsWithWeight.reduce((sum, p) => sum + (p.totalUnits * p.costPerUnit), 0);
      const combinedTariffPerKg = freightExteriorPerKg + freightLocalPerKg;
      const totalFreightCost = totalWeight * combinedTariffPerKg;
      
      // Europallet constraints
      const PALLET_WEIGHT_KG = 26;
      const PALLET_LENGTH_CM = 120;
      const PALLET_WIDTH_CM = 80;
      const MAX_HEIGHT_CM = 155;
      
      // Calculate total pallets needed (simple estimation based on weight)
      const estimatedPalletsNeeded = Math.ceil(totalWeight / 500); // ~500kg per pallet typical
      const palletWeightTotal = estimatedPalletsNeeded * PALLET_WEIGHT_KG;
      const totalFreight = localLogisticsUsd + totalFreightCost + (palletWeightTotal * combinedTariffPerKg);

      const calculateResults = (
        distributionMethod: 'weight' | 'cost' | 'equal' | 'hybrid' | 'strategic' | 'volumeOptimized' | 'customerTier'
      ): CIFResult[] => {
        return productsWithWeight.map(product => {
          const productCost = product.totalUnits * product.costPerUnit;

          let freightShare = 0;
          
          switch (distributionMethod) {
            case 'weight':
              freightShare = totalWeight > 0 ? (product.totalWeight / totalWeight) * totalFreight : 0;
              break;
              
            case 'cost':
              freightShare = totalCost > 0 ? (productCost / totalCost) * totalFreight : 0;
              break;
              
            case 'equal':
              freightShare = totalFreight / productsWithWeight.length;
              break;
              
            case 'hybrid':
              // 50% by weight + 50% by cost
              const weightShare = totalWeight > 0 ? (product.totalWeight / totalWeight) * totalFreight : 0;
              const costShare = totalCost > 0 ? (productCost / totalCost) * totalFreight : 0;
              freightShare = (weightShare + costShare) / 2;
              break;
              
            case 'volumeOptimized':
              // Products with higher order frequency get preferential rates (lower freight allocation)
              const totalFrequency = productsWithWeight.reduce((sum, p) => sum + p.orderFrequency, 0);
              const frequencyWeight = totalFrequency > 0 ? (product.orderFrequency / totalFrequency) : 1 / productsWithWeight.length;
              // Invert the weight so higher frequency = lower freight
              const invertedWeight = 1 - (frequencyWeight / 2);
              freightShare = invertedWeight * (totalFreight / productsWithWeight.length);
              break;
              
            case 'strategic':
              // AI-driven: Products with high waste rate get less freight, fast movers get less freight
              const riskFactor = 1 + (product.wasteRate / 100);
              const velocityFactor = 1 / Math.sqrt(product.orderFrequency || 1);
              const strategicWeight = riskFactor * velocityFactor;
              const totalStrategicWeight = productsWithWeight.reduce((sum, p) => {
                const rf = 1 + (p.wasteRate / 100);
                const vf = 1 / Math.sqrt(p.orderFrequency || 1);
                return sum + (rf * vf);
              }, 0);
              freightShare = totalStrategicWeight > 0 ? (strategicWeight / totalStrategicWeight) * totalFreight : totalFreight / productsWithWeight.length;
              break;
              
            case 'customerTier':
              // Wholesale products (high volume) get lower freight allocation
              // Assume products with higher order frequency are wholesale-heavy
              const isWholesaleHeavy = product.orderFrequency > 5;
              const tierMultiplier = isWholesaleHeavy ? 0.85 : 1.15;
              const baseShare = totalFreight / productsWithWeight.length;
              freightShare = baseShare * tierMultiplier;
              break;
          }

          const cifUSD = productCost + freightShare;
          const cifXCG = cifUSD * exchangeRate + laborXcg / productsWithWeight.length;
          const cifPerUnit = product.totalUnits > 0 ? cifXCG / product.totalUnits : 0;

          const wholesalePrice = product.wholesalePriceXCG || (cifPerUnit * WHOLESALE_MULTIPLIER);
          const retailPrice = product.retailPriceXCG || (cifPerUnit * RETAIL_MULTIPLIER);
          const wholesaleMargin = wholesalePrice - cifPerUnit;
          const retailMargin = retailPrice - cifPerUnit;

          // Get price history for this product
          const history = priceHistory.get(product.code);
          const priceHistoryData = history ? {
            previousWholesale: history.previousPrice,
            previousRetail: history.previousPrice ? history.previousPrice * 1.429 : undefined,
            wholesaleChange: history.previousPrice ? ((wholesalePrice - history.previousPrice) / history.previousPrice * 100) : undefined,
            retailChange: history.previousPrice ? ((retailPrice - (history.previousPrice * 1.429)) / (history.previousPrice * 1.429) * 100) : undefined,
            lastChangeDate: history.changeDate
          } : undefined;

          return {
            productCode: product.code,
            productName: product.name,
            quantity: product.totalUnits,
            trays: product.numberOfCases,
            actualWeight: product.actualWeight,
            volumetricWeight: product.volumetricWeight,
            totalWeight: product.totalWeight,
            weightType: product.weightType as 'actual' | 'volumetric',
            costUSD: productCost,
            freightCost: freightShare,
            cifUSD,
            cifXCG,
            cifPerUnit,
            wholesalePrice,
            retailPrice,
            wholesaleMargin,
            retailMargin,
            supplier: product.supplier,
            priceHistory: priceHistoryData
          };
        });
      };

      setCifResults({
        byWeight: calculateResults('weight'),
        byCost: calculateResults('cost'),
        equally: calculateResults('equal'),
        hybrid: calculateResults('hybrid'),
        strategic: calculateResults('strategic'),
        volumeOptimized: calculateResults('volumeOptimized'),
        customerTier: calculateResults('customerTier'),
      });
      
      // Store weight data for display
      setProductsWeightData(productsWithWeight);
    } catch (error: any) {
      console.error('Error calculating CIF:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTable = (results: CIFResult[], title: string, description?: string) => {
    if (!results || results.length === 0) return null;

    // Group results by supplier
    const groupedBySupplier = results.reduce((acc, result) => {
      const supplier = result.supplier || 'Unknown Supplier';
      if (!acc[supplier]) {
        acc[supplier] = [];
      }
      acc[supplier].push(result);
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
        <div className="w-full max-h-[600px] overflow-auto border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
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
                    {isExpanded && products.map((result, idx) => {
                      const wholesaleMarginPercent = result.cifPerUnit > 0 
                        ? ((result.wholesalePrice - result.cifPerUnit) / result.cifPerUnit * 100)
                        : 0;
                      const retailMarginPercent = result.cifPerUnit > 0
                        ? ((result.retailPrice - result.cifPerUnit) / result.cifPerUnit * 100)
                        : 0;

                      return (
                        <TableRow key={`${supplier}-${result.productCode}-${idx}`}>
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
                            {result.totalWeight.toFixed(2)}
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
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span>Cg {result.retailPrice.toFixed(2)}</span>
                              {result.priceHistory?.retailChange && (
                                <span className={`text-xs ${result.priceHistory.retailChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {result.priceHistory.retailChange > 0 ? '↑' : '↓'}
                                  {Math.abs(result.priceHistory.retailChange).toFixed(1)}%
                                </span>
                              )}
                            </div>
                            {result.priceHistory?.previousRetail && (
                              <div className="text-xs text-muted-foreground">
                                Was: Cg {result.priceHistory.previousRetail.toFixed(2)}
                              </div>
                            )}
                          </TableCell>
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
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            CIF Calculations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calculator className="h-12 w-12 animate-pulse text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Calculating CIF with 7 allocation methods...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!cifResults) {
    return null;
  }

  const methodDescriptions = {
    byWeight: "Freight allocated proportionally to product weight (kg). Heavier products pay more.",
    byCost: "Freight allocated proportionally to product cost (USD). More expensive products pay more.",
    equally: "Freight split equally across all products regardless of weight or cost.",
    hybrid: "Balanced approach: 50% by weight + 50% by cost. Combines both factors.",
    strategic: "AI-driven allocation based on waste rate and order velocity. High-risk/slow products pay less.",
    volumeOptimized: "Fast-moving products (high order frequency) get preferential rates.",
    customerTier: "Wholesale-heavy products (high volume) absorb less freight cost."
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          CIF Calculations (7 Methods)
        </CardTitle>
        <CardDescription>
          Cost, Insurance, and Freight calculations using multiple allocation strategies
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recommendedMethod && cifResults && (
          <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Profit Comparison</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {Object.entries(cifResults).map(([method, results]) => (
                <div key={method}>
                  <p className="text-muted-foreground capitalize">{method.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="font-semibold">
                    Cg {results.reduce((sum, r) => sum + (r.wholesaleMargin * r.quantity), 0).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Tabs defaultValue="weight" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7 mb-6">
            {Object.keys(cifResults).map(method => (
              <TabsTrigger key={method} value={method} className="relative text-xs">
                {method === 'byWeight' && 'Weight'}
                {method === 'byCost' && 'Cost'}
                {method === 'equally' && 'Equal'}
                {method === 'hybrid' && 'Hybrid'}
                {method === 'strategic' && 'Strategic'}
                {method === 'volumeOptimized' && 'Volume'}
                {method === 'customerTier' && 'Customer'}
                {recommendedMethod === method && (
                  <Badge variant="default" className="ml-1 text-[9px] px-1 py-0">
                    ✓
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(cifResults).map(([method, results]) => (
            <TabsContent key={method} value={method}>
              {renderTable(
                results, 
                method.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase()),
                methodDescriptions[method as keyof typeof methodDescriptions]
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};