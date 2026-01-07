import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { supabase } from '../integrations/supabase/client';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Sparkles, Loader2, DollarSign } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { MarketIntelligence } from './MarketIntelligence';
import { PricingOptimizer } from './PricingOptimizer';
import {
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';

interface OrderItem {
  product_code: string;
  quantity: number;
  customer_name?: string;
}

interface AIRecommendation {
  recommendedMethod: string;
  confidence: string;
  reasoning: string[];
  profitAnalysis: {
    totalProfit: string;
    averageMargin: string;
    targetMarginCompliance: string;
  };
  marketCompetitiveness: {
    productsOverpriced: number;
    productsUnderpriced: number;
    productsCompetitive: number;
    competitiveRisk: string;
    explanation: string;
  };
  strategicInsights: {
    lossLeaders: string[];
    profitDrivers: string[];
    crossSubsidizationStrategy: string;
  };
  customerImpact: {
    wholesaleCustomerRisk: string;
    explanation: string;
  };
  alternativeRecommendation: {
    method: string;
    whenToUse: string;
  };
  profitComparison: {
    byWeight: string;
    byCost: string;
    equal: string;
    hybrid?: string;
    strategic?: string;
    volumeOptimized?: string;
    customerTier?: string;
  };
  concerns: string;
}

interface CIFAnalyticsProps {
  orderItems: OrderItem[];
  onRecommendation?: (method: string) => void;
}

interface SupplierCost {
  name: string;
  value: number;
}

interface ProductMargin {
  productCode: string;
  productName: string;
  marginPercentage: number;
  marginAmount: number;
  quantity: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658'];

export const CIFAnalytics = ({ orderItems, onRecommendation }: CIFAnalyticsProps) => {
  const [supplierCosts, setSupplierCosts] = useState<SupplierCost[]>([]);
  const [totalProfit, setTotalProfit] = useState<number>(0);
  const [topMargins, setTopMargins] = useState<ProductMargin[]>([]);
  const [poorMargins, setPoorMargins] = useState<ProductMargin[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiRecommendation, setAiRecommendation] = useState<AIRecommendation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [productCostBreakdown, setProductCostBreakdown] = useState<Array<{
    productName: string;
    quantity: number;
    costPerUnit: number;
    totalCost: number;
  }>>([]);
  const [freightBreakdown, setFreightBreakdown] = useState({
    exteriorTariff: 0,
    localTariff: 0,
    localLogistics: 0,
    labor: 0
  });
  const [grandTotal, setGrandTotal] = useState(0);

  useEffect(() => {
    calculateAnalytics();
  }, [orderItems]);

  const getAIRecommendation = async () => {
    try {
      setAiLoading(true);
      
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
      const { data: settings } = await supabase
        .from('settings')
        .select('*')
        .in('key', ['freight_exterior_tariff', 'freight_local_tariff', 'usd_to_xcg_rate', 'local_logistics_usd', 'labor_xcg']);

      const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);
      const exchangeRate = (settingsMap.get('usd_to_xcg_rate') as any)?.rate || 1.82;
      const freightExteriorPerKg = (settingsMap.get('freight_exterior_tariff') as any)?.rate || 2.46;
      const freightLocalPerKg = (settingsMap.get('freight_local_tariff') as any)?.rate || 0.41;
      const localLogisticsUsd = Number(settingsMap.get('local_logistics_usd')) || 91;
      const laborXcg = Number(settingsMap.get('labor_xcg')) || 50;

      const productCodes = [...new Set(consolidatedItems.map(item => item.product_code))];
      
      // Fetch products with all data
      const { data: products } = await supabase
        .from('products')
        .select('code, name, price_usd_per_unit, netto_weight_per_unit, gross_weight_per_unit, pack_size, empty_case_weight, wholesale_price_xcg_per_unit')
        .in('code', productCodes);

      // Fetch historical demand patterns for velocity analysis
      const { data: demandPatterns } = await supabase
        .from('demand_patterns')
        .select('product_code, order_frequency, avg_order_quantity, avg_waste_rate, last_order_date, total_ordered')
        .in('product_code', productCodes);

      type DemandData = {
        frequency: number;
        avgOrderSize: number;
        wasteRate: number;
        totalOrdered: number;
      };

      const demandMap = new Map<string, DemandData>(
        demandPatterns?.map(d => [d.product_code, {
          frequency: d.order_frequency || 1,
          avgOrderSize: d.avg_order_quantity || 0,
          wasteRate: d.avg_waste_rate || 0,
          totalOrdered: d.total_ordered || 0
        }]) || []
      );

      // Fetch market intelligence data
      const { data: marketSnapshots } = await supabase
        .from('market_price_snapshots')
        .select('*')
        .in('product_code', productCodes)
        .order('snapshot_date', { ascending: false })
        .limit(productCodes.length);

      const marketMap = new Map<string, any>(
        marketSnapshots?.map(m => [m.product_code, {
          retailPriceFound: m.retail_price_found,
          calculatedWholesale: m.calculated_wholesale,
          position: m.supply_demand_index && m.supply_demand_index > 1.1 ? 'OVERPRICED' : 
                   m.supply_demand_index && m.supply_demand_index < 0.9 ? 'UNDERPRICED' : 'COMPETITIVE',
          seasonalFactor: m.seasonal_factor,
          importSource: m.import_source_country,
          confidence: m.confidence_score > 0.7 ? 'HIGH' : m.confidence_score > 0.4 ? 'MEDIUM' : 'LOW',
          source: m.source
        }]) || []
      );

      const productMap = new Map(
        products?.map(p => {
          const packSize = p.pack_size || 1;
          const weightPerUnit = (p.gross_weight_per_unit && p.gross_weight_per_unit > 0) 
            ? p.gross_weight_per_unit 
            : (p.netto_weight_per_unit || 0);
          const emptyCaseWeight = p.empty_case_weight || 0;
          
          return [p.code, {
            name: p.name,
            costPerUnit: p.price_usd_per_unit || 0,
            weightPerUnit,
            packSize,
            emptyCaseWeight,
            wholesalePriceXCG: p.wholesale_price_xcg_per_unit || 0,
          }];
        }) || []
      );

      const LOCAL_LOGISTICS_USD = localLogisticsUsd;
      const LABOR_XCG = laborXcg;

      const productsWithData = consolidatedItems.map(item => {
        const productData = productMap.get(item.product_code);
        const demand = demandMap.get(item.product_code);
        const packSize = productData?.packSize || 1;
        const totalUnits = item.quantity * packSize;
        
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

      // Calculate all 7 methods
      const calculateResults = (distributionMethod: 'weight' | 'cost' | 'equal' | 'hybrid' | 'strategic' | 'volumeOptimized' | 'customerTier') => {
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
              const weightShare = totalWeight > 0 ? (product.totalWeight / totalWeight) * totalFreight : 0;
              const costShare = totalCost > 0 ? (productCost / totalCost) * totalFreight : 0;
              freightShare = (weightShare + costShare) / 2;
              break;
            case 'volumeOptimized':
              const totalFrequency = productsWithWeight.reduce((sum, p) => sum + p.orderFrequency, 0);
              const frequencyWeight = totalFrequency > 0 ? (product.orderFrequency / totalFrequency) : 1 / productsWithWeight.length;
              const invertedWeight = 1 - (frequencyWeight / 2);
              freightShare = invertedWeight * (totalFreight / productsWithWeight.length);
              break;
            case 'strategic':
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
              const isWholesaleHeavy = product.orderFrequency > 5;
              const tierMultiplier = isWholesaleHeavy ? 0.85 : 1.15;
              const baseShare = totalFreight / productsWithWeight.length;
              freightShare = baseShare * tierMultiplier;
              break;
          }

          const cifUSD = productCost + freightShare;
          const cifXCG = cifUSD * exchangeRate + LABOR_XCG / productsWithWeight.length;
          const cifPerUnit = product.totalUnits > 0 ? cifXCG / product.totalUnits : 0;
          const wholesalePrice = product.wholesalePriceXCG || (cifPerUnit * 1.25);
          const wholesaleMargin = wholesalePrice - cifPerUnit;

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
            retailPrice: cifPerUnit * 1.786,
            wholesaleMargin,
            retailMargin: (cifPerUnit * 1.786) - cifPerUnit,
          };
        });
      };

      const cifResults = {
        byWeight: calculateResults('weight'),
        byCost: calculateResults('cost'),
        equally: calculateResults('equal'),
        hybrid: calculateResults('hybrid'),
        strategic: calculateResults('strategic'),
        volumeOptimized: calculateResults('volumeOptimized'),
        customerTier: calculateResults('customerTier'),
      };

      // Build market intelligence context
      const marketIntelligence = {
        products: productsWithData.map(p => {
          const market = marketMap.get(p.code);
          const wholesalePrice = p.wholesalePriceXCG || 0;
          const calculatedWholesale = market?.calculatedWholesale || 0;
          const competitiveGap = calculatedWholesale > 0 ? ((wholesalePrice - calculatedWholesale) / calculatedWholesale) * 100 : 0;
          
          return {
            productName: p.name,
            retailPriceFound: market?.retailPriceFound,
            calculatedWholesale: market?.calculatedWholesale,
            position: market?.position,
            competitiveGap,
            seasonalFactor: market?.seasonalFactor,
            importSource: market?.importSource,
            confidence: market?.confidence,
            source: market?.source
          };
        })
      };

      // Build historical performance context
      const historicalPerformance = {
        products: productsWithData.map(p => {
          const demand = demandMap.get(p.code);
          const ordersPerWeek = (demand?.frequency || 0) / 12; // Assuming data is for ~3 months
          
          return {
            productName: p.name,
            orderFrequency: demand?.frequency || 0,
            ordersPerWeek,
            avgOrderSize: demand?.avgOrderSize || 0,
            wasteRate: demand?.wasteRate || 0,
            velocity: ordersPerWeek >= 2 ? 'FAST' : ordersPerWeek >= 0.5 ? 'MEDIUM' : 'SLOW',
            wholesalePercentage: p.orderFrequency > 5 ? 75 : 50, // Simplified assumption
            retailPercentage: p.orderFrequency > 5 ? 25 : 50
          };
        })
      };

      // Call edge function with comprehensive context
      const { data, error } = await supabase.functions.invoke('cif-advisor', {
        body: { 
          cifResults,
          orderItems: consolidatedItems,
          marketIntelligence,
          historicalPerformance
        }
      });

      if (error) throw error;

      if (data.success) {
        setAiRecommendation(data.recommendation);
        if (onRecommendation) {
          onRecommendation(data.recommendation.recommendedMethod);
        }
      }
    } catch (error) {
      console.error('Error getting AI recommendation:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const calculateAnalytics = async () => {
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
      const { data: settings } = await supabase
        .from('settings')
        .select('*')
        .in('key', ['freight_exterior_tariff', 'freight_local_tariff', 'usd_to_xcg_rate']);

      const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);
      const exchangeRate = (settingsMap.get('usd_to_xcg_rate') as any)?.rate || 1.82;
      const freightExteriorPerKg = (settingsMap.get('freight_exterior_tariff') as any)?.rate || 2.46;
      const freightLocalPerKg = (settingsMap.get('freight_local_tariff') as any)?.rate || 0.41;

      // Fetch products with supplier info
      const productCodes = [...new Set(consolidatedItems.map(item => item.product_code))];
      const { data: products } = await supabase
        .from('products')
        .select(`
          code, 
          name, 
          price_usd_per_unit,
          netto_weight_per_unit,
          gross_weight_per_unit,
          pack_size,
          empty_case_weight,
          wholesale_price_xcg_per_unit,
          retail_price_xcg_per_unit,
          supplier_id,
          length_cm,
          width_cm,
          height_cm,
          volumetric_weight_kg,
          suppliers (name)
        `)
        .in('code', productCodes);

      if (!products) return;

      const LOCAL_LOGISTICS_USD = 91;
      const LOCAL_LOGISTICS_XCG = LOCAL_LOGISTICS_USD * exchangeRate;
      const LABOR_XCG = 50;

      // Fetch customer pricing tiers for accurate profit calculation
      const customerNames = [...new Set(orderItems.map(item => item.customer_name).filter(Boolean))];
      let customerTierMap = new Map<string, 'wholesale' | 'retail'>();
      
      if (customerNames.length > 0) {
        const { data: customers } = await supabase
          .from('customers')
          .select('name, pricing_tier')
          .in('name', customerNames);
        
        customers?.forEach(c => {
          customerTierMap.set(c.name, c.pricing_tier as 'wholesale' | 'retail');
        });
      }

      // Calculate total weight using correct formula and build cost breakdown
      let totalWeight = 0;
      const costBreakdown: Array<{
        productName: string;
        quantity: number;
        costPerUnit: number;
        totalCost: number;
      }> = [];

      consolidatedItems.forEach(item => {
        const product = products.find(p => p.code === item.product_code);
        if (product) {
          const packSize = product.pack_size || 1;
          const totalUnits = item.quantity * packSize;
          const weightPerUnit = (product.gross_weight_per_unit && product.gross_weight_per_unit > 0) 
            ? product.gross_weight_per_unit 
            : (product.netto_weight_per_unit || 0);
          const emptyCaseWeight = product.empty_case_weight || 0;
          
          const productWeight = (totalUnits * weightPerUnit / 1000) + 
                               (item.quantity * emptyCaseWeight / 1000);
          totalWeight += productWeight;

          costBreakdown.push({
            productName: product.name || item.product_code,
            quantity: totalUnits,
            costPerUnit: product.price_usd_per_unit || 0,
            totalCost: totalUnits * (product.price_usd_per_unit || 0)
          });
        }
      });

      setProductCostBreakdown(costBreakdown);

      // Calculate freight breakdown
      const exteriorFreight = totalWeight * freightExteriorPerKg;
      const localFreight = totalWeight * freightLocalPerKg;
      
      setFreightBreakdown({
        exteriorTariff: exteriorFreight,
        localTariff: localFreight,
        localLogistics: LOCAL_LOGISTICS_USD,
        labor: LABOR_XCG / exchangeRate
      });

      const totalProductCost = costBreakdown.reduce((sum, p) => sum + p.totalCost, 0);
      const totalFreightUSD = exteriorFreight + localFreight + LOCAL_LOGISTICS_USD + (LABOR_XCG / exchangeRate);
      setGrandTotal((totalProductCost + totalFreightUSD) * exchangeRate);

      // Calculate supplier distribution
      const supplierTotals: Record<string, number> = {};
      products.forEach(product => {
        const supplierName = (product.suppliers as any)?.name || 'Unknown';
        const item = consolidatedItems.find(i => i.product_code === product.code);
        if (item) {
          const packSize = product.pack_size || 1;
          const totalUnits = item.quantity * packSize;
          const cost = totalUnits * (product.price_usd_per_unit || 0);
          supplierTotals[supplierName] = (supplierTotals[supplierName] || 0) + cost;
        }
      });

      setSupplierCosts(
        Object.entries(supplierTotals).map(([name, value]) => ({ name, value }))
      );

      // Calculate profit margins per product
      const margins: ProductMargin[] = [];
      let totalProfitAmount = 0;

      consolidatedItems.forEach(item => {
        const product = products.find(p => p.code === item.product_code);
        if (product) {
          const packSize = product.pack_size || 1;
          const totalUnits = item.quantity * packSize;
          const weightPerUnit = (product.gross_weight_per_unit && product.gross_weight_per_unit > 0) 
            ? product.gross_weight_per_unit 
            : (product.netto_weight_per_unit || 0);
          const emptyCaseWeight = product.empty_case_weight || 0;
          
          const productWeight = (totalUnits * weightPerUnit / 1000) + 
                               (item.quantity * emptyCaseWeight / 1000);
          
          const productCostUSD = totalUnits * (product.price_usd_per_unit || 0);
          const freightShare = totalWeight > 0 
            ? (productWeight / totalWeight) * (totalWeight * (freightExteriorPerKg + freightLocalPerKg) + LOCAL_LOGISTICS_USD)
            : 0;
          const laborShare = LABOR_XCG / consolidatedItems.length;
          
          const cifUSD = productCostUSD + freightShare;
          const cifXCG = cifUSD * exchangeRate + laborShare;
          const cifPerUnit = totalUnits > 0 ? cifXCG / totalUnits : 0;
          
          const wholesalePrice = product.wholesale_price_xcg_per_unit || (cifPerUnit * 1.25);
          const marginPerUnit = wholesalePrice - cifPerUnit;
          const marginPercentage = cifPerUnit > 0 ? (marginPerUnit / cifPerUnit) * 100 : 0;
          
          margins.push({
            productCode: product.code,
            productName: product.name || product.code,
            marginPercentage,
            marginAmount: marginPerUnit * totalUnits,
            quantity: totalUnits
          });

          totalProfitAmount += marginPerUnit * totalUnits;
        }
      });

      setTotalProfit(totalProfitAmount);
      
      // Sort and get top/poor performers
      const sortedMargins = [...margins].sort((a, b) => b.marginPercentage - a.marginPercentage);
      setTopMargins(sortedMargins.slice(0, 5));
      setPoorMargins(sortedMargins.filter(m => m.marginPercentage < 10).slice(0, 5));

    } catch (error) {
      console.error('Error calculating analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const cifProducts = productCostBreakdown.map(p => ({
    productCode: p.productName,
    productName: p.productName,
    cifPerUnit: p.costPerUnit,
    quantity: p.quantity
  }));

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="margins">Margins</TabsTrigger>
          <TabsTrigger value="market">Market Intel</TabsTrigger>
          <TabsTrigger value="optimizer">Pricing AI</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* AI Recommendation Card */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Distribution Recommendation
                </span>
                <Button 
                  onClick={getAIRecommendation}
                  disabled={aiLoading}
                  size="sm"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Get Recommendation'
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            {aiRecommendation && (
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-lg px-4 py-2">
                    {aiRecommendation.recommendedMethod}
                  </Badge>
                  <Badge variant="outline">{aiRecommendation.confidence} Confidence</Badge>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold">Reasoning:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {aiRecommendation.reasoning.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                {aiRecommendation.concerns && (
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm text-orange-800">
                      <strong>⚠️ Concern:</strong> {aiRecommendation.concerns}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Profit</p>
                    <p className="text-lg font-bold text-green-600">
                      {aiRecommendation.profitAnalysis.totalProfit}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Avg Margin</p>
                    <p className="text-lg font-bold text-blue-600">
                      {aiRecommendation.profitAnalysis.averageMargin}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Target Compliance</p>
                    <p className="text-lg font-bold text-purple-600">
                      {aiRecommendation.profitAnalysis.targetMarginCompliance}
                    </p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Supplier Cost Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Supplier Cost Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={supplierCosts}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {supplierCosts.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Order Cost Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Product Costs</span>
                    <span className="font-semibold">
                      ${productCostBreakdown.reduce((s, p) => s + p.totalCost, 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Exterior Freight</span>
                    <span>${freightBreakdown.exteriorTariff.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Local Freight</span>
                    <span>${freightBreakdown.localTariff.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Local Logistics</span>
                    <span>${freightBreakdown.localLogistics.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Labor (Cg)</span>
                    <span>${freightBreakdown.labor.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Grand Total (XCG)</span>
                    <span>Cg {grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Expected Profit</span>
                    <span className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Cg {totalProfit.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="margins" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Performers */}
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <TrendingUp className="h-5 w-5" />
                  Top Margin Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topMargins.map((m) => (
                      <TableRow key={m.productCode}>
                        <TableCell>
                          <div className="font-medium">{m.productName}</div>
                          <div className="text-xs text-muted-foreground">{m.quantity} units</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="default" className="bg-green-600">
                            {m.marginPercentage.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          Cg {m.marginAmount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Poor Performers */}
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <TrendingDown className="h-5 w-5" />
                  Low Margin Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poorMargins.length > 0 ? poorMargins.map((m) => (
                      <TableRow key={m.productCode}>
                        <TableCell>
                          <div className="font-medium">{m.productName}</div>
                          <div className="text-xs text-muted-foreground">{m.quantity} units</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive">
                            {m.marginPercentage.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          Cg {m.marginAmount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          All products meet margin targets! 🎉
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="market">
          <MarketIntelligence products={cifProducts} />
        </TabsContent>

        <TabsContent value="optimizer">
          <PricingOptimizer products={productCostBreakdown.map(p => p.productName)} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
