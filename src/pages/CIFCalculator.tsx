import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, ArrowLeft, Package, AlertTriangle } from 'lucide-react';
import { PRODUCTS, ProductCode } from '@/types/order';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { calculateOrderPalletConfig, ProductWeightInfo } from '@/lib/weightCalculations';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DatabaseProduct {
  code: string;
  name: string;
  price_usd_per_unit: number | null;
  netto_weight_per_unit: number | null;
  gross_weight_per_unit: number | null;
  pack_size: number;
  empty_case_weight: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  volumetric_weight_kg: number | null;
  supplier_id: string | null;
  suppliers: {
    name: string;
    cases_per_pallet: number | null;
  } | null;
}

interface ProductInput {
  code: ProductCode;
  name: string;
  quantity: number;
  costPerUnit: number;
  weightPerUnit: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  volumetricWeightPerUnit?: number;
  chargeableWeightPerUnit?: number;
  emptyCaseWeight?: number;
  packSize?: number;
  supplierId?: string;
  supplierName?: string;
  supplierCasesPerPallet?: number;
  wholesalePriceXCG?: number;
  retailPriceXCG?: number;
}

interface CIFResult {
  productCode: ProductCode;
  productName: string;
  quantity: number;
  costUSD: number;
  freightCost: number;
  cifUSD: number;
  cifXCG: number;
  wholesalePrice: number;
  retailPrice: number;
  wholesaleMargin: number;
  retailMargin: number;
  storedWholesalePrice?: number;
  storedRetailPrice?: number;
  calculatedWholesalePrice: number;
  calculatedRetailPrice: number;
  wholesalePriceDiff?: number;
  wholesalePriceDiffPercent?: number;
  retailPriceDiff?: number;
  retailPriceDiffPercent?: number;
}

const EXCHANGE_RATE_KEY = 'cif_exchange_rate';
const DEFAULT_EXCHANGE_RATE = 1.82;

export default function CIFCalculator() {
  const navigate = useNavigate();
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE);
  const [freightExteriorPerKg, setFreightExteriorPerKg] = useState(2.46);
  const [freightLocalPerKg, setFreightLocalPerKg] = useState(0.41);
  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState<DatabaseProduct[]>([]);

  // Estimate version inputs
  const [estimateProducts, setEstimateProducts] = useState<ProductInput[]>([
    { code: 'STB_500', name: 'Strawberries 500g', quantity: 0, costPerUnit: 0, weightPerUnit: 0 }
  ]);

  // Actual version inputs
  const [actualProducts, setActualProducts] = useState<ProductInput[]>([
    { code: 'STB_500', name: 'Strawberries 500g', quantity: 0, costPerUnit: 0, weightPerUnit: 0 }
  ]);
  const [actualFreightChampion, setActualFreightChampion] = useState(0);
  const [actualSwissport, setActualSwissport] = useState(0);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data: settings } = await supabase
          .from('settings')
          .select('*')
          .in('key', ['freight_exterior_tariff', 'freight_local_tariff', 'usd_to_xcg_rate']);

        const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);
        setExchangeRate((settingsMap.get('usd_to_xcg_rate') as any)?.rate || DEFAULT_EXCHANGE_RATE);
        setFreightExteriorPerKg((settingsMap.get('freight_exterior_tariff') as any)?.rate || 2.46);
        setFreightLocalPerKg((settingsMap.get('freight_local_tariff') as any)?.rate || 0.41);
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const { data: products } = await supabase
          .from('products')
          .select(`
            code, name, price_usd_per_unit, netto_weight_per_unit, gross_weight_per_unit,
            pack_size, empty_case_weight, length_cm, width_cm, height_cm, volumetric_weight_kg,
            supplier_id, suppliers(name, cases_per_pallet)
          `)
          .order('name');

        if (products) {
          setAllProducts(products as DatabaseProduct[]);
        }
      } catch (error) {
        console.error('Error loading products:', error);
      }
    };
    loadProducts();
  }, []);

  const handleExchangeRateChange = (value: string) => {
    const rate = parseFloat(value) || DEFAULT_EXCHANGE_RATE;
    setExchangeRate(rate);
  };

  const addProduct = (isActual: boolean) => {
    const firstProduct = allProducts[0];
    const newProduct: ProductInput = {
      code: firstProduct?.code as ProductCode || 'STB_500',
      name: firstProduct?.name || 'Select Product',
      quantity: 0,
      costPerUnit: 0,
      weightPerUnit: 0
    };
    if (isActual) {
      setActualProducts([...actualProducts, newProduct]);
    } else {
      setEstimateProducts([...estimateProducts, newProduct]);
    }
  };

  const fetchProductData = async (productCode: string) => {
    const { data: product } = await supabase
      .from('products')
      .select(`
        code, name, price_usd_per_unit, netto_weight_per_unit, gross_weight_per_unit, 
        pack_size, empty_case_weight, length_cm, width_cm, height_cm, volumetric_weight_kg,
        wholesale_price_xcg_per_unit, retail_price_xcg_per_unit,
        supplier_id, suppliers(name, cases_per_pallet)
      `)
      .eq('code', productCode)
      .single();
    
    if (product) {
      const weightPerUnit = (product.gross_weight_per_unit || product.netto_weight_per_unit || 0) / 1000;
      const volumetricWeightPerUnit = product.volumetric_weight_kg || 
        (product.length_cm && product.width_cm && product.height_cm 
          ? (product.length_cm * product.width_cm * product.height_cm) / 6000
          : 0);
      
      return {
        name: product.name,
        lengthCm: product.length_cm,
        widthCm: product.width_cm,
        heightCm: product.height_cm,
        volumetricWeightPerUnit,
        chargeableWeightPerUnit: Math.max(weightPerUnit, volumetricWeightPerUnit),
        emptyCaseWeight: product.empty_case_weight ? product.empty_case_weight / 1000 : 0,
        packSize: product.pack_size,
        supplierId: product.supplier_id,
        supplierName: product.suppliers?.name,
        supplierCasesPerPallet: product.suppliers?.cases_per_pallet,
        costPerUnit: product.price_usd_per_unit,
        weightPerUnit,
        wholesalePriceXCG: product.wholesale_price_xcg_per_unit,
        retailPriceXCG: product.retail_price_xcg_per_unit,
      };
    }
    return null;
  };

  const updateProduct = async (index: number, field: keyof ProductInput, value: any, isActual: boolean) => {
    const products = isActual ? actualProducts : estimateProducts;
    const setProducts = isActual ? setActualProducts : setEstimateProducts;
    
    const updated = [...products];
    if (field === 'code') {
      const dbData = await fetchProductData(value);
      if (dbData) {
        updated[index] = {
          ...updated[index],
          code: value as ProductCode,
          name: dbData.name || value,
          ...(dbData || {}),
        };
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setProducts(updated);
  };

  const removeProduct = (index: number, isActual: boolean) => {
    const products = isActual ? actualProducts : estimateProducts;
    const setProducts = isActual ? setActualProducts : setEstimateProducts;
    setProducts(products.filter((_, i) => i !== index));
  };

  const calculateCIF = (
    products: ProductInput[],
    freightChampionCost?: number,
    swissportCost?: number
  ): { 
    byWeight: CIFResult[], 
    byCost: CIFResult[], 
    equally: CIFResult[],
    hybrid: CIFResult[],
    strategic: CIFResult[],
    volumeOptimized: CIFResult[],
    customerTier: CIFResult[],
    limitingFactor: string,
    totalPallets: number,
    totalActualWeight: number,
    totalVolumetricWeight: number,
    totalChargeableWeight: number
  } => {
    const LOCAL_LOGISTICS_XCG = 50;
    const LOCAL_LOGISTICS_USD = 91;
    const LABOR_XCG = 50;
    const WHOLESALE_MULTIPLIER = 1.25;
    const RETAIL_MULTIPLIER = 1.786;

    // Convert products to weight info format
    const productsWithWeight: ProductWeightInfo[] = products.map(p => ({
      code: p.code,
      name: p.name,
      quantity: p.quantity * (p.packSize || 1),
      netWeightPerUnit: p.weightPerUnit * 1000,
      grossWeightPerUnit: p.weightPerUnit * 1000,
      emptyCaseWeight: (p.emptyCaseWeight || 0) * 1000,
      lengthCm: p.lengthCm,
      widthCm: p.widthCm,
      heightCm: p.heightCm,
      supplierId: p.supplierId || 'unknown',
      supplierName: p.supplierName || 'Unknown',
      supplierCasesPerPallet: p.supplierCasesPerPallet,
      packSize: p.packSize || 1,
    }));

    // Calculate order-level pallet configuration (includes pallet weights)
    const orderPalletConfig = calculateOrderPalletConfig(productsWithWeight as any);
    
    const totalActualWeight = orderPalletConfig.totalActualWeight;
    const totalVolumetricWeight = orderPalletConfig.totalVolumetricWeight;
    const totalChargeableWeight = orderPalletConfig.totalChargeableWeight;
    const totalPallets = orderPalletConfig.totalPallets;
    const limitingFactor = totalChargeableWeight === totalVolumetricWeight ? 'volumetric' : 'actual';

    const totalCost = products.reduce((sum, p) => sum + (p.quantity * p.costPerUnit), 0);

    const combinedTariffPerKg = freightExteriorPerKg + freightLocalPerKg;
    const totalFreightCost = freightChampionCost && swissportCost 
      ? (freightChampionCost + swissportCost + LOCAL_LOGISTICS_USD)
      : (totalChargeableWeight * combinedTariffPerKg + LOCAL_LOGISTICS_USD);

    const calculateResults = (distributionMethod: 'weight' | 'cost' | 'equal' | 'hybrid' | 'strategic' | 'volumeOptimized' | 'customerTier'): CIFResult[] => {
      return products.map(product => {
        const productActualWeightKg = (product.quantity * product.weightPerUnit) + 
          (product.quantity / (product.packSize || 1) * (product.emptyCaseWeight || 0));
        const productVolumetricWeightKg = (product.quantity * (product.volumetricWeightPerUnit || 0)) + 
          (product.quantity / (product.packSize || 1) * (product.emptyCaseWeight || 0));
        
        const productChargeableWeightKg = Math.max(productActualWeightKg, productVolumetricWeightKg);
        const productCost = product.quantity * product.costPerUnit;

        let freightShare = 0;
        
        switch (distributionMethod) {
          case 'weight':
            const productContribution = limitingFactor === 'volumetric' 
              ? productVolumetricWeightKg 
              : productActualWeightKg;
            freightShare = totalChargeableWeight > 0 
              ? (productContribution / totalChargeableWeight) * totalFreightCost 
              : 0;
            break;
            
          case 'cost':
            freightShare = totalCost > 0 ? (productCost / totalCost) * totalFreightCost : 0;
            break;
            
          case 'equal':
            freightShare = totalFreightCost / products.length;
            break;
            
          case 'hybrid':
            const weightShare = totalChargeableWeight > 0 
              ? (productChargeableWeightKg / totalChargeableWeight) * totalFreightCost * 0.5
              : 0;
            const costShare = totalCost > 0 
              ? (productCost / totalCost) * totalFreightCost * 0.5
              : 0;
            freightShare = weightShare + costShare;
            break;
            
          case 'strategic':
            const baseShare = totalChargeableWeight > 0 
              ? (productChargeableWeightKg / totalChargeableWeight) * totalFreightCost
              : 0;
            freightShare = baseShare;
            break;
            
          case 'volumeOptimized':
            const volumeEfficiency = productActualWeightKg > 0 
              ? productVolumetricWeightKg / productActualWeightKg 
              : 1;
            const penalty = volumeEfficiency > 1.2 ? volumeEfficiency : 1;
            const baseVolumeShare = totalChargeableWeight > 0 
              ? (productChargeableWeightKg / totalChargeableWeight) * totalFreightCost
              : 0;
            freightShare = baseVolumeShare * penalty;
            break;
            
          case 'customerTier':
            freightShare = totalChargeableWeight > 0 
              ? (productChargeableWeightKg / totalChargeableWeight) * totalFreightCost
              : 0;
            break;
        }

        const cifUSD = productCost + freightShare;
        const cifXCG = (cifUSD * exchangeRate) + (LABOR_XCG / products.length);
        const cifPerUnit = product.quantity > 0 ? cifXCG / product.quantity : 0;
        
        const wholesalePrice = cifPerUnit * WHOLESALE_MULTIPLIER;
        const retailPrice = cifPerUnit * RETAIL_MULTIPLIER;
        const wholesaleMargin = wholesalePrice - cifPerUnit;
        const retailMargin = retailPrice - cifPerUnit;

        const storedWholesalePrice = product.wholesalePriceXCG;
        const storedRetailPrice = product.retailPriceXCG;

        const wholesalePriceDiff = storedWholesalePrice 
          ? wholesalePrice - storedWholesalePrice 
          : undefined;
        const wholesalePriceDiffPercent = storedWholesalePrice && storedWholesalePrice !== 0
          ? (wholesalePriceDiff! / storedWholesalePrice) * 100
          : undefined;

        const retailPriceDiff = storedRetailPrice 
          ? retailPrice - storedRetailPrice 
          : undefined;
        const retailPriceDiffPercent = storedRetailPrice && storedRetailPrice !== 0
          ? (retailPriceDiff! / storedRetailPrice) * 100
          : undefined;

        return {
          productCode: product.code,
          productName: product.name,
          quantity: product.quantity,
          costUSD: productCost,
          freightCost: freightShare,
          cifUSD,
          cifXCG,
          wholesalePrice,
          retailPrice,
          wholesaleMargin,
          retailMargin,
          storedWholesalePrice,
          storedRetailPrice,
          calculatedWholesalePrice: wholesalePrice,
          calculatedRetailPrice: retailPrice,
          wholesalePriceDiff,
          wholesalePriceDiffPercent,
          retailPriceDiff,
          retailPriceDiffPercent,
        };
      });
    };

    return {
      byWeight: calculateResults('weight'),
      byCost: calculateResults('cost'),
      equally: calculateResults('equal'),
      hybrid: calculateResults('hybrid'),
      strategic: calculateResults('strategic'),
      volumeOptimized: calculateResults('volumeOptimized'),
      customerTier: calculateResults('customerTier'),
      limitingFactor,
      totalPallets,
      totalActualWeight,
      totalVolumetricWeight,
      totalChargeableWeight
    };
  };

  const renderPriceTooltip = (
    currentPrice: number,
    storedPrice: number | undefined,
    priceDiff: number | undefined,
    priceDiffPercent: number | undefined,
    priceType: 'Wholesale' | 'Retail'
  ) => {
    if (!storedPrice) {
      return (
        <div className="text-sm">
          <p className="font-semibold">{priceType} Price (Calculated)</p>
          <p>Cg {currentPrice.toFixed(2)}</p>
          <p className="text-muted-foreground mt-1">No stored price available</p>
        </div>
      );
    }

    const isHigher = priceDiff && priceDiff > 0;
    const diffColor = isHigher ? "text-red-500" : "text-green-500";

    return (
      <div className="text-sm space-y-1">
        <p className="font-semibold">{priceType} Price Comparison</p>
        <div className="space-y-1">
          <p>Current (Calculated): <span className="font-medium">Cg {currentPrice.toFixed(2)}</span></p>
          <p>Stored (Database): <span className="font-medium">Cg {storedPrice.toFixed(2)}</span></p>
        </div>
        {priceDiff !== undefined && priceDiffPercent !== undefined && (
          <div className={`pt-1 border-t ${diffColor}`}>
            <p className="font-semibold">
              Difference: Cg {Math.abs(priceDiff).toFixed(2)} ({isHigher ? '+' : ''}{priceDiffPercent.toFixed(2)}%)
            </p>
            <p className="text-xs text-muted-foreground">
              {isHigher ? 'Calculated price is higher' : 'Calculated price is lower'}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderResults = (results: CIFResult[], title: string) => {
    if (results.length === 0 || results.every(r => r.quantity === 0)) {
      return null;
    }

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Product</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2">CIF/Unit</th>
                  <th className="text-right p-2">Wholesale</th>
                  <th className="text-right p-2">W. Margin</th>
                  <th className="text-right p-2">W. %</th>
                  <th className="text-right p-2">Retail</th>
                  <th className="text-right p-2">R. Margin</th>
                  <th className="text-right p-2">R. %</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, idx) => {
                  const cifPerUnit = result.quantity > 0 ? result.cifXCG / result.quantity : 0;
                  const wholesaleMarginPercent = cifPerUnit > 0 
                    ? ((result.wholesalePrice - cifPerUnit) / cifPerUnit * 100)
                    : 0;
                  const retailMarginPercent = cifPerUnit > 0
                    ? ((result.retailPrice - cifPerUnit) / cifPerUnit * 100)
                    : 0;
                  
                  return (
                    <tr key={idx} className="border-b">
                      <td className="p-2">{result.productName}</td>
                      <td className="text-right p-2">{result.quantity}</td>
                      <td className="text-right p-2">cg {cifPerUnit.toFixed(2)}</td>
                      <td className="text-right p-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">
                              cg {result.wholesalePrice.toFixed(2)}
                            </TooltipTrigger>
                            <TooltipContent>
                              {renderPriceTooltip(
                                result.wholesalePrice,
                                result.storedWholesalePrice,
                                result.wholesalePriceDiff,
                                result.wholesalePriceDiffPercent,
                                'Wholesale'
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="text-right p-2 text-green-600">cg {result.wholesaleMargin.toFixed(2)}</td>
                      <td className="text-right p-2 text-green-600 font-semibold">{wholesaleMarginPercent.toFixed(1)}%</td>
                      <td className="text-right p-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">
                              cg {result.retailPrice.toFixed(2)}
                            </TooltipTrigger>
                            <TooltipContent>
                              {renderPriceTooltip(
                                result.retailPrice,
                                result.storedRetailPrice,
                                result.retailPriceDiff,
                                result.retailPriceDiffPercent,
                                'Retail'
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="text-right p-2 text-green-600">cg {result.retailMargin.toFixed(2)}</td>
                      <td className="text-right p-2 text-green-600 font-semibold">{retailMarginPercent.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderProductInputs = (products: ProductInput[], isActual: boolean) => {
    return (
      <div className="space-y-4">
        {products.map((product, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <Label>Product</Label>
                  <Select
                    value={product.code}
                    onValueChange={(value) => updateProduct(index, 'code', value as ProductCode, isActual)}
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover max-h-[300px] z-50">
                      {allProducts.map(p => (
                        <SelectItem key={p.code} value={p.code} className="cursor-pointer">
                          {p.name} ({p.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={product.quantity || ''}
                    onChange={(e) => updateProduct(index, 'quantity', parseFloat(e.target.value) || 0, isActual)}
                  />
                </div>
                <div>
                  <Label>Cost/Unit (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={product.costPerUnit || ''}
                    onChange={(e) => updateProduct(index, 'costPerUnit', parseFloat(e.target.value) || 0, isActual)}
                    placeholder="Auto-filled from DB"
                    className={product.costPerUnit ? "font-medium" : ""}
                  />
                  {product.costPerUnit && (
                    <div className="text-xs text-muted-foreground mt-1">
                      From database (editable)
                    </div>
                  )}
                </div>
                <div>
                  <Label>Weight/Unit (kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={product.weightPerUnit || ''}
                    onChange={(e) => updateProduct(index, 'weightPerUnit', parseFloat(e.target.value) || 0, isActual)}
                  />
                  {product.lengthCm && product.widthCm && product.heightCm && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Dims: {product.lengthCm}×{product.widthCm}×{product.heightCm}cm
                      {product.volumetricWeightPerUnit && (
                        <span> | Vol: {product.volumetricWeightPerUnit.toFixed(3)}kg</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeProduct(index, isActual)}
                    disabled={products.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        <Button onClick={() => addProduct(isActual)} variant="outline">
          Add Product
        </Button>
      </div>
    );
  };

  const estimateResults = calculateCIF(estimateProducts);
  const actualResults = calculateCIF(actualProducts, actualFreightChampion, actualSwissport);

  const renderWeightInfo = (results: ReturnType<typeof calculateCIF>) => {
    if (!results.totalChargeableWeight) return null;

    return (
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Actual Weight</div>
              <div className="font-semibold">{results.totalActualWeight.toFixed(2)} kg</div>
            </div>
            <div>
              <div className="text-muted-foreground">Volumetric Weight</div>
              <div className="font-semibold">{results.totalVolumetricWeight.toFixed(2)} kg</div>
            </div>
            <div>
              <div className="text-muted-foreground">Chargeable Weight</div>
              <div className="font-semibold">{results.totalChargeableWeight.toFixed(2)} kg</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total Pallets</div>
              <div className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                {results.totalPallets}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Charged By</div>
              <Badge variant={results.limitingFactor === 'volumetric' ? 'destructive' : 'default'}>
                {results.limitingFactor === 'volumetric' ? 'Volumetric' : 'Actual'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto py-8 px-4">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-foreground flex items-center gap-2">
              <Calculator className="h-8 w-8 text-primary" />
              CIF Calculator
            </h1>
            <p className="text-muted-foreground mt-2">Calculate Cost, Insurance, and Freight pricing</p>
          </div>
          <div className="w-48 ml-auto">
            <Label>Exchange Rate (USD to Cg)</Label>
            <Input
              type="number"
              step="0.01"
              value={exchangeRate}
              onChange={(e) => handleExchangeRateChange(e.target.value)}
            />
          </div>
        </div>

        <Tabs defaultValue="estimate" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
            <TabsTrigger value="estimate">Estimate</TabsTrigger>
            <TabsTrigger value="actual">Actual</TabsTrigger>
          </TabsList>

          <TabsContent value="estimate">
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Estimate Version</CardTitle>
                <CardDescription>
                  Enter estimated product details. Freight costs will be calculated automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderProductInputs(estimateProducts, false)}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-4">Results</h2>
              
              {renderWeightInfo(estimateResults)}
              
              {estimateResults.limitingFactor === 'volumetric' && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Charged by Volumetric Weight</AlertTitle>
                  <AlertDescription>
                    You're paying for {estimateResults.totalVolumetricWeight.toFixed(2)} kg but only shipping {estimateResults.totalActualWeight.toFixed(2)} kg.
                    That's {(estimateResults.totalVolumetricWeight - estimateResults.totalActualWeight).toFixed(2)} kg ({((estimateResults.totalVolumetricWeight - estimateResults.totalActualWeight) / estimateResults.totalActualWeight * 100).toFixed(1)}%) of "air".
                  </AlertDescription>
                </Alert>
              )}

              <Tabs defaultValue="weight" className="w-full">
                <TabsList className="grid w-full grid-cols-7 mb-4">
                  <TabsTrigger value="weight">Weight</TabsTrigger>
                  <TabsTrigger value="cost">Cost</TabsTrigger>
                  <TabsTrigger value="equal">Equal</TabsTrigger>
                  <TabsTrigger value="hybrid">Hybrid</TabsTrigger>
                  <TabsTrigger value="strategic">Strategic</TabsTrigger>
                  <TabsTrigger value="volumeOptimized">Vol-Opt</TabsTrigger>
                  <TabsTrigger value="customerTier">Tier</TabsTrigger>
                </TabsList>

                <TabsContent value="weight">
                  {renderResults(estimateResults.byWeight, 'Distribution by Weight')}
                </TabsContent>
                <TabsContent value="cost">
                  {renderResults(estimateResults.byCost, 'Distribution by Cost')}
                </TabsContent>
                <TabsContent value="equal">
                  {renderResults(estimateResults.equally, 'Equal Distribution')}
                </TabsContent>
                <TabsContent value="hybrid">
                  {renderResults(estimateResults.hybrid, 'Hybrid Method (50% Weight + 50% Cost)')}
                </TabsContent>
                <TabsContent value="strategic">
                  {renderResults(estimateResults.strategic, 'Strategic Method')}
                </TabsContent>
                <TabsContent value="volumeOptimized">
                  {renderResults(estimateResults.volumeOptimized, 'Volume-Optimized (Penalizes Air Space)')}
                </TabsContent>
                <TabsContent value="customerTier">
                  {renderResults(estimateResults.customerTier, 'Customer Tier Method')}
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          <TabsContent value="actual">
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Actual Version</CardTitle>
                <CardDescription>
                  Enter actual costs from your agents for precise calculations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {renderProductInputs(actualProducts, true)}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t">
                  <div>
                    <Label>Freight Champion Total Cost (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={actualFreightChampion || ''}
                      onChange={(e) => setActualFreightChampion(parseFloat(e.target.value) || 0)}
                      placeholder="Enter actual cost from agent"
                    />
                  </div>
                  <div>
                    <Label>Swissport Total Cost (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={actualSwissport || ''}
                      onChange={(e) => setActualSwissport(parseFloat(e.target.value) || 0)}
                      placeholder="Enter actual cost from agent"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-4">Results</h2>
              
              {renderWeightInfo(actualResults)}
              
              {actualResults.limitingFactor === 'volumetric' && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Charged by Volumetric Weight</AlertTitle>
                  <AlertDescription>
                    You're paying for {actualResults.totalVolumetricWeight.toFixed(2)} kg but only shipping {actualResults.totalActualWeight.toFixed(2)} kg.
                    That's {(actualResults.totalVolumetricWeight - actualResults.totalActualWeight).toFixed(2)} kg ({((actualResults.totalVolumetricWeight - actualResults.totalActualWeight) / actualResults.totalActualWeight * 100).toFixed(1)}%) of "air".
                  </AlertDescription>
                </Alert>
              )}

              <Tabs defaultValue="weight" className="w-full">
                <TabsList className="grid w-full grid-cols-7 mb-4">
                  <TabsTrigger value="weight">Weight</TabsTrigger>
                  <TabsTrigger value="cost">Cost</TabsTrigger>
                  <TabsTrigger value="equal">Equal</TabsTrigger>
                  <TabsTrigger value="hybrid">Hybrid</TabsTrigger>
                  <TabsTrigger value="strategic">Strategic</TabsTrigger>
                  <TabsTrigger value="volumeOptimized">Vol-Opt</TabsTrigger>
                  <TabsTrigger value="customerTier">Tier</TabsTrigger>
                </TabsList>

                <TabsContent value="weight">
                  {renderResults(actualResults.byWeight, 'Distribution by Weight')}
                </TabsContent>
                <TabsContent value="cost">
                  {renderResults(actualResults.byCost, 'Distribution by Cost')}
                </TabsContent>
                <TabsContent value="equal">
                  {renderResults(actualResults.equally, 'Equal Distribution')}
                </TabsContent>
                <TabsContent value="hybrid">
                  {renderResults(actualResults.hybrid, 'Hybrid Method (50% Weight + 50% Cost)')}
                </TabsContent>
                <TabsContent value="strategic">
                  {renderResults(actualResults.strategic, 'Strategic Method')}
                </TabsContent>
                <TabsContent value="volumeOptimized">
                  {renderResults(actualResults.volumeOptimized, 'Volume-Optimized (Penalizes Air Space)')}
                </TabsContent>
                <TabsContent value="customerTier">
                  {renderResults(actualResults.customerTier, 'Customer Tier Method')}
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
