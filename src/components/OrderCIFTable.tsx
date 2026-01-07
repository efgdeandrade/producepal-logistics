import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { supabase } from '../integrations/supabase/client';
import { Calculator, Award, ChevronDown } from 'lucide-react';
import { Badge } from './ui/badge';
import { VolumetricWeightAlert } from './VolumetricWeightAlert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea, ScrollBar } from './ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import {
  CIFProductInput,
  CIFParams,
  CIFResult,
  DistributionMethod,
  calculateCIFByMethod,
  calculateTotalFreightFromRates,
  determineLimitingFactor,
  calculateTotals,
  DEFAULT_WHOLESALE_MULTIPLIER,
  DEFAULT_RETAIL_MULTIPLIER,
  DEFAULT_LOCAL_LOGISTICS_USD,
} from '../lib/cifCalculations';

interface OrderItem {
  product_code: string;
  quantity: number;
}

interface Product {
  code: string;
  name: string;
  pack_size: number;
  price_usd_per_unit: number;
  wholesale_price_xcg_per_unit?: number;
  retail_price_xcg_per_unit?: number;
  gross_weight_per_unit: number;
  netto_weight_per_unit: number;
  volumetric_weight_kg: number;
}

interface SupplierWeightData {
  supplierId: string;
  supplierName: string;
  actualWeightKg: number;
  volumetricWeightKg: number;
  palletsUsed: number;
  weightTypeUsed: 'actual' | 'volumetric';
}

interface ExtendedCIFResult extends CIFResult {
  trays: number;
  actualWeight: number;
  volumetricWeight: number;
  chargeableWeight: number;
  weightType: 'actual' | 'volumetric';
  suppliers: string;
}

interface OrderCIFTableProps {
  orderItems: OrderItem[];
  recommendedMethod?: string;
}

export function OrderCIFTable({ orderItems, recommendedMethod }: OrderCIFTableProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierWeights, setSupplierWeights] = useState<SupplierWeightData[]>([]);
  const [exchangeRate, setExchangeRate] = useState(1.82);
  const [distributionMethod, setDistributionMethod] = useState<DistributionMethod>('byWeight');
  const [localLogisticsUSD, setLocalLogisticsUSD] = useState(DEFAULT_LOCAL_LOGISTICS_USD);
  const [wholesaleMultiplier, setWholesaleMultiplier] = useState(DEFAULT_WHOLESALE_MULTIPLIER);
  const [retailMultiplier, setRetailMultiplier] = useState(DEFAULT_RETAIL_MULTIPLIER);
  const [loading, setLoading] = useState(true);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});
  const [freightExteriorPerKg] = useState(2.50);
  const [freightLocalPerKg] = useState(0.50);

  useEffect(() => {
    fetchData();
  }, [orderItems]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('code, name, pack_size, price_usd_per_unit, wholesale_price_xcg_per_unit, retail_price_xcg_per_unit, gross_weight_per_unit, netto_weight_per_unit, volumetric_weight_kg, supplier_id');

      if (productsError) {
        console.error("Error fetching products:", productsError);
        return;
      }

      setProducts(productsData || []);

      const initialSupplierWeights = productsData?.reduce((acc: SupplierWeightData[], product) => {
        if (product.supplier_id && !acc.find(s => s.supplierId === product.supplier_id)) {
          acc.push({
            supplierId: product.supplier_id,
            supplierName: `Supplier ${product.supplier_id}`,
            actualWeightKg: 0,
            volumetricWeightKg: 0,
            palletsUsed: 0,
            weightTypeUsed: 'actual',
          });
        }
        return acc;
      }, []) || [];

      setSupplierWeights(initialSupplierWeights);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getProductInfo = (code: string) => {
    return products.find(p => p.code === code);
  };

  const updateSupplierWeight = (supplierId: string, field: keyof SupplierWeightData, value: any) => {
    setSupplierWeights(prev => prev.map(sw =>
      sw.supplierId === supplierId ? { ...sw, [field]: value } : sw
    ));
  };

  const calculateCIFResults = (): ExtendedCIFResult[] => {
    if (loading) return [];

    // Convert order items to CIF product inputs
    const cifProducts: CIFProductInput[] = orderItems.map(item => {
      const product = getProductInfo(item.product_code);
      const packSize = product?.pack_size || 1;
      const grossWeight = (product?.gross_weight_per_unit || 0) / 1000; // Convert g to kg
      const volumetricWeight = product?.volumetric_weight_kg || 0;
      
      return {
        productCode: item.product_code,
        productName: product?.name || item.product_code,
        quantity: item.quantity,
        costPerUnit: product?.price_usd_per_unit || 0,
        actualWeight: item.quantity * grossWeight,
        volumetricWeight: item.quantity * volumetricWeight,
        wholesalePriceXCG: product?.wholesale_price_xcg_per_unit,
        retailPriceXCG: product?.retail_price_xcg_per_unit,
      };
    });

    if (cifProducts.length === 0) return [];

    // Calculate totals
    const totals = calculateTotals(cifProducts);
    const chargeableWeight = Math.max(totals.totalActualWeight, totals.totalVolumetricWeight);
    const limitingFactor = determineLimitingFactor(totals.totalActualWeight, totals.totalVolumetricWeight);

    // Calculate total freight
    const totalFreight = calculateTotalFreightFromRates(
      chargeableWeight,
      freightExteriorPerKg,
      freightLocalPerKg,
      localLogisticsUSD
    );

    // Create CIF params
    const cifParams: CIFParams = {
      totalFreight,
      exchangeRate,
      limitingFactor,
      wholesaleMultiplier,
      retailMultiplier,
    };

    // Calculate CIF by selected distribution method
    const cifResults = calculateCIFByMethod(cifProducts, cifParams, distributionMethod);

    // Extend results with additional fields
    return cifResults.map((result, index) => {
      const product = cifProducts[index];
      return {
        ...result,
        trays: orderItems[index]?.quantity || 0,
        actualWeight: product.actualWeight,
        volumetricWeight: product.volumetricWeight,
        chargeableWeight: Math.max(product.actualWeight, product.volumetricWeight),
        weightType: (product.volumetricWeight > product.actualWeight ? 'volumetric' : 'actual') as 'actual' | 'volumetric',
        suppliers: 'N/A',
      };
    });
  };

  const cifResults = calculateCIFResults();

  // Calculate total weights
  const totalActualWeight = cifResults.reduce((sum, r) => sum + r.actualWeight, 0);
  const totalVolumetricWeight = cifResults.reduce((sum, r) => sum + r.volumetricWeight, 0);
  const totalChargeableWeight = Math.max(totalActualWeight, totalVolumetricWeight);
  const limitingFactor = determineLimitingFactor(totalActualWeight, totalVolumetricWeight);
  const isChargedByVolumetric = limitingFactor === 'volumetric';
  const weightGapKg = isChargedByVolumetric ? totalVolumetricWeight - totalActualWeight : 0;
  const weightGapPercent = totalActualWeight > 0 ? (weightGapKg / totalActualWeight) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            CIF Calculation
          </CardTitle>
          <CardDescription>
            Calculate Cost, Insurance, and Freight (CIF) for this order
            {recommendedMethod && <span className="ml-2 text-primary">(Recommended: {recommendedMethod})</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Volumetric Weight Alert */}
          <VolumetricWeightAlert
            isChargedByVolumetric={isChargedByVolumetric}
            weightGapKg={weightGapKg}
            weightGapPercent={weightGapPercent}
            totalActualWeight={totalActualWeight}
            totalVolumetricWeight={totalVolumetricWeight}
            totalChargeableWeight={totalChargeableWeight}
            orderItems={cifResults}
            freightCostPerKg={freightExteriorPerKg}
            exchangeRate={exchangeRate}
          />

          {/* Distribution Method Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Distribution Method</label>
              <select
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={distributionMethod}
                onChange={(e) => setDistributionMethod(e.target.value as DistributionMethod)}
              >
                <option value="byWeight">By Weight</option>
                <option value="byCost">By Cost</option>
                <option value="equally">Equally</option>
                <option value="hybrid">Hybrid</option>
                <option value="strategic">Strategic</option>
                <option value="volumeOptimized">Volume Optimized</option>
                <option value="customerTier">Customer Tier</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Exchange Rate</label>
              <input
                type="number"
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Configurable Costs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Local Logistics (USD)</label>
              <input
                type="number"
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={localLogisticsUSD}
                onChange={(e) => setLocalLogisticsUSD(parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Wholesale Multiplier</label>
              <input
                type="number"
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={wholesaleMultiplier}
                onChange={(e) => setWholesaleMultiplier(parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Retail Multiplier</label>
              <input
                type="number"
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={retailMultiplier}
                onChange={(e) => setRetailMultiplier(parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Supplier Weight Inputs */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Supplier Weights</h3>
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
                      <Badge variant="outline">Supplier ID: {supplier.supplierId}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {supplier.actualWeightKg > 0 && <span>Actual: {supplier.actualWeightKg} kg</span>}
                      {supplier.volumetricWeightKg > 0 && <span>Vol: {supplier.volumetricWeightKg} kg</span>}
                      {supplier.palletsUsed > 0 && <span>Pallets: {supplier.palletsUsed}</span>}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Actual Weight (kg)</label>
                        <input
                          type="number"
                          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          value={supplier.actualWeightKg}
                          onChange={(e) => updateSupplierWeight(supplier.supplierId, 'actualWeightKg', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Volumetric Weight (kg)</label>
                        <input
                          type="number"
                          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          value={supplier.volumetricWeightKg}
                          onChange={(e) => updateSupplierWeight(supplier.supplierId, 'volumetricWeightKg', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Pallets Used</label>
                        <input
                          type="number"
                          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          value={supplier.palletsUsed}
                          onChange={(e) => updateSupplierWeight(supplier.supplierId, 'palletsUsed', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* CIF Results Table */}
      {cifResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              CIF Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead className="text-right">Cost (USD)</TableHead>
                    <TableHead className="text-right">Freight (USD)</TableHead>
                    <TableHead className="text-right">CIF/Unit (XCG)</TableHead>
                    <TableHead className="text-right">Wholesale (XCG)</TableHead>
                    <TableHead className="text-right">Retail (XCG)</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cifResults.map((result) => (
                    <TableRow key={result.productCode}>
                      <TableCell className="font-medium">{result.productName}</TableCell>
                      <TableCell className="text-right">{result.quantity}</TableCell>
                      <TableCell className="text-right">
                        {result.chargeableWeight.toFixed(2)} kg
                        <Badge variant={result.weightType === 'volumetric' ? 'destructive' : 'secondary'} className="ml-2">{result.weightType}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{result.costUSD.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{result.freightCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{result.cifPerUnit.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{result.wholesalePrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{result.retailPrice.toFixed(2)}</TableCell>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
