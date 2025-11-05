import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Calculator } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface OrderItem {
  product_code: string;
  quantity: number;
}

interface CIFResult {
  productCode: string;
  productName: string;
  quantity: number;
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
}

const EXCHANGE_RATE_KEY = 'cif_exchange_rate';
const DEFAULT_EXCHANGE_RATE = 1.82;

export const OrderCIFTable = ({ orderItems }: OrderCIFTableProps) => {
  const [cifResults, setCifResults] = useState<{
    byWeight: CIFResult[];
    byCost: CIFResult[];
    equally: CIFResult[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateCIF();
  }, [orderItems]);

  const calculateCIF = async () => {
    try {
      setLoading(true);

      // Get exchange rate from localStorage
      const savedRate = localStorage.getItem(EXCHANGE_RATE_KEY);
      const exchangeRate = savedRate ? parseFloat(savedRate) : DEFAULT_EXCHANGE_RATE;

      // Fetch product data for all order items
      const productCodes = [...new Set(orderItems.map(item => item.product_code))];
      const { data: products, error } = await supabase
        .from('products')
        .select('code, name, price_usd_per_unit, weight')
        .in('code', productCodes);

      if (error) throw error;

      const productMap = new Map(
        products?.map(p => [
          p.code,
          {
            name: p.name,
            costPerUnit: p.price_usd_per_unit || 0,
            weightPerUnit: p.weight || 0,
          },
        ]) || []
      );

      // Constants from CIF Calculator
      const LOCAL_LOGISTICS_XCG = 50;
      const LOCAL_LOGISTICS_USD = 91;
      const LABOR_XCG = 50;
      const FREIGHT_CHAMPION_PER_KG = 2.46;
      const SWISSPORT_PER_KG = 0.41;
      const WHOLESALE_MULTIPLIER = 1.25;
      const RETAIL_MULTIPLIER = 1.786;

      // Calculate totals
      const productsWithData = orderItems.map(item => {
        const productData = productMap.get(item.product_code);
        return {
          code: item.product_code,
          name: productData?.name || item.product_code,
          quantity: item.quantity,
          costPerUnit: productData?.costPerUnit || 0,
          weightPerUnit: productData?.weightPerUnit || 0,
        };
      });

      const totalWeight = productsWithData.reduce(
        (sum, p) => sum + p.quantity * p.weightPerUnit,
        0
      );
      const totalCost = productsWithData.reduce(
        (sum, p) => sum + p.quantity * p.costPerUnit,
        0
      );

      const freightChampion = totalWeight * FREIGHT_CHAMPION_PER_KG;
      const swissport = totalWeight * SWISSPORT_PER_KG;
      const totalFreight = LOCAL_LOGISTICS_USD + freightChampion + swissport;

      const calculateResults = (
        distributionMethod: 'weight' | 'cost' | 'equal'
      ): CIFResult[] => {
        return productsWithData.map(product => {
          const productWeight = product.quantity * product.weightPerUnit;
          const productCost = product.quantity * product.costPerUnit;

          let freightShare = 0;
          if (distributionMethod === 'weight') {
            freightShare = totalWeight > 0 ? (productWeight / totalWeight) * totalFreight : 0;
          } else if (distributionMethod === 'cost') {
            freightShare = totalCost > 0 ? (productCost / totalCost) * totalFreight : 0;
          } else {
            freightShare = totalFreight / productsWithData.length;
          }

          const cifUSD = productCost + freightShare;
          const cifXCG = cifUSD * exchangeRate + LABOR_XCG / productsWithData.length;
          const cifPerUnit = product.quantity > 0 ? cifXCG / product.quantity : 0;

          const wholesalePrice = cifPerUnit * WHOLESALE_MULTIPLIER;
          const retailPrice = cifPerUnit * RETAIL_MULTIPLIER;
          const wholesaleMargin = wholesalePrice - cifPerUnit;
          const retailMargin = retailPrice - cifPerUnit;

          return {
            productCode: product.code,
            productName: product.name,
            quantity: product.quantity,
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
      });
    } catch (error: any) {
      console.error('Error calculating CIF:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTable = (results: CIFResult[], title: string) => {
    if (!results || results.length === 0) return null;

    return (
      <div>
        <h3 className="text-sm font-semibold mb-3">{title}</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
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
            <p className="text-muted-foreground">Calculating CIF...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!cifResults) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          CIF Calculations
        </CardTitle>
        <CardDescription>
          Cost, Insurance, and Freight calculations for this order
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="weight" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
            <TabsTrigger value="weight">By Weight</TabsTrigger>
            <TabsTrigger value="cost">By Cost</TabsTrigger>
            <TabsTrigger value="equal">Equal</TabsTrigger>
          </TabsList>

          <TabsContent value="weight">
            {renderTable(cifResults.byWeight, 'Distribution by Weight')}
          </TabsContent>

          <TabsContent value="cost">
            {renderTable(cifResults.byCost, 'Distribution by Cost')}
          </TabsContent>

          <TabsContent value="equal">
            {renderTable(cifResults.equally, 'Equal Distribution')}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
