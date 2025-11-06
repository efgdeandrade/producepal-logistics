import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Sparkles, Loader2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MarketIntelligence } from './MarketIntelligence';
import { PricingOptimizer } from './PricingOptimizer';
import {
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

interface OrderItem {
  product_code: string;
  quantity: number;
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
        .in('key', ['freight_exterior_tariff', 'freight_local_tariff', 'usd_to_xcg_rate']);

      const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);
      const exchangeRate = (settingsMap.get('usd_to_xcg_rate') as any)?.rate || 1.82;
      const freightExteriorPerKg = (settingsMap.get('freight_exterior_tariff') as any)?.rate || 2.46;
      const freightLocalPerKg = (settingsMap.get('freight_local_tariff') as any)?.rate || 0.41;

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

      const LOCAL_LOGISTICS_USD = 91;
      const LABOR_XCG = 50;

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
          supplier_id,
          suppliers (name)
        `)
        .in('code', productCodes);

      if (!products) return;

      const LOCAL_LOGISTICS_USD = 91;
      const LOCAL_LOGISTICS_XCG = LOCAL_LOGISTICS_USD * exchangeRate;
      const LABOR_XCG = 50;

      // Calculate total weight using correct formula and build cost breakdown
      let totalWeight = 0;
      const costBreakdown: Array<{
        productName: string;
        quantity: number;
        costPerUnit: number;
        totalCost: number;
      }> = [];

      products.forEach(p => {
        const item = consolidatedItems.find(i => i.product_code === p.code);
        if (!item) return;
        
        const packSize = p.pack_size || 1;
        const totalUnits = item.quantity * packSize;
        const weightPerUnit = (p.gross_weight_per_unit && p.gross_weight_per_unit > 0) 
          ? p.gross_weight_per_unit 
          : (p.netto_weight_per_unit || 0);
        const emptyCaseWeight = p.empty_case_weight || 0;
        
        const productWeight = (totalUnits * weightPerUnit / 1000) + 
                              (item.quantity * emptyCaseWeight / 1000);
        totalWeight += productWeight;
        
        costBreakdown.push({
          productName: p.name,
          quantity: totalUnits,
          costPerUnit: p.price_usd_per_unit || 0,
          totalCost: totalUnits * (p.price_usd_per_unit || 0)
        });
      });

      const combinedTariffPerKg = freightExteriorPerKg + freightLocalPerKg;
      const totalFreightCost = totalWeight * combinedTariffPerKg;
      const totalFreight = LOCAL_LOGISTICS_USD + totalFreightCost;
      const exteriorFreightCost = totalWeight * freightExteriorPerKg;
      const localFreightCost = totalWeight * freightLocalPerKg;

      // Calculate supplier costs
      const supplierMap = new Map<string, number>();
      let totalWholesaleRevenue = 0;
      let totalCostXCG = 0;
      const productMargins: ProductMargin[] = [];

      products.forEach(product => {
        const item = consolidatedItems.find(i => i.product_code === product.code);
        if (!item) return;

        const supplierName = (product.suppliers as any)?.name || 'Unknown Supplier';
        const packSize = product.pack_size || 1;
        const totalUnits = item.quantity * packSize;
        const weightPerUnit = (product.gross_weight_per_unit && product.gross_weight_per_unit > 0) 
          ? product.gross_weight_per_unit 
          : (product.netto_weight_per_unit || 0);
        const emptyCaseWeight = product.empty_case_weight || 0;
        
        const productWeight = (totalUnits * weightPerUnit / 1000) + 
                              (item.quantity * emptyCaseWeight / 1000);
        const productCostUSD = totalUnits * (product.price_usd_per_unit || 0);
        
        // Calculate freight share by weight
        const freightShare = totalWeight > 0 ? (productWeight / totalWeight) * totalFreight : 0;
        
        // Calculate CIF in Cg
        const cifUSD = productCostUSD + freightShare;
        const cifXCG = cifUSD * exchangeRate + (LABOR_XCG / products.length);
        const cifPerUnit = totalUnits > 0 ? cifXCG / totalUnits : 0;
        
        // Wholesale price and margin
        const wholesalePricePerUnit = product.wholesale_price_xcg_per_unit || 0;
        const wholesaleRevenue = totalUnits * wholesalePricePerUnit;
        const profit = wholesaleRevenue - cifXCG;
        const marginPercentage = cifXCG > 0 ? (profit / cifXCG) * 100 : 0;

        totalWholesaleRevenue += wholesaleRevenue;
        totalCostXCG += cifXCG;

        // Add to supplier map (cost in Cg)
        const currentCost = supplierMap.get(supplierName) || 0;
        supplierMap.set(supplierName, currentCost + cifXCG);

        productMargins.push({
          productCode: product.code,
          productName: product.name,
          marginPercentage,
          marginAmount: profit,
          quantity: totalUnits
        });
      });

      // Convert supplier map to array for pie chart
      const supplierArray = Array.from(supplierMap.entries()).map(([name, value]) => ({
        name,
        value: Math.round(value)
      }));

      setSupplierCosts(supplierArray);
      setTotalProfit(totalWholesaleRevenue - totalCostXCG);
      setProductCostBreakdown(costBreakdown);
      setFreightBreakdown({
        exteriorTariff: exteriorFreightCost * exchangeRate,
        localTariff: localFreightCost * exchangeRate,
        localLogistics: LOCAL_LOGISTICS_XCG,
        labor: LABOR_XCG
      });
      
      const productCostTotal = costBreakdown.reduce((sum, p) => sum + p.totalCost, 0) * exchangeRate;
      const grand = productCostTotal + 
                    (exteriorFreightCost * exchangeRate) + 
                    (localFreightCost * exchangeRate) + 
                    LOCAL_LOGISTICS_XCG + 
                    LABOR_XCG;
      setGrandTotal(grand);

      // Sort by margin percentage
      productMargins.sort((a, b) => b.marginPercentage - a.marginPercentage);
      setTopMargins(productMargins.slice(0, 5));
      setPoorMargins(productMargins.slice(-2).reverse());

    } catch (error) {
      console.error('Error calculating analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>CIF Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Calculating analytics...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare simplified market products data
  const marketProducts = productCostBreakdown.map(item => ({
    productCode: item.productName, // Using name as code for now
    productName: item.productName,
    cifPerUnit: item.costPerUnit * 1.82, // Simple approximation
    quantity: item.quantity
  }));
  
  return (
      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analytics">CIF Analytics</TabsTrigger>
          <TabsTrigger value="market">Market Intelligence</TabsTrigger>
          <TabsTrigger value="pricing">
            <DollarSign className="h-4 w-4 mr-2" />
            Pricing Optimizer
          </TabsTrigger>
        </TabsList>
      
      <TabsContent value="analytics" className="space-y-6">
        {/* AI Advisor Card */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Dito Advisor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!aiRecommendation && !aiLoading && (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-4">
                Get Dito's expert recommendations on which CIF calculation method will maximize your profit
              </p>
              <Button onClick={getAIRecommendation} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Get Dito's Recommendation
              </Button>
            </div>
          )}

          {aiLoading && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Analyzing order profitability...</p>
            </div>
          )}

          {aiRecommendation && !aiLoading && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-semibold">Recommended Method:</span>
                    <Badge variant="default" className="text-sm capitalize">
                      {aiRecommendation.recommendedMethod}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {aiRecommendation.confidence} Confidence
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-medium">Key Reasoning:</p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      {aiRecommendation.reasoning.map((reason, idx) => (
                        <li key={idx} className="list-disc">{reason}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Strategic Insights */}
                  {aiRecommendation.strategicInsights && (
                    <div className="bg-primary/5 rounded-lg p-3 mb-3 space-y-2">
                      <p className="text-sm font-semibold">Strategic Insights</p>
                      {aiRecommendation.strategicInsights.lossLeaders.length > 0 && (
                        <div className="text-xs">
                          <span className="font-medium">Volume Drivers:</span>
                          <span className="text-muted-foreground ml-1">
                            {aiRecommendation.strategicInsights.lossLeaders.join(', ')}
                          </span>
                        </div>
                      )}
                      {aiRecommendation.strategicInsights.profitDrivers.length > 0 && (
                        <div className="text-xs">
                          <span className="font-medium">Profit Drivers:</span>
                          <span className="text-muted-foreground ml-1">
                            {aiRecommendation.strategicInsights.profitDrivers.join(', ')}
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground italic">
                        {aiRecommendation.strategicInsights.crossSubsidizationStrategy}
                      </p>
                    </div>
                  )}

                  {/* Market Competitiveness */}
                  {aiRecommendation.marketCompetitiveness && (
                    <div className="bg-background/50 rounded-lg p-3 mb-3">
                      <p className="text-sm font-semibold mb-2">Market Position</p>
                      <div className="flex gap-3 text-xs mb-2">
                        <div className="text-center">
                          <p className="text-muted-foreground">Competitive</p>
                          <p className="font-bold text-green-600">{aiRecommendation.marketCompetitiveness.productsCompetitive}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Underpriced</p>
                          <p className="font-bold text-blue-600">{aiRecommendation.marketCompetitiveness.productsUnderpriced}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Overpriced</p>
                          <p className="font-bold text-red-600">{aiRecommendation.marketCompetitiveness.productsOverpriced}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Risk: <span className={`font-medium ${
                          aiRecommendation.marketCompetitiveness.competitiveRisk === 'HIGH' ? 'text-red-600' :
                          aiRecommendation.marketCompetitiveness.competitiveRisk === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'
                        }`}>{aiRecommendation.marketCompetitiveness.competitiveRisk}</span>
                        {' - '}{aiRecommendation.marketCompetitiveness.explanation}
                      </p>
                    </div>
                  )}

                  {/* Profit Comparison Grid */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {Object.entries(aiRecommendation.profitComparison).map(([method, profit]) => (
                      <div key={method} className="bg-background/50 rounded p-2 text-center">
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {method.replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                        <p className="text-xs font-semibold">{profit}</p>
                      </div>
                    ))}
                  </div>

                  {/* Alternative Recommendation */}
                  {aiRecommendation.alternativeRecommendation && (
                    <div className="bg-muted/50 rounded p-2 mb-3">
                      <p className="text-xs font-medium">Alternative: {aiRecommendation.alternativeRecommendation.method}</p>
                      <p className="text-xs text-muted-foreground">{aiRecommendation.alternativeRecommendation.whenToUse}</p>
                    </div>
                  )}

                  {aiRecommendation.concerns && (
                    <p className="text-xs text-muted-foreground italic">
                      ⚠️ {aiRecommendation.concerns}
                    </p>
                  )}
                </div>
              </div>

              <Button 
                onClick={getAIRecommendation} 
                variant="outline" 
                size="sm"
                className="w-full gap-2"
              >
                <Sparkles className="h-3 w-3" />
                Ask Dito Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost Breakdown by Product */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost Breakdown by Product
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Cost per Unit (USD)</TableHead>
                <TableHead className="text-right">Total Cost (USD)</TableHead>
                <TableHead className="text-right">Total Cost (Cg)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productCostBreakdown.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">${item.costPerUnit.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${item.totalCost.toFixed(2)}</TableCell>
                  <TableCell className="text-right">Cg {(item.totalCost * 1.82).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Freight & Tariff Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Freight & Tariff Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Exterior Agent Tariff:</span>
            <span className="font-semibold">Cg {freightBreakdown.exteriorTariff.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Local Agent Tariff:</span>
            <span className="font-semibold">Cg {freightBreakdown.localTariff.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Local Logistics:</span>
            <span className="font-semibold">Cg {freightBreakdown.localLogistics.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Labor:</span>
            <span className="font-semibold">Cg {freightBreakdown.labor.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Grand Total */}
      <Card className="border-2 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <DollarSign className="h-6 w-6" />
            GRAND TOTAL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-primary mb-2">
            Cg {grandTotal.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground">
            Total cost of this order (all expenses included)
          </p>
        </CardContent>
      </Card>

      {/* Original Analytics Card */}
      <Card>
        <CardHeader>
          <CardTitle>CIF Analytics & Profitability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Supplier Cost Distribution */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Total Cost per Supplier</h3>
            {supplierCosts.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={supplierCosts}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {supplierCosts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `Cg ${value.toFixed(2)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">No supplier data available</p>
            )}
          </div>

          {/* Total Profit */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Total Profit (Wholesale)</h3>
            <p className="text-3xl font-bold text-green-600">
              Cg {totalProfit.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              If all merchandise is sold at wholesale price
            </p>
          </div>

          {/* Top 5 Products with Good Margins */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Top 5 Products - Best Margins
            </h3>
            <div className="space-y-2">
              {topMargins.map((product, idx) => (
                <div
                  key={product.productCode}
                  className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800"
                >
                  <div>
                    <p className="font-semibold">{idx + 1}. {product.productName}</p>
                    <p className="text-sm text-muted-foreground">Qty: {product.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{product.marginPercentage.toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground">Cg {product.marginAmount.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom 2 Products with Poor Margins */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Top 2 Products - Poorest Margins
            </h3>
            <div className="space-y-2">
              {poorMargins.map((product, idx) => (
                <div
                  key={product.productCode}
                  className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800"
                >
                  <div>
                    <p className="font-semibold">{product.productName}</p>
                    <p className="text-sm text-muted-foreground">Qty: {product.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{product.marginPercentage.toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground">Cg {product.marginAmount.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      </TabsContent>
      
      <TabsContent value="market">
        <MarketIntelligence products={marketProducts} />
      </TabsContent>

      <TabsContent value="pricing">
        <PricingOptimizer products={orderItems.map(item => item.product_code)} />
      </TabsContent>
    </Tabs>
  );
};
