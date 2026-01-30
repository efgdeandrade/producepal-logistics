import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import LoadingBox from '@/components/LoadingBox';
import { OrderCIFTable } from '@/components/OrderCIFTable';
import { CIFAnalytics } from '@/components/CIFAnalytics';
import { DitoAdvisor } from '@/components/DitoAdvisor';
import { ActualCIFForm } from '@/components/ActualCIFForm';
import { CIFComparison } from '@/components/CIFComparison';
import { CIFLearningInsights } from '@/components/CIFLearningInsights';
import { PalletVisualization } from '@/components/PalletVisualization';
import { calculateOrderPalletConfig, ProductWeightInfo } from '@/lib/weightCalculations';
import { format } from 'date-fns';

interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
  is_from_stock?: boolean;
}

interface Order {
  id: string;
  order_number: string;
  week_number: number;
  delivery_date: string;
  placed_by: string;
  status: string;
}

const ImportOrderCIFView = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendedCIFMethod, setRecommendedCIFMethod] = useState<string>('');
  const [productWeightData, setProductWeightData] = useState<any[]>([]);
  const [palletConfig, setPalletConfig] = useState<any>(null);
  const [freightSettings, setFreightSettings] = useState({ freightCostPerKg: 2.87, exchangeRate: 1.82 });
  const [hasActualCosts, setHasActualCosts] = useState(false);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
      fetchFreightSettings();
      checkActualCosts();
    }
  }, [orderId]);

  const checkActualCosts = async () => {
    if (!orderId) return;
    const { data } = await supabase
      .from("cif_estimates")
      .select("id")
      .eq("order_id", orderId)
      .not("actual_total_freight_usd", "is", null)
      .limit(1);
    
    setHasActualCosts(data && data.length > 0);
  };

  const fetchFreightSettings = async () => {
    try {
      const { data: settings } = await supabase
        .from('settings')
        .select('*')
        .in('key', ['freight_exterior_tariff', 'freight_local_tariff', 'usd_to_xcg_rate']);

      const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);
      const exchangeRate = (settingsMap.get('usd_to_xcg_rate') as any)?.rate || 1.82;
      const freightExteriorPerKg = (settingsMap.get('freight_exterior_tariff') as any)?.rate || 2.46;
      const freightLocalPerKg = (settingsMap.get('freight_local_tariff') as any)?.rate || 0.41;
      const freightCostPerKg = freightExteriorPerKg + freightLocalPerKg;

      setFreightSettings({ freightCostPerKg, exchangeRate });
    } catch (error) {
      console.error('Error fetching freight settings:', error);
    }
  };

  const fetchOrderDetails = async () => {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      setOrder(orderData);
      setOrderItems(itemsData || []);
      
      await calculateWeightData(itemsData || []);
    } catch (error: any) {
      console.error('Error fetching order details:', error);
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const calculateWeightData = async (items: OrderItem[]) => {
    try {
      // Filter out stock items - they don't need CIF calculation (already in warehouse)
      const importItems = items.filter(item => !item.is_from_stock);
      
      const consolidated = importItems.reduce((acc, item) => {
        const existing = acc.find(i => i.product_code === item.product_code);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          acc.push({ ...item });
        }
        return acc;
      }, [] as OrderItem[]);

      const productCodes = [...new Set(consolidated.map(item => item.product_code))];
      const { data: products } = await supabase
        .from('products')
        .select(`
          code, name, price_usd_per_unit, gross_weight_per_unit, netto_weight_per_unit, 
          pack_size, empty_case_weight, wholesale_price_xcg_per_unit, retail_price_xcg_per_unit, 
          length_cm, width_cm, height_cm, volumetric_weight_kg, supplier_id,
          suppliers:supplier_id (id, name)
        `)
        .in('code', productCodes);

      if (!products) return;

      const productsWithWeight: Array<ProductWeightInfo & { supplierId: string; supplierName: string }> = consolidated
        .map(item => {
          const product = products.find(p => p.code === item.product_code);
          if (!product) return null;

          const supplier = product.suppliers as any;
          
          return {
            code: product.code,
            name: product.name,
            nettoWeightPerUnit: (product.netto_weight_per_unit || 0) / 1000,
            grossWeightPerUnit: (product.gross_weight_per_unit || 0) / 1000,
            packSize: product.pack_size || 1,
            emptyCaseWeight: (product.empty_case_weight || 0) / 1000,
            lengthCm: product.length_cm || 0,
            widthCm: product.width_cm || 0,
            heightCm: product.height_cm || 0,
            quantity: item.quantity * (product.pack_size || 1),
            supplierId: product.supplier_id || 'unknown',
            supplierName: supplier?.name || 'Unknown Supplier',
          };
        })
        .filter(Boolean) as Array<ProductWeightInfo & { supplierId: string; supplierName: string }>;

      const palletConfiguration = calculateOrderPalletConfig(productsWithWeight);
      setPalletConfig(palletConfiguration);

      let totalActualWeight = 0;
      let totalVolumetricWeight = 0;

      const weightData = consolidated.map(item => {
        const product = products.find(p => p.code === item.product_code);
        if (!product) return null;

        const packSize = product.pack_size || 1;
        const totalUnits = item.quantity * packSize;
        const weightPerUnit = (product.gross_weight_per_unit || product.netto_weight_per_unit || 0) / 1000;
        const volumetricWeightPerUnit = (product.volumetric_weight_kg || 
          (product.length_cm && product.width_cm && product.height_cm 
            ? (product.length_cm * product.width_cm * product.height_cm) / 6000
            : 0));

        const actualWeight = (totalUnits * weightPerUnit) + (item.quantity * (product.empty_case_weight || 0) / 1000);
        const volumetricWeight = (totalUnits * volumetricWeightPerUnit);
        const chargeableWeight = Math.max(actualWeight, volumetricWeight);

        totalActualWeight += actualWeight;
        totalVolumetricWeight += volumetricWeight;

        const wholesalePrice = product.wholesale_price_xcg_per_unit || 0;
        const retailPrice = product.retail_price_xcg_per_unit || 0;
        const costUSD = totalUnits * (product.price_usd_per_unit || 0);

        return {
          code: product.code,
          name: product.name,
          quantity: totalUnits,
          actualWeight,
          volumetricWeight,
          chargeableWeight,
          weightType: volumetricWeight > actualWeight ? 'volumetric' as const : 'actual' as const,
          costUSD,
          wholesalePriceXCG: wholesalePrice,
          retailPriceXCG: retailPrice,
          profitPerUnit: wholesalePrice - (costUSD * freightSettings.exchangeRate / totalUnits),
        };
      }).filter(Boolean);

      setProductWeightData(weightData);
    } catch (error) {
      console.error('Error calculating weight data:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingBox />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Order not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">CIF Estimation - {order.order_number}</CardTitle>
                <p className="text-muted-foreground mt-1">
                  Week {order.week_number} • Delivery: {format(new Date(order.delivery_date), 'EEEE, MMM d, yyyy')}
                </p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Placed by: {order.placed_by}</p>
                <p>Status: <span className="capitalize font-medium">{order.status}</span></p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* CIF Tabs - Full Width */}
        <Tabs defaultValue="items" className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="items">Order Items</TabsTrigger>
            <TabsTrigger value="pallets">Pallets</TabsTrigger>
            <TabsTrigger value="cif-analytics">CIF Analytics</TabsTrigger>
            <TabsTrigger value="advisor">Dito Advisor</TabsTrigger>
            <TabsTrigger value="actual">Enter Actual Costs</TabsTrigger>
            <TabsTrigger value="comparison">
              Comparison
              {hasActualCosts && <span className="ml-1 text-xs">✓</span>}
            </TabsTrigger>
            <TabsTrigger value="learning">AI Learning</TabsTrigger>
          </TabsList>

          {/* Filter out stock items for CIF calculations - they're already in warehouse */}
          {(() => {
            const cifOrderItems = orderItems.filter(item => !item.is_from_stock);
            const stockItemCount = orderItems.length - cifOrderItems.length;
            
            return (
              <>
                {stockItemCount > 0 && (
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg border text-sm">
                    <span className="font-medium">{stockItemCount} item{stockItemCount !== 1 ? 's' : ''} from stock</span>
                    <span className="text-muted-foreground"> excluded from CIF calculations (already in warehouse)</span>
                  </div>
                )}
                
                <TabsContent value="items" className="space-y-4">
                  <OrderCIFTable 
                    orderItems={cifOrderItems} 
                    recommendedMethod={recommendedCIFMethod}
                  />
                </TabsContent>

                <TabsContent value="pallets" className="space-y-4">
                  <PalletVisualization palletConfig={palletConfig} />
                </TabsContent>

                <TabsContent value="cif-analytics" className="space-y-4">
                  <CIFAnalytics 
                    orderItems={cifOrderItems} 
                    onRecommendation={setRecommendedCIFMethod}
                  />
                </TabsContent>

                <TabsContent value="advisor" className="space-y-4">
                  {productWeightData.length > 0 && palletConfig && (
                    <DitoAdvisor
                      orderItems={productWeightData}
                      palletConfiguration={palletConfig}
                      freightCostPerKg={freightSettings.freightCostPerKg}
                      exchangeRate={freightSettings.exchangeRate}
                      onApplySuggestion={(productCode, quantity) => {
                        toast.success(`Suggestion: Add ${quantity} units of ${productCode} to order`, {
                          description: 'You can manually add this product to improve weight utilization',
                        });
                      }}
                    />
                  )}
                </TabsContent>

                <TabsContent value="actual" className="space-y-4">
                  <ActualCIFForm
                    orderId={orderId!}
                    orderItems={cifOrderItems}
                    estimatedFreightExterior={palletConfig?.totalChargeableWeight * freightSettings.freightCostPerKg * 0.85 || 0}
                    estimatedFreightLocal={palletConfig?.totalChargeableWeight * freightSettings.freightCostPerKg * 0.15 || 0}
                    onSaved={() => {
                      checkActualCosts();
                      toast.success("Actual costs saved! Check the Comparison tab.");
                    }}
                  />
                </TabsContent>

                <TabsContent value="comparison" className="space-y-4">
                  <CIFComparison
                    orderId={orderId!}
                    orderItems={cifOrderItems}
                  />
                </TabsContent>

                <TabsContent value="learning" className="space-y-4">
                  <CIFLearningInsights />
                </TabsContent>
              </>
            );
          })()}
        </Tabs>
      </div>
    </div>
  );
};

export default ImportOrderCIFView;
