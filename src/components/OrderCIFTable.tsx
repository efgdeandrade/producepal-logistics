import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { supabase } from '../integrations/supabase/client';
import { Calculator, Award, ChevronDown } from 'lucide-react';
import { Badge } from './ui/badge';
import { VolumetricWeightAlert } from './VolumetricWeightAlert';
import {
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
  CIFResult as BaseCIFResult,
  DistributionMethod,
  calculateCIFByMethod,
  calculateTotalFreightFromRates,
  determineLimitingFactor,
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

interface CIFResult extends BaseCIFResult {
  productCode: string;
  productName: string;
  quantity: number;
  trays: number;
  actualWeight: number;
  volumetricWeight: number;
  chargeableWeight: number;
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
  suppliers: string;
  priceHistory?: {
    previousWholesale?: number;
    previousRetail?: number;
    wholesaleChange?: number;
    retailChange?: number;
    lastChangeDate?: string;
  };
}

interface OrderCIFTableProps {
  orderId: string;
  orderItems: OrderItem[];
  estimatedFreightExterior: number;
  estimatedFreightLocal: number;
}

export function OrderCIFTable({ orderId, orderItems, estimatedFreightExterior, estimatedFreightLocal }: OrderCIFTableProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierWeights, setSupplierWeights] = useState<SupplierWeightData[]>([]);
  const [exchangeRate, setExchangeRate] = useState(1.82);
  const [distributionMethod, setDistributionMethod] = useState<DistributionMethod>('weight');
  const [localLogisticsUSD, setLocalLogisticsUSD] = useState(DEFAULT_LOCAL_LOGISTICS_USD);
  const [wholesaleMultiplier, setWholesaleMultiplier] = useState(DEFAULT_WHOLESALE_MULTIPLIER);
  const [retailMultiplier, setRetailMultiplier] = useState(DEFAULT_RETAIL_MULTIPLIER);
  const [loading, setLoading] = useState(true);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
  }, [orderItems]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch products from Supabase
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('code, name, pack_size, price_usd_per_unit, wholesale_price_xcg_per_unit, retail_price_xcg_per_unit, gross_weight_per_unit, netto_weight_per_unit, volumetric_weight_kg, supplier_id');

      if (productsError) {
        console.error("Error fetching products:", productsError);
        return;
      }

      setProducts(productsData || []);

      // Initialize supplier weights
      const initialSupplierWeights = productsData?.reduce((acc: SupplierWeightData[], product) => {
        if (product.supplier_id && !acc.find(s => s.supplierId === product.supplier_id)) {
          acc.push({
            supplierId: product.supplier_id,
            supplierName: `Supplier ${product.supplier_id}`, // Replace with actual supplier name if available
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

  const calculateCIFResults = (): CIFResult[] => {
    if (loading) return [];

    // Prepare CIF parameters
    const cifParams: CIFParams = {
      products: orderItems.map(item => {
        const product = getProductInfo(item.product_code);
        return {
          code: item.product_code,
          name: product?.name || item.product_code,
          quantity: item.quantity,
          packSize: product?.pack_size || 1,
          priceUSDPerUnit: product?.price_usd_per_unit || 0,
          wholesalePriceXCGPerUnit: product?.wholesale_price_xcg_per_unit || 0,
          retailPriceXCGPerUnit: product?.retail_price_xcg_per_unit || 0,
          grossWeightPerUnit: product?.gross_weight_per_unit || 0,
          nettoWeightPerUnit: product?.netto_weight_per_unit || 0,
          volumetricWeightKg: product?.volumetric_weight_kg || 0,
        } as CIFProductInput;
      }),
      supplierWeights: supplierWeights.map(sw => ({
        supplierId: sw.supplierId,
        actualWeightKg: sw.actualWeightKg,
        volumetricWeightKg: sw.volumetricWeightKg,
        palletsUsed: sw.palletsUsed,
        weightTypeUsed: sw.weightTypeUsed,
      })),
      exchangeRate: exchangeRate,
      estimatedFreightExterior: estimatedFreightExterior,
      estimatedFreightLocal: estimatedFreightLocal,
      localLogisticsUSD: localLogisticsUSD,
      wholesaleMultiplier: wholesaleMultiplier,
      retailMultiplier: retailMultiplier,
    };

    // Calculate total freight from rates
    const totalFreight = calculateTotalFreightFromRates(
      cifParams.products,
      cifParams.supplierWeights,
      cifParams.exchangeRate,
      cifParams.estimatedFreightExterior,
      cifParams.estimatedFreightLocal,
      cifParams.localLogisticsUSD
    );

    // Determine if charged by volumetric weight
    const { isChargedByVolumetric, weightGapKg, weightGapPercent } = determineLimitingFactor(
      cifParams.products,
      cifParams.supplierWeights
    );

    // Calculate CIF by selected distribution method
    const cifResults = calculateCIFByMethod(cifParams, distributionMethod);

    return cifResults.map(result => ({
      ...result,
      productCode: result.productCode,
      productName: result.productName,
      quantity: result.quantity,
      trays: result.trays,
      actualWeight: result.actualWeight,
      volumetricWeight: result.volumetricWeight,
      chargeableWeight: result.chargeableWeight,
      weightType: result.weightType,
      costUSD: result.costUSD,
      freightCost: result.freightCost,
      cifUSD: result.cifUSD,
      cifXCG: result.cifXCG,
      cifPerUnit: result.cifPerUnit,
      wholesalePrice: result.wholesalePrice,
      retailPrice: result.retailPrice,
      wholesaleMargin: result.wholesaleMargin,
      retailMargin: result.retailMargin,
      suppliers: 'TODO',
    }));
  };

  const cifResults = calculateCIFResults();

  // Calculate total weights and determine if charged by volumetric
  const totalActualWeight = cifResults.reduce((sum, r) => sum + r.actualWeight, 0);
  const totalVolumetricWeight = cifResults.reduce((sum, r) => sum + r.volumetricWeight, 0);
  const totalChargeableWeight = Math.max(totalActualWeight, totalVolumetricWeight);
  const { isChargedByVolumetric, weightGapKg, weightGapPercent } = determineLimitingFactor(
    cifResults,
    supplierWeights.map(sw => ({
      supplierId: sw.supplierId,
      actualWeightKg: sw.actualWeightKg,
      volumetricWeightKg: sw.volumetricWeightKg,
      palletsUsed: sw.palletsUsed,
      weightTypeUsed: sw.weightTypeUsed,
    }))
  );

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
            freightCostPerKg={estimatedFreightExterior / totalChargeableWeight}
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
                <option value="weight">By Weight</option>
                <option value="cost">By Cost</option>
                <option value="equal">Equally</option>
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
                      {supplier.actualWeightKg && <span>Actual: {supplier.actualWeightKg} kg</span>}
                      {supplier.volumetricWeightKg && <span>Vol: {supplier.volumetricWeightKg} kg</span>}
                      {supplier.palletsUsed && <span>Pallets: {supplier.palletsUsed}</span>}
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
