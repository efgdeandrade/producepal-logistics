import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface OrderItem {
  product_code: string;
  quantity: number;
}

interface CIFAnalyticsProps {
  orderItems: OrderItem[];
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

export const CIFAnalytics = ({ orderItems }: CIFAnalyticsProps) => {
  const [supplierCosts, setSupplierCosts] = useState<SupplierCost[]>([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [topMargins, setTopMargins] = useState<ProductMargin[]>([]);
  const [poorMargins, setPoorMargins] = useState<ProductMargin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateAnalytics();
  }, [orderItems]);

  const calculateAnalytics = async () => {
    try {
      setLoading(true);

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
      const productCodes = [...new Set(orderItems.map(item => item.product_code))];
      const { data: products } = await supabase
        .from('products')
        .select(`
          code, 
          name, 
          price_usd_per_unit, 
          weight,
          wholesale_price_xcg_per_unit,
          supplier_id,
          suppliers (name)
        `)
        .in('code', productCodes);

      if (!products) return;

      const LOCAL_LOGISTICS_USD = 91;
      const LABOR_XCG = 50;

      // Calculate total weight and freight
      const totalWeight = products.reduce((sum, p) => {
        const item = orderItems.find(i => i.product_code === p.code);
        return sum + (item?.quantity || 0) * (p.weight || 0);
      }, 0);

      const totalFreight = LOCAL_LOGISTICS_USD + 
                          (totalWeight * freightExteriorPerKg) + 
                          (totalWeight * freightLocalPerKg);

      // Calculate supplier costs
      const supplierMap = new Map<string, number>();
      let totalWholesaleRevenue = 0;
      let totalCost = 0;
      const productMargins: ProductMargin[] = [];

      products.forEach(product => {
        const item = orderItems.find(i => i.product_code === product.code);
        if (!item) return;

        const supplierName = (product.suppliers as any)?.name || 'Unknown Supplier';
        const productWeight = item.quantity * (product.weight || 0);
        const productCostUSD = item.quantity * (product.price_usd_per_unit || 0);
        
        // Calculate freight share by weight
        const freightShare = totalWeight > 0 ? (productWeight / totalWeight) * totalFreight : 0;
        
        // Calculate CIF in Cg
        const cifUSD = productCostUSD + freightShare;
        const cifXCG = cifUSD * exchangeRate + (LABOR_XCG / products.length);
        const cifPerUnit = item.quantity > 0 ? cifXCG / item.quantity : 0;
        
        // Wholesale price and margin
        const wholesalePricePerUnit = product.wholesale_price_xcg_per_unit || 0;
        const wholesaleRevenue = item.quantity * wholesalePricePerUnit;
        const profit = wholesaleRevenue - cifXCG;
        const marginPercentage = cifXCG > 0 ? (profit / cifXCG) * 100 : 0;

        totalWholesaleRevenue += wholesaleRevenue;
        totalCost += cifXCG;

        // Add to supplier map (cost in Cg)
        const currentCost = supplierMap.get(supplierName) || 0;
        supplierMap.set(supplierName, currentCost + cifXCG);

        productMargins.push({
          productCode: product.code,
          productName: product.name,
          marginPercentage,
          marginAmount: profit,
          quantity: item.quantity
        });
      });

      // Convert supplier map to array for pie chart
      const supplierArray = Array.from(supplierMap.entries()).map(([name, value]) => ({
        name,
        value: Math.round(value)
      }));

      setSupplierCosts(supplierArray);
      setTotalProfit(totalWholesaleRevenue - totalCost);

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

  return (
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
  );
};
