import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Calculator, Award } from 'lucide-react';
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

interface OrderItem {
  product_code: string;
  quantity: number;
}

interface CIFResult {
  productCode: string;
  productName: string;
  quantity: number;
  totalWeight: number;
  costUSD: number;
  freightCost: number;
  cifUSD: number;
  cifXCG: number;
  cifPerUnit: number;
  wholesalePrice: number;
  retailPrice: number;
  wholesaleMargin: number;
  retailMargin: number;
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
        .in('key', ['freight_exterior_tariff', 'freight_local_tariff', 'usd_to_xcg_rate']);

      if (settingsError) throw settingsError;

      const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);
      const exchangeRate = (settingsMap.get('usd_to_xcg_rate') as any)?.rate || DEFAULT_EXCHANGE_RATE;
      const freightExteriorPerKg = (settingsMap.get('freight_exterior_tariff') as any)?.rate || 2.46;
      const freightLocalPerKg = (settingsMap.get('freight_local_tariff') as any)?.rate || 0.41;

      // Fetch product data
      const productCodes = [...new Set(consolidatedItems.map(item => item.product_code))];
      const { data: products, error } = await supabase
        .from('products')
        .select('code, name, price_usd_per_unit, netto_weight_per_unit, gross_weight_per_unit, pack_size, empty_case_weight, wholesale_price_xcg_per_unit')
        .in('code', productCodes);

      if (error) throw error;

      // Fetch historical order frequency for volume-optimized method
      const { data: demandPatterns } = await supabase
        .from('demand_patterns')
        .select('product_code, order_frequency, avg_waste_rate')
        .in('product_code', productCodes);

      const demandMap = new Map(
        demandPatterns?.map(d => [d.product_code, {
          frequency: d.order_frequency || 1,
          wasteRate: d.avg_waste_rate || 0
        }]) || []
      );

      const productMap = new Map(
        products?.map(p => {
          const packSize = p.pack_size || 1;
          const weightPerUnit = (p.gross_weight_per_unit && p.gross_weight_per_unit > 0) 
            ? p.gross_weight_per_unit 
            : (p.netto_weight_per_unit || 0);
          const emptyCaseWeight = p.empty_case_weight || 0;
          
          return [
            p.code,
            {
              name: p.name,
              costPerUnit: p.price_usd_per_unit || 0,
              weightPerUnit: weightPerUnit,
              packSize: packSize,
              emptyCaseWeight: emptyCaseWeight,
              wholesalePriceXCG: p.wholesale_price_xcg_per_unit || 0,
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
          emptyCaseWeight: productData?.emptyCaseWeight || 0,
          wholesalePriceXCG: productData?.wholesalePriceXCG || 0,
          orderFrequency: demand?.frequency || 1,
          wasteRate: demand?.wasteRate || 0,
        };
      });

      const productsWithWeight = productsWithData.map(p => {
        const productWeight = (p.totalUnits * p.weightPerUnit / 1000) + 
                              (p.numberOfCases * p.emptyCaseWeight / 1000);
        return { ...p, totalWeight: productWeight };
      });

      const totalWeight = productsWithWeight.reduce((sum, p) => sum + p.totalWeight, 0);
      const totalCost = productsWithWeight.reduce((sum, p) => sum + (p.totalUnits * p.costPerUnit), 0);
      const combinedTariffPerKg = freightExteriorPerKg + freightLocalPerKg;
      const totalFreightCost = totalWeight * combinedTariffPerKg;
      const totalFreight = LOCAL_LOGISTICS_USD + totalFreightCost;

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
          const cifXCG = cifUSD * exchangeRate + LABOR_XCG / productsWithWeight.length;
          const cifPerUnit = product.totalUnits > 0 ? cifXCG / product.totalUnits : 0;

          const wholesalePrice = product.wholesalePriceXCG || (cifPerUnit * WHOLESALE_MULTIPLIER);
          const retailPrice = cifPerUnit * RETAIL_MULTIPLIER;
          const wholesaleMargin = wholesalePrice - cifPerUnit;
          const retailMargin = retailPrice - cifPerUnit;

          return {
            productCode: product.code,
            productName: product.name,
            quantity: product.totalUnits,
            totalWeight: product.totalWeight,
            costUSD: productCost,
            freightCost: freightShare,
            cifUSD,
            cifXCG,
            cifPerUnit,
            wholesalePrice,
            retailPrice,
            wholesaleMargin,
            retailMargin,
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
    } catch (error: any) {
      console.error('Error calculating CIF:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTable = (results: CIFResult[], title: string, description?: string) => {
    if (!results || results.length === 0) return null;

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
                <TableHead className="text-right">Weight (kg)</TableHead>
                <TableHead className="text-right">Cost USD</TableHead>
                <TableHead className="text-right">Freight</TableHead>
                <TableHead className="text-right">CIF USD</TableHead>
                <TableHead className="text-right">CIF Cg</TableHead>
                <TableHead className="text-right">CIF/Unit</TableHead>
                <TableHead className="text-right">Wholesale</TableHead>
                <TableHead className="text-right">Retail</TableHead>
                <TableHead className="text-right">W. Margin</TableHead>
                <TableHead className="text-right">R. Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{result.productName}</TableCell>
                  <TableCell className="text-right">{result.quantity}</TableCell>
                  <TableCell className="text-right">{result.totalWeight.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${result.costUSD.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${result.freightCost.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${result.cifUSD.toFixed(2)}</TableCell>
                  <TableCell className="text-right">Cg {result.cifXCG.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-bold">
                    Cg {result.cifPerUnit.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">Cg {result.wholesalePrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right">Cg {result.retailPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-green-600">
                    Cg {result.wholesaleMargin.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    Cg {result.retailMargin.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
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