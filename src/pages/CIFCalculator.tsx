import { useState, useEffect } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Calculator, ArrowLeft, Package, AlertTriangle, Save, Printer, FileText, Download } from 'lucide-react';
import { PRODUCTS, ProductCode } from '@/types/order';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { calculateOrderPalletConfig, ProductWeightInfo, SupplierPalletData, createPalletConfig } from '@/lib/weightCalculations';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { exportToExcel, exportToPDF, printCalculation } from '@/utils/cifExportUtils';
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
} from '@/lib/cifCalculations';

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
    pallet_length_cm: number | null;
    pallet_width_cm: number | null;
    pallet_height_cm: number | null;
    pallet_weight_kg: number | null;
    pallet_max_height_cm: number | null;
  } | null;
}

interface ProductInput {
  code: ProductCode;
  name: string;
  quantity: number;
  quantityInputMode: 'units' | 'cases';
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
  supplierPalletConfig?: SupplierPalletData;
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
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE);
  const [freightExteriorPerKg, setFreightExteriorPerKg] = useState(2.46);
  const [freightLocalPerKg, setFreightLocalPerKg] = useState(0.41);
  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState<DatabaseProduct[]>([]);
  
  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [calculationName, setCalculationName] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<DistributionMethod>('byWeight');
  const [activeTab, setActiveTab] = useState<'estimate' | 'actual'>('estimate');

  // Estimate version inputs
  const [estimateProducts, setEstimateProducts] = useState<ProductInput[]>([]);

  // Actual version inputs
  const [actualProducts, setActualProducts] = useState<ProductInput[]>([]);
  const [actualFreightChampion, setActualFreightChampion] = useState(0);
  const [actualSwissport, setActualSwissport] = useState(0);

  // Configurable costs for Estimate
  const [localLogisticsUSD, setLocalLogisticsUSD] = useState(91);
  const [laborXCG, setLaborXCG] = useState(50);
  const [bankChargesUSD, setBankChargesUSD] = useState(0);

  // Configurable costs for Actual
  const [actualLocalLogisticsUSD, setActualLocalLogisticsUSD] = useState(91);
  const [actualLaborXCG, setActualLaborXCG] = useState(50);
  const [actualBankChargesUSD, setActualBankChargesUSD] = useState(0);

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

  // Initialize loading state
  useEffect(() => {
    if (allProducts.length > 0) {
      setLoading(false);
    }
  }, [allProducts]);

  // Load calculation from URL parameter
  useEffect(() => {
    const loadId = searchParams.get('load');
    if (loadId && allProducts.length > 0) {
      loadCalculation(loadId);
    }
  }, [searchParams, allProducts]);

  const handleExchangeRateChange = (value: string) => {
    const rate = parseFloat(value) || DEFAULT_EXCHANGE_RATE;
    setExchangeRate(rate);
  };

  const addProduct = (isActual: boolean = false) => {
    const products = isActual ? actualProducts : estimateProducts;
    const setProducts = isActual ? setActualProducts : setEstimateProducts;
    
    setProducts([...products, {
      code: '' as ProductCode,
      name: '',
      quantity: 1,
      quantityInputMode: 'units',
      costPerUnit: 0,
      weightPerUnit: 0,
    }]);
  };

  const updateProduct = (index: number, field: keyof ProductInput, value: any, isActual: boolean = false) => {
    const products = isActual ? actualProducts : estimateProducts;
    const setProducts = isActual ? setActualProducts : setEstimateProducts;
    
    const updated = [...products];
    
    if (field === 'code') {
      const selectedProduct = allProducts.find(p => p.code === value);
      if (selectedProduct) {
        const packSize = selectedProduct.pack_size || 1;
        const grossWeightPerUnit = selectedProduct.gross_weight_per_unit || 0;
        
        let volumetricWeightPerUnit = selectedProduct.volumetric_weight_kg || 0;
        if (!volumetricWeightPerUnit && selectedProduct.length_cm && selectedProduct.width_cm && selectedProduct.height_cm) {
          volumetricWeightPerUnit = (selectedProduct.length_cm * selectedProduct.width_cm * selectedProduct.height_cm) / 5000;
        }
        
        const chargeableWeightPerUnit = Math.max(grossWeightPerUnit, volumetricWeightPerUnit);
        
        updated[index] = {
          ...updated[index],
          code: value,
          name: selectedProduct.name,
          costPerUnit: selectedProduct.price_usd_per_unit || 0,
          weightPerUnit: grossWeightPerUnit,
          lengthCm: selectedProduct.length_cm || undefined,
          widthCm: selectedProduct.width_cm || undefined,
          heightCm: selectedProduct.height_cm || undefined,
          volumetricWeightPerUnit: volumetricWeightPerUnit || undefined,
          chargeableWeightPerUnit: chargeableWeightPerUnit,
          emptyCaseWeight: selectedProduct.empty_case_weight || undefined,
          packSize: packSize,
          supplierId: selectedProduct.supplier_id || undefined,
          supplierName: selectedProduct.suppliers?.name || undefined,
          supplierCasesPerPallet: selectedProduct.suppliers?.cases_per_pallet || undefined,
          supplierPalletConfig: selectedProduct.suppliers ? {
            pallet_length_cm: selectedProduct.suppliers.pallet_length_cm || undefined,
            pallet_width_cm: selectedProduct.suppliers.pallet_width_cm || undefined,
            pallet_height_cm: selectedProduct.suppliers.pallet_height_cm || undefined,
            pallet_weight_kg: selectedProduct.suppliers.pallet_weight_kg || undefined,
            pallet_max_height_cm: selectedProduct.suppliers.pallet_max_height_cm || undefined,
          } : undefined,
        };
      }
    } else if (field === 'quantityInputMode') {
      updated[index] = { ...updated[index], [field]: value };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    
    setProducts(updated);
  };

  const removeProduct = (index: number, isActual: boolean = false) => {
    const products = isActual ? actualProducts : estimateProducts;
    const setProducts = isActual ? setActualProducts : setEstimateProducts;
    setProducts(products.filter((_, i) => i !== index));
  };

  const convertToCIFProductInput = (product: ProductInput): CIFProductInput => {
    const totalQuantity = product.quantityInputMode === 'cases' 
      ? product.quantity * (product.packSize || 1)
      : product.quantity;
    
    const actualWeight = totalQuantity * product.weightPerUnit;
    const volumetricWeight = product.volumetricWeightPerUnit 
      ? totalQuantity * product.volumetricWeightPerUnit 
      : actualWeight;
    
    return {
      productCode: product.code,
      productName: product.name,
      quantity: totalQuantity,
      costPerUnit: product.costPerUnit,
      actualWeight,
      volumetricWeight,
      wholesalePriceXCG: product.wholesalePriceXCG,
      retailPriceXCG: product.retailPriceXCG,
      supplier: product.supplierName,
    };
  };

  const addPriceComparison = (result: BaseCIFResult, storedWholesale?: number, storedRetail?: number): CIFResult => {
    const wholesalePriceDiff = storedWholesale && storedWholesale > 0 
      ? result.wholesalePrice - storedWholesale 
      : undefined;
    const wholesalePriceDiffPercent = storedWholesale && storedWholesale > 0 
      ? ((result.wholesalePrice - storedWholesale) / storedWholesale) * 100 
      : undefined;
    const retailPriceDiff = storedRetail && storedRetail > 0 
      ? result.retailPrice - storedRetail 
      : undefined;
    const retailPriceDiffPercent = storedRetail && storedRetail > 0 
      ? ((result.retailPrice - storedRetail) / storedRetail) * 100 
      : undefined;

    return {
      productCode: result.productCode as ProductCode,
      productName: result.productName,
      quantity: result.quantity,
      costUSD: result.costUSD,
      freightCost: result.freightCost,
      cifUSD: result.cifUSD,
      cifXCG: result.cifXCG,
      wholesalePrice: result.wholesalePrice,
      retailPrice: result.retailPrice,
      wholesaleMargin: result.wholesaleMargin,
      retailMargin: result.retailMargin,
      storedWholesalePrice: storedWholesale,
      storedRetailPrice: storedRetail,
      calculatedWholesalePrice: result.wholesalePrice,
      calculatedRetailPrice: result.retailPrice,
      wholesalePriceDiff,
      wholesalePriceDiffPercent,
      retailPriceDiff,
      retailPriceDiffPercent,
    };
  };

  const calculateResults = (
    products: ProductInput[],
    LOCAL_LOGISTICS_USD: number,
    BANK_CHARGES_USD: number,
    freightChampionCost?: number,
    swissportCost?: number
  ) => {
    if (products.length === 0) {
      return {
        proportional: [],
        valueBased: [],
        byWeight: [],
        byCost: [],
        equally: [],
        hybrid: [],
        strategic: [],
        volumeOptimized: [],
        customerTier: [],
        limitingFactor: 'actual' as const,
        totalPallets: 0,
        totalActualWeight: 0,
        totalVolumetricWeight: 0,
        totalChargeableWeight: 0,
      };
    }

    // Create weight info for pallet calculation
    const productsWithWeight: ProductWeightInfo[] = products.map(p => ({
      code: p.code,
      name: p.name,
      packSize: p.packSize || 1,
      quantity: p.quantityInputMode === 'cases' ? p.quantity * (p.packSize || 1) : p.quantity,
      grossWeightPerUnit: p.weightPerUnit * 1000, // Convert kg to grams
      lengthCm: p.lengthCm,
      widthCm: p.widthCm,
      heightCm: p.heightCm,
      supplierId: p.supplierId,
      supplierName: p.supplierName,
    }));

    // Calculate order-level pallet configuration (includes pallet weights)
    const orderPalletConfig = calculateOrderPalletConfig(productsWithWeight as any);
    
    const totalActualWeight = orderPalletConfig.totalActualWeight;
    const totalVolumetricWeight = orderPalletConfig.totalVolumetricWeight;
    const totalChargeableWeight = orderPalletConfig.totalChargeableWeight;
    const totalPallets = orderPalletConfig.totalPallets;
    const limitingFactor = determineLimitingFactor(totalActualWeight, totalVolumetricWeight);

    // Calculate total freight: simple Tariff × Weight
    const totalFreight = freightChampionCost !== undefined && swissportCost !== undefined
      ? freightChampionCost + swissportCost + LOCAL_LOGISTICS_USD + BANK_CHARGES_USD
      : calculateTotalFreightFromRates(totalChargeableWeight, freightExteriorPerKg, freightLocalPerKg, LOCAL_LOGISTICS_USD, BANK_CHARGES_USD);

    // Convert products to CIFProductInput format
    const cifInputs: CIFProductInput[] = products.map(convertToCIFProductInput);

    // Create CIF params
    const cifParams: CIFParams = {
      totalFreight,
      exchangeRate,
      limitingFactor,
      wholesaleMultiplier: DEFAULT_WHOLESALE_MULTIPLIER,
      retailMultiplier: DEFAULT_RETAIL_MULTIPLIER,
    };

    // Calculate using simple methods
    const methods: DistributionMethod[] = ['byWeight', 'byCost'];
    const resultsMap: Record<string, CIFResult[]> = {};

    methods.forEach(method => {
      const baseResults = calculateCIFByMethod(cifInputs, cifParams, method);
      resultsMap[method] = baseResults.map((result, index) => 
        addPriceComparison(result, products[index].wholesalePriceXCG, products[index].retailPriceXCG)
      );
    });

    return {
      proportional: resultsMap.byWeight,
      valueBased: resultsMap.byCost,
      byWeight: resultsMap.byWeight,
      byCost: resultsMap.byCost,
      equally: resultsMap.byWeight,
      hybrid: resultsMap.byWeight,
      strategic: resultsMap.byWeight,
      volumeOptimized: resultsMap.byWeight,
      customerTier: resultsMap.byWeight,
      limitingFactor,
      totalPallets,
      totalActualWeight,
      totalVolumetricWeight,
      totalChargeableWeight,
    };
  };

  const estimateResults = calculateResults(estimateProducts, localLogisticsUSD, bankChargesUSD);
  const actualResults = calculateResults(actualProducts, actualLocalLogisticsUSD, actualBankChargesUSD, actualFreightChampion, actualSwissport);

  const handleSaveCalculation = async () => {
    if (!calculationName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for this calculation',
        variant: 'destructive',
      });
      return;
    }

    const products = activeTab === 'estimate' ? estimateProducts : actualProducts;
    const results = activeTab === 'estimate' ? estimateResults : actualResults;
    const LOCAL_LOGISTICS_USD = activeTab === 'estimate' ? localLogisticsUSD : actualLocalLogisticsUSD;
    const BANK_CHARGES_USD = activeTab === 'estimate' ? bankChargesUSD : actualBankChargesUSD;
    const LABOR_XCG = activeTab === 'estimate' ? laborXCG : actualLaborXCG;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Not authenticated',
          description: 'Please sign in to save calculations',
          variant: 'destructive',
        });
        return;
      }

      const insertData = {
        calculation_name: calculationName,
        calculation_type: activeTab,
        created_by: user.id,
        exchange_rate: exchangeRate,
        freight_exterior_per_kg: freightExteriorPerKg,
        freight_local_per_kg: freightLocalPerKg,
        local_logistics_usd: LOCAL_LOGISTICS_USD,
        bank_charges_usd: BANK_CHARGES_USD,
        labor_xcg: LABOR_XCG,
        selected_distribution_method: selectedMethod,
        freight_champion_cost: activeTab === 'actual' ? actualFreightChampion : null,
        swissport_cost: activeTab === 'actual' ? actualSwissport : null,
        total_pallets: results.totalPallets,
        total_chargeable_weight: results.totalChargeableWeight,
        limiting_factor: results.limitingFactor,
        products: products.map(p => ({
          code: p.code,
          name: p.name,
          quantity: p.quantity,
          quantityInputMode: p.quantityInputMode,
          costPerUnit: p.costPerUnit,
          weightPerUnit: p.weightPerUnit,
          volumetricWeightPerUnit: p.volumetricWeightPerUnit,
          packSize: p.packSize,
          supplierName: p.supplierName,
        })) as any,
        results: {
          byWeight: results.byWeight,
          byCost: results.byCost,
          limitingFactor: results.limitingFactor,
          totalPallets: results.totalPallets,
          totalActualWeight: results.totalActualWeight,
          totalVolumetricWeight: results.totalVolumetricWeight,
          totalChargeableWeight: results.totalChargeableWeight,
        } as any,
        notes,
      };

      const { error } = await supabase.from('cif_calculations').insert(insertData);

      if (error) throw error;

      toast({
        title: 'Calculation saved',
        description: `"${calculationName}" has been saved successfully`,
      });
      setShowSaveDialog(false);
      setCalculationName('');
      setNotes('');
    } catch (error) {
      console.error('Error saving calculation:', error);
      toast({
        title: 'Save failed',
        description: 'Could not save the calculation. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const loadCalculation = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('cif_calculations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setExchangeRate(data.exchange_rate);
        setFreightExteriorPerKg(data.freight_exterior_per_kg);
        setFreightLocalPerKg(data.freight_local_per_kg);
        
        const isActual = data.calculation_type === 'actual';
        setActiveTab(isActual ? 'actual' : 'estimate');

        const loadedProducts = (data.products as any[]).map(p => ({
          code: p.code as ProductCode,
          name: p.name,
          quantity: p.quantity,
          quantityInputMode: p.quantityInputMode || 'units',
          costPerUnit: p.costPerUnit,
          weightPerUnit: p.weightPerUnit,
          volumetricWeightPerUnit: p.volumetricWeightPerUnit,
          packSize: p.packSize,
          supplierName: p.supplierName,
        }));

        if (isActual) {
          setActualProducts(loadedProducts);
          setActualLocalLogisticsUSD(data.local_logistics_usd || 91);
          setActualBankChargesUSD(data.bank_charges_usd || 0);
          setActualLaborXCG(data.labor_xcg || 50);
          setActualFreightChampion(data.freight_champion_cost || 0);
          setActualSwissport(data.swissport_cost || 0);
        } else {
          setEstimateProducts(loadedProducts);
          setLocalLogisticsUSD(data.local_logistics_usd || 91);
          setBankChargesUSD(data.bank_charges_usd || 0);
          setLaborXCG(data.labor_xcg || 50);
        }

        setSelectedMethod(data.selected_distribution_method as DistributionMethod || 'byWeight');
        setNotes(data.notes || '');

        toast({
          title: 'Calculation loaded',
          description: `Loaded "${data.calculation_name}"`,
        });
      }
    } catch (error) {
      console.error('Error loading calculation:', error);
      toast({
        title: 'Load failed',
        description: 'Could not load the calculation',
        variant: 'destructive',
      });
    }
  };

  const handleExportExcel = () => {
    const results = activeTab === 'estimate' ? estimateResults : actualResults;
    const products = activeTab === 'estimate' ? estimateProducts : actualProducts;
    
    const metadata = {
      calculationType: activeTab,
      exchangeRate,
      freightExteriorPerKg,
      freightLocalPerKg,
      freightChampionCost: activeTab === 'actual' ? actualFreightChampion : undefined,
      swissportCost: activeTab === 'actual' ? actualSwissport : undefined,
      totalPallets: results.totalPallets || 0,
      totalChargeableWeight: results.totalChargeableWeight || 0,
      totalActualWeight: results.totalActualWeight || 0,
      totalVolumetricWeight: results.totalVolumetricWeight || 0,
      distributionMethod: selectedMethod,
      limitingFactor: results.limitingFactor || 'actual',
    };

    const productExport = results.byWeight.map((r, i) => ({
      code: r.productCode,
      name: r.productName,
      quantity: r.quantity,
      weightPerUnit: products[i]?.weightPerUnit || 0,
      totalWeight: r.quantity * (products[i]?.weightPerUnit || 0),
      freightAllocated: r.freightCost,
      cifPerUnit: r.cifXCG / r.quantity,
      wholesalePrice: r.wholesalePrice,
      margin: r.wholesaleMargin,
    }));

    exportToExcel(metadata, productExport, 'cif-calculation.xlsx');
  };

  const handleExportPDF = () => {
    exportToPDF('cif-results', 'cif-calculation');
  };

  const renderProductForm = (isActual: boolean = false) => {
    const products = isActual ? actualProducts : estimateProducts;
    
    return (
      <div className="space-y-4">
        {products.map((product, index) => (
          <Card key={index} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
              <div className="md:col-span-2">
                <Label>Product</Label>
                <Select
                  value={product.code}
                  onValueChange={(v) => updateProduct(index, 'code', v, isActual)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProducts.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.name} ({p.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Qty Mode</Label>
                <Select
                  value={product.quantityInputMode}
                  onValueChange={(v) => updateProduct(index, 'quantityInputMode', v, isActual)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="units">Units</SelectItem>
                    <SelectItem value="cases">Cases</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={product.quantity}
                  onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 0, isActual)}
                />
              </div>
              
              <div>
                <Label>Cost/Unit ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={product.costPerUnit}
                  onChange={(e) => updateProduct(index, 'costPerUnit', parseFloat(e.target.value) || 0, isActual)}
                />
              </div>
              
              <div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeProduct(index, isActual)}
                >
                  Remove
                </Button>
              </div>
            </div>
            
            {product.code && (
              <div className="mt-2 text-sm text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
                <span>Weight: {product.weightPerUnit?.toFixed(2)} kg</span>
                {product.volumetricWeightPerUnit && (
                  <span>Vol: {product.volumetricWeightPerUnit.toFixed(2)} kg</span>
                )}
                {product.packSize && <span>Pack: {product.packSize}</span>}
                {product.supplierName && <span>Supplier: {product.supplierName}</span>}
              </div>
            )}
          </Card>
        ))}
        
        <Button onClick={() => addProduct(isActual)} variant="outline" className="w-full">
          + Add Product
        </Button>
      </div>
    );
  };

  const renderResults = (results: CIFResult[], title: string) => {
    if (results.length === 0) {
      return (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Add products to see CIF calculations</p>
          </CardContent>
        </Card>
      );
    }

    const totalCIF = results.reduce((sum, r) => sum + r.cifXCG, 0);
    const totalFreight = results.reduce((sum, r) => sum + r.freightCost, 0);
    const totalCost = results.reduce((sum, r) => sum + r.costUSD, 0);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Product</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-right py-2">Cost ($)</th>
                  <th className="text-right py-2">Freight ($)</th>
                  <th className="text-right py-2">CIF ($)</th>
                  <th className="text-right py-2">CIF (XCG)</th>
                  <th className="text-right py-2">Wholesale</th>
                  <th className="text-right py-2">Retail</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2">{result.productName}</td>
                    <td className="text-right">{result.quantity}</td>
                    <td className="text-right">${result.costUSD.toFixed(2)}</td>
                    <td className="text-right">${result.freightCost.toFixed(2)}</td>
                    <td className="text-right">${result.cifUSD.toFixed(2)}</td>
                    <td className="text-right">{result.cifXCG.toFixed(2)}</td>
                    <td className="text-right">{result.wholesalePrice.toFixed(2)}</td>
                    <td className="text-right">{result.retailPrice.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td className="py-2">Total</td>
                  <td></td>
                  <td className="text-right">${totalCost.toFixed(2)}</td>
                  <td className="text-right">${totalFreight.toFixed(2)}</td>
                  <td className="text-right">${(totalCost + totalFreight).toFixed(2)}</td>
                  <td className="text-right">{totalCIF.toFixed(2)}</td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center">Loading products...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6" />
              CIF Calculator
            </h1>
            <p className="text-muted-foreground">Calculate landed costs using Tariff × Weight</p>
          </div>
        </div>
        
        <Button variant="outline" onClick={() => navigate('/import/cif-history')}>
          View History
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'estimate' | 'actual')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="estimate">Estimate (Pre-Order)</TabsTrigger>
          <TabsTrigger value="actual">Actual (Post-Arrival)</TabsTrigger>
        </TabsList>

        <TabsContent value="estimate" className="space-y-6">
          {/* Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Freight Settings</CardTitle>
              <CardDescription>Configure tariff rates for estimate calculation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>Exterior Tariff ($/kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={freightExteriorPerKg}
                    onChange={(e) => setFreightExteriorPerKg(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>Local Tariff ($/kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={freightLocalPerKg}
                    onChange={(e) => setFreightLocalPerKg(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>Exchange Rate (XCG/$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={exchangeRate}
                    onChange={(e) => handleExchangeRateChange(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Local Logistics ($)</Label>
                  <Input
                    type="number"
                    value={localLogisticsUSD}
                    onChange={(e) => setLocalLogisticsUSD(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Products</CardTitle>
              <CardDescription>Add products to calculate estimated CIF</CardDescription>
            </CardHeader>
            <CardContent>
              {renderProductForm(false)}
            </CardContent>
          </Card>

          {/* Results */}
          {estimateProducts.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Weight</p>
                      <p className="text-xl font-bold">{estimateResults.totalActualWeight?.toFixed(2)} kg</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Chargeable Weight</p>
                      <p className="text-xl font-bold">{estimateResults.totalChargeableWeight?.toFixed(2)} kg</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pallets</p>
                      <p className="text-xl font-bold">{estimateResults.totalPallets}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Limiting Factor</p>
                      <Badge variant={estimateResults.limitingFactor === 'volumetric' ? 'destructive' : 'secondary'}>
                        {estimateResults.limitingFactor}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex gap-2 flex-wrap">
                    <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                      <DialogTrigger asChild>
                        <Button>
                          <Save className="mr-2 h-4 w-4" />
                          Save Calculation
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Save Calculation</DialogTitle>
                          <DialogDescription>
                            Save this CIF calculation for future reference
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="calculation-name">Name</Label>
                            <Input
                              id="calculation-name"
                              placeholder="e.g., Weekly Import - Dec 2024"
                              value={calculationName}
                              onChange={(e) => setCalculationName(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="notes">Notes (Optional)</Label>
                            <Textarea
                              id="notes"
                              placeholder="Add any notes about this calculation..."
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Distribution Method</Label>
                            <Select value={selectedMethod} onValueChange={(v) => setSelectedMethod(v as DistributionMethod)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="byWeight">By Weight</SelectItem>
                                <SelectItem value="byCost">By Cost</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleSaveCalculation}>
                            Save
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button variant="outline" onClick={printCalculation}>
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                    <Button variant="outline" onClick={handleExportPDF}>
                      <FileText className="mr-2 h-4 w-4" />
                      PDF
                    </Button>
                    <Button variant="outline" onClick={handleExportExcel}>
                      <Download className="mr-2 h-4 w-4" />
                      Excel
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="byWeight" className="w-full" onValueChange={(v) => setSelectedMethod(v as DistributionMethod)}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="byWeight">By Weight</TabsTrigger>
                  <TabsTrigger value="byCost">By Cost</TabsTrigger>
                </TabsList>

                <div id="cif-results">
                  <TabsContent value="byWeight">
                    {renderResults(estimateResults.byWeight, 'Distribution by Weight')}
                  </TabsContent>
                  <TabsContent value="byCost">
                    {renderResults(estimateResults.byCost, 'Distribution by Cost')}
                  </TabsContent>
                </div>
              </Tabs>
            </>
          )}
        </TabsContent>

        <TabsContent value="actual" className="space-y-6">
          {/* Actual Freight Costs Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actual Freight Costs</CardTitle>
              <CardDescription>Enter the actual freight costs from invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>Freight Champion ($)</Label>
                  <Input
                    type="number"
                    value={actualFreightChampion}
                    onChange={(e) => setActualFreightChampion(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>Swissport ($)</Label>
                  <Input
                    type="number"
                    value={actualSwissport}
                    onChange={(e) => setActualSwissport(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>Local Logistics ($)</Label>
                  <Input
                    type="number"
                    value={actualLocalLogisticsUSD}
                    onChange={(e) => setActualLocalLogisticsUSD(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>Exchange Rate (XCG/$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={exchangeRate}
                    onChange={(e) => handleExchangeRateChange(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Products</CardTitle>
              <CardDescription>Add products to calculate actual CIF</CardDescription>
            </CardHeader>
            <CardContent>
              {renderProductForm(true)}
            </CardContent>
          </Card>

          {/* Results */}
          {actualProducts.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Weight</p>
                      <p className="text-xl font-bold">{actualResults.totalActualWeight?.toFixed(2)} kg</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Chargeable Weight</p>
                      <p className="text-xl font-bold">{actualResults.totalChargeableWeight?.toFixed(2)} kg</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Freight</p>
                      <p className="text-xl font-bold">${(actualFreightChampion + actualSwissport + actualLocalLogisticsUSD).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Limiting Factor</p>
                      <Badge variant={actualResults.limitingFactor === 'volumetric' ? 'destructive' : 'secondary'}>
                        {actualResults.limitingFactor}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex gap-2 flex-wrap">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button onClick={() => setShowSaveDialog(true)}>
                          <Save className="mr-2 h-4 w-4" />
                          Save Calculation
                        </Button>
                      </DialogTrigger>
                    </Dialog>
                    <Button variant="outline" onClick={printCalculation}>
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                    <Button variant="outline" onClick={handleExportPDF}>
                      <FileText className="mr-2 h-4 w-4" />
                      PDF
                    </Button>
                    <Button variant="outline" onClick={handleExportExcel}>
                      <Download className="mr-2 h-4 w-4" />
                      Excel
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="byWeight" className="w-full" onValueChange={(v) => setSelectedMethod(v as DistributionMethod)}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="byWeight">By Weight</TabsTrigger>
                  <TabsTrigger value="byCost">By Cost</TabsTrigger>
                </TabsList>

                <div id="cif-results">
                  <TabsContent value="byWeight">
                    {renderResults(actualResults.byWeight, 'Distribution by Weight')}
                  </TabsContent>
                  <TabsContent value="byCost">
                    {renderResults(actualResults.byCost, 'Distribution by Cost')}
                  </TabsContent>
                </div>
              </Tabs>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
