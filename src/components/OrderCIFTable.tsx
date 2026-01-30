import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Calculator, Award, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { VolumetricWeightAlert } from './VolumetricWeightAlert';
import { CIFVerificationBadges } from './CIFVerificationBadges';
import { CIFBreakdownPanel } from './CIFBreakdownPanel';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  CIFProductInput,
  CIFParams,
  CIFResult as BaseCIFResult,
  DistributionMethod,
  calculateCIFByMethod,
  calculateTotalFreightFromRates,
  determineLimitingFactor,
  DEFAULT_WHOLESALE_MULTIPLIER,
  DEFAULT_RETAIL_MULTIPLIER,
  DEFAULT_LOCAL_LOGISTICS_USD,
} from '@/lib/cifCalculations';
import {
  validateCIFInput,
  verifyFreightAllocation,
  verifyMargins,
  type ValidationResult,
  type MarginIssue,
} from '@/lib/cifValidator';

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
  const [targetWholesaleMargin, setTargetWholesaleMargin] = useState(10);
  const [targetRetailMargin, setTargetRetailMargin] = useState(44);
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE);
  const [combinedTariffPerKg, setCombinedTariffPerKg] = useState(0);
  const [volumetricAlertData, setVolumetricAlertData] = useState<{
    isChargedByVolumetric: boolean;
    weightGapKg: number;
    weightGapPercent: number;
    totalActualWeight: number;
    totalVolumetricWeight: number;
    totalChargeableWeight: number;
  } | null>(null);
  
  // Validation and verification state
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [freightVerification, setFreightVerification] = useState<{
    valid: boolean;
    allocatedTotal: number;
    totalFreight: number;
    percentageDifference: number;
  } | null>(null);
  const [marginIssues, setMarginIssues] = useState<MarginIssue[]>([]);
  const [totalFreight, setTotalFreight] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);

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
        .in('key', ['freight_exterior_tariff', 'freight_local_tariff', 'usd_to_xcg_rate', 'local_logistics_usd', 'labor_xcg', 'target_wholesale_margin_percent', 'target_retail_margin_percent']);

      if (settingsError) throw settingsError;

      const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);
      const exchangeRateValue = (settingsMap.get('usd_to_xcg_rate') as any)?.rate || DEFAULT_EXCHANGE_RATE;
      const freightExteriorPerKg = (settingsMap.get('freight_exterior_tariff') as any)?.rate || 2.46;
      const freightLocalPerKg = (settingsMap.get('freight_local_tariff') as any)?.rate || 0.41;
      const localLogisticsUsd = Number(settingsMap.get('local_logistics_usd')) || 91;
      const laborXcg = Number(settingsMap.get('labor_xcg')) || 50;
      const targetWholesale = Number(settingsMap.get('target_wholesale_margin_percent')) || 10;
      const targetRetail = Number(settingsMap.get('target_retail_margin_percent')) || 44;

      // Set state values for use in component
      setExchangeRate(exchangeRateValue);
      const combinedTariff = freightExteriorPerKg + freightLocalPerKg;
      setCombinedTariffPerKg(combinedTariff);
      
      // Set target margins in state for use in renderTable
      setTargetWholesaleMargin(targetWholesale);
      setTargetRetailMargin(targetRetail);

      // Fetch product data with supplier information
      const productCodes = [...new Set(consolidatedItems.map(item => item.product_code))];
      const [productsRes, demandRes, priceHistoryRes] = await Promise.all([
        supabase.from('products')
          .select(`
            code, name, price_usd_per_unit, netto_weight_per_unit, gross_weight_per_unit, 
            pack_size, empty_case_weight, wholesale_price_xcg_per_unit, retail_price_xcg_per_unit, 
            length_cm, width_cm, height_cm, volumetric_weight_kg, supplier_id, 
            suppliers(
              name, 
              cases_per_pallet,
              pallet_length_cm,
              pallet_width_cm,
              pallet_height_cm,
              pallet_weight_kg,
              pallet_max_height_cm
            )
          `)
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
              supplierId: p.supplier_id || '',
              supplierCasesPerPallet: (p.suppliers as any)?.cases_per_pallet,
              supplierPalletConfig: p.suppliers ? {
                pallet_length_cm: (p.suppliers as any).pallet_length_cm,
                pallet_width_cm: (p.suppliers as any).pallet_width_cm,
                pallet_height_cm: (p.suppliers as any).pallet_height_cm,
                pallet_weight_kg: (p.suppliers as any).pallet_weight_kg,
                pallet_max_height_cm: (p.suppliers as any).pallet_max_height_cm
              } : undefined,
              lengthCm: p.length_cm || 0,
              widthCm: p.width_cm || 0,
              heightCm: p.height_cm || 0,
            },
          ];
        }) || []
      );

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

      // Fetch supplier pallet configurations
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('id, name, cases_per_pallet');

      const supplierPalletMap = new Map(
        suppliersData?.map(s => [s.id, s.cases_per_pallet]) || []
      );

      // Calculate weights with proper product info including supplier config
      const productsWithWeight = productsWithData.map(p => {
        const productInfo = productMap.get(p.code);
        const actualProductWeight = (p.totalUnits * p.weightPerUnit / 1000);
        const volumetricProductWeight = (p.totalUnits * p.volumetricWeightPerUnit / 1000);
        const caseWeight = (p.numberOfCases * p.emptyCaseWeight / 1000);
        
        return { 
          ...p, 
          actualWeight: actualProductWeight + caseWeight,
          volumetricWeight: volumetricProductWeight + caseWeight,
          supplierId: productInfo?.supplierId || '',
          supplierName: p.supplier,
          supplierCasesPerPallet: productInfo?.supplierCasesPerPallet || supplierPalletMap.get(productInfo?.supplierId || ''),
          supplierPalletConfig: productInfo?.supplierPalletConfig,
          lengthCm: productInfo?.lengthCm,
          widthCm: productInfo?.widthCm,
          heightCm: productInfo?.heightCm,
          packSize: p.numberOfCases > 0 ? Math.ceil(p.totalUnits / p.numberOfCases) : 1,
          quantity: p.totalUnits,
          netWeightPerUnit: p.weightPerUnit,
          grossWeightPerUnit: p.weightPerUnit,
          emptyCaseWeight: p.emptyCaseWeight,
        };
      });

      // Calculate ORDER-LEVEL pallet configuration (includes pallet weights)
      const { calculateOrderPalletConfig } = await import('@/lib/weightCalculations');
      const orderPalletConfig = calculateOrderPalletConfig(productsWithWeight as any);

      // Extract order-level totals (these INCLUDE pallet weights now)
      const totalActualWeight = orderPalletConfig.totalActualWeight;
      const totalVolumetricWeight = orderPalletConfig.totalVolumetricWeight;
      const totalChargeableWeight = orderPalletConfig.totalChargeableWeight;
      const totalPallets = orderPalletConfig.totalPallets;
      
      // Calculate if we're being charged by volumetric (this triggers the alert)
      const isChargedByVolumetric = totalVolumetricWeight > totalActualWeight;
      const weightGapKg = totalVolumetricWeight - totalActualWeight;
      const weightGapPercent = totalActualWeight > 0 
        ? ((weightGapKg / totalActualWeight) * 100) 
        : 0;
      
      // Set alert data for volumetric weight component
      setVolumetricAlertData({
        isChargedByVolumetric,
        weightGapKg,
        weightGapPercent,
        totalActualWeight,
        totalVolumetricWeight,
        totalChargeableWeight
      });
      
      // Total freight using shared calculation
      const totalFreightCalc = calculateTotalFreightFromRates(
        totalChargeableWeight,
        freightExteriorPerKg,
        freightLocalPerKg,
        localLogisticsUsd,
        0 // bank charges
      );

      // Convert products to CIFProductInput format for shared functions
      const cifInputs: CIFProductInput[] = productsWithWeight.map(product => ({
        productCode: product.code,
        productName: product.name,
        quantity: product.totalUnits,
        costPerUnit: product.costPerUnit,
        actualWeight: product.actualWeight,
        volumetricWeight: product.volumetricWeight,
        orderFrequency: product.orderFrequency,
        wasteRate: product.wasteRate,
        wholesalePriceXCG: product.wholesalePriceXCG,
        retailPriceXCG: product.retailPriceXCG,
        supplier: product.supplier,
      }));
      
      // Store freight for verification
      setTotalFreight(totalFreightCalc);
      
      // Run validation before calculation
      const validation = validateCIFInput({
        products: cifInputs,
        totalFreight: totalFreightCalc,
        exchangeRate: exchangeRateValue
      });
      setValidationResult(validation);

      // Create CIF params
      const cifParams: CIFParams = {
        totalFreight: totalFreightCalc,
        exchangeRate: exchangeRateValue,
        limitingFactor: determineLimitingFactor(totalActualWeight, totalVolumetricWeight),
        wholesaleMultiplier: DEFAULT_WHOLESALE_MULTIPLIER,
        retailMultiplier: DEFAULT_RETAIL_MULTIPLIER,
      };

      // Calculate results for each method and add OrderCIFTable-specific fields
      const calculateResultsWithExtras = (method: DistributionMethod): CIFResult[] => {
        const baseResults = calculateCIFByMethod(cifInputs, cifParams, method);
        
        return baseResults.map((result, index) => {
          const product = productsWithWeight[index];
          const history = priceHistory.get(product.code);
          
          const priceHistoryData = history ? {
            previousWholesale: history.previousPrice,
            previousRetail: history.previousPrice ? history.previousPrice * 1.429 : undefined,
            wholesaleChange: history.previousPrice ? ((result.wholesalePrice - history.previousPrice) / history.previousPrice * 100) : undefined,
            retailChange: history.previousPrice ? ((result.retailPrice - (history.previousPrice * 1.429)) / (history.previousPrice * 1.429) * 100) : undefined,
            lastChangeDate: history.changeDate
          } : undefined;

          const productTotalWeight = Math.max(product.actualWeight, product.volumetricWeight);
          const productWeightType = product.volumetricWeight > product.actualWeight ? 'volumetric' : 'actual';

          return {
            productCode: result.productCode,
            productName: result.productName,
            quantity: result.quantity,
            trays: product.numberOfCases,
            actualWeight: product.actualWeight,
            volumetricWeight: product.volumetricWeight,
            totalWeight: productTotalWeight,
            weightType: productWeightType as 'actual' | 'volumetric',
            costUSD: result.costUSD,
            freightCost: result.freightCost,
            cifUSD: result.cifUSD,
            cifXCG: result.cifXCG,
            cifPerUnit: result.cifPerUnit,
            wholesalePrice: result.wholesalePrice,
            retailPrice: result.retailPrice,
            wholesaleMargin: result.wholesaleMargin,
            retailMargin: result.retailMargin,
            supplier: result.supplier || product.supplier,
            priceHistory: priceHistoryData
          };
        });
      };

      const allResults = {
        byWeight: calculateResultsWithExtras('byWeight'),
        byCost: calculateResultsWithExtras('byCost'),
        equally: calculateResultsWithExtras('equally'),
        hybrid: calculateResultsWithExtras('hybrid'),
        strategic: calculateResultsWithExtras('strategic'),
        volumeOptimized: calculateResultsWithExtras('volumeOptimized'),
        customerTier: calculateResultsWithExtras('customerTier'),
      };
      
      setCifResults(allResults);
      
      // Verify freight allocation (using byWeight as reference)
      const freightVerify = verifyFreightAllocation(
        allResults.byWeight.map(r => r.freightCost),
        totalFreightCalc
      );
      setFreightVerification({
        valid: freightVerify.valid,
        allocatedTotal: freightVerify.allocatedTotal,
        totalFreight: totalFreightCalc,
        percentageDifference: freightVerify.percentageDifference
      });
      
      // Check margins
      const margins = verifyMargins(
        allResults.byWeight.map(r => ({
          productCode: r.productCode,
          productName: r.productName,
          cifPerUnit: r.cifPerUnit,
          wholesalePrice: r.wholesalePrice,
          retailPrice: r.retailPrice
        })),
        targetWholesale,
        targetRetail
      );
      setMarginIssues(margins);
      
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

    const getRowHighlightClass = (
      wholesaleMarginPercent: number, 
      retailMarginPercent: number, 
      targetWholesale: number, 
      targetRetail: number
    ) => {
      // Check for loss (negative margins)
      if (wholesaleMarginPercent < 0 || retailMarginPercent < 0) {
        return 'bg-red-100 hover:bg-red-200';
      }
      
      // Check if margins don't meet targets
      if (wholesaleMarginPercent < targetWholesale || retailMarginPercent < targetRetail) {
        return 'bg-orange-100 hover:bg-orange-200';
      }
      
      return ''; // Default styling for products meeting targets
    };

    const getMarginTextColor = (marginPercent: number, targetPercent: number) => {
      // Red text for negative margins (loss)
      if (marginPercent < 0) {
        return 'text-red-600';
      }
      
      // Orange text for margins below target
      if (marginPercent < targetPercent) {
        return 'text-orange-600';
      }
      
      // Green text for margins meeting or exceeding target
      return 'text-green-600';
    };

    return (
      <div>
        <div className="mb-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        <div className="w-full max-h-[600px] overflow-auto border rounded-md">
          <table className="w-full caption-bottom text-sm relative">
            <TableHeader>
              <TableRow className="bg-background">
                <TableHead className="sticky top-0 z-10 bg-background">Product</TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right">Units</TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right">Actual (kg)</TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right">Vol. (kg)</TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right">Chargeable</TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right">Cost USD</TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right">Freight</TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right">CIF USD</TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right">CIF Cg</TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right">CIF/Unit</TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right">Wholesale</TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right">W. Margin</TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right">W. %</TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right">Retail</TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right">R. Margin</TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right">R. %</TableHead>
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
                      
                      const rowHighlight = getRowHighlightClass(
                        wholesaleMarginPercent,
                        retailMarginPercent,
                        targetWholesaleMargin,
                        targetRetailMargin
                      );

                      const wholesaleMarginColor = getMarginTextColor(wholesaleMarginPercent, targetWholesaleMargin);
                      const retailMarginColor = getMarginTextColor(retailMarginPercent, targetRetailMargin);

                      return (
                        <TableRow key={`${supplier}-${result.productCode}-${idx}`} className={rowHighlight}>
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
                          <TableCell className={`text-right ${wholesaleMarginColor}`}>
                            Cg {result.wholesaleMargin.toFixed(2)}
                          </TableCell>
                          <TableCell className={`text-right ${wholesaleMarginColor} font-semibold`}>
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
                          <TableCell className={`text-right ${retailMarginColor}`}>
                            Cg {result.retailMargin.toFixed(2)}
                          </TableCell>
                          <TableCell className={`text-right ${retailMarginColor} font-semibold`}>
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
          </table>
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
        {/* Verification Badges */}
        <div className="mb-4">
          <CIFVerificationBadges
            validationResult={validationResult || undefined}
            freightVerification={freightVerification || undefined}
            marginIssues={marginIssues}
            exchangeRate={{ rate: exchangeRate }}
            showCompact={true}
          />
        </div>
        
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

        {/* Volumetric Weight Alert - Shows when charged by volumetric */}
        {volumetricAlertData && (
          <VolumetricWeightAlert
            {...volumetricAlertData}
            orderItems={productsWeightData}
            freightCostPerKg={combinedTariffPerKg}
            exchangeRate={exchangeRate}
          />
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