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
  const [selectedMethod, setSelectedMethod] = useState('weight');
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

  const addProduct = (isActual: boolean) => {
    const newProduct: ProductInput = {
      code: '' as ProductCode,
      name: '',
      quantity: 0,
      quantityInputMode: 'cases',
      costPerUnit: 0,
      weightPerUnit: 0,
      packSize: undefined,
      supplierId: undefined,
      supplierName: undefined,
      supplierCasesPerPallet: undefined,
      supplierPalletConfig: undefined,
    };
    if (isActual) {
      setActualProducts([...actualProducts, newProduct]);
    } else {
      setEstimateProducts([...estimateProducts, newProduct]);
    }
  };

  const fetchProductData = async (productCode: string) => {
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        code, name, price_usd_per_unit, netto_weight_per_unit, gross_weight_per_unit, 
        pack_size, empty_case_weight, length_cm, width_cm, height_cm, volumetric_weight_kg,
        wholesale_price_xcg_per_unit, retail_price_xcg_per_unit,
        supplier_id, suppliers(
          name, 
          cases_per_pallet,
          pallet_length_cm,
          pallet_width_cm,
          pallet_height_cm,
          pallet_weight_kg,
          pallet_max_height_cm
        )
      `)
      .eq('code', productCode)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching product:', error);
      return null;
    }
    
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
      supplierPalletConfig: product.suppliers ? {
        pallet_length_cm: product.suppliers.pallet_length_cm,
        pallet_width_cm: product.suppliers.pallet_width_cm,
        pallet_height_cm: product.suppliers.pallet_height_cm,
        pallet_weight_kg: product.suppliers.pallet_weight_kg,
        pallet_max_height_cm: product.suppliers.pallet_max_height_cm
      } : undefined,
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
      } else {
        toast({
          title: "Product not found",
          description: `Product code "${value}" does not exist in the database.`,
          variant: "destructive",
        });
        return;
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

  const loadCalculation = async (calculationId: string) => {
    try {
      const { data, error } = await supabase
        .from('cif_calculations')
        .select('*')
        .eq('id', calculationId)
        .single();
      
      if (error) throw error;
      
      setExchangeRate(data.exchange_rate);
      setFreightExteriorPerKg(data.freight_exterior_per_kg);
      setFreightLocalPerKg(data.freight_local_per_kg);
      
      if (data.calculation_type === 'estimate') {
        setEstimateProducts(data.products as unknown as ProductInput[]);
        if (data.local_logistics_usd !== undefined) setLocalLogisticsUSD(data.local_logistics_usd);
        if (data.labor_xcg !== undefined) setLaborXCG(data.labor_xcg);
        if (data.bank_charges_usd !== undefined) setBankChargesUSD(data.bank_charges_usd);
        setActiveTab('estimate');
      } else {
        setActualProducts(data.products as unknown as ProductInput[]);
        setActualFreightChampion(data.freight_champion_cost || 0);
        setActualSwissport(data.swissport_cost || 0);
        if (data.local_logistics_usd !== undefined) setActualLocalLogisticsUSD(data.local_logistics_usd);
        if (data.labor_xcg !== undefined) setActualLaborXCG(data.labor_xcg);
        if (data.bank_charges_usd !== undefined) setActualBankChargesUSD(data.bank_charges_usd);
        setActiveTab('actual');
      }
      
      toast({
        title: "Loaded",
        description: `Calculation "${data.calculation_name}" loaded successfully`
      });
    } catch (error) {
      console.error('Error loading calculation:', error);
      toast({
        title: "Error",
        description: "Failed to load calculation",
        variant: "destructive"
      });
    }
  };

  const handleSaveCalculation = async () => {
    if (!calculationName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for this calculation",
        variant: "destructive"
      });
      return;
    }

    try {
      const calculationType = activeTab;
      const products = activeTab === 'estimate' ? estimateProducts : actualProducts;
      const results = activeTab === 'estimate' ? estimateResults : actualResults;
      
      // Check if there are valid products with quantity > 0 and product code
      const hasValidProducts = products.some(p => p.quantity > 0 && p.code);
      
      // Check if there are actual calculated results (not just an empty object)
      const hasCalculatedResults = results && (
        (results.byWeight && results.byWeight.length > 0) ||
        (results.byCost && results.byCost.length > 0) ||
        (results.totalChargeableWeight && results.totalChargeableWeight > 0)
      );
      
      if (!hasValidProducts || !hasCalculatedResults) {
        toast({
          title: "No Data",
          description: "Add products and calculate before saving",
          variant: "destructive"
        });
        return;
      }

      const saveData: any = {
        calculation_name: calculationName,
        calculation_type: calculationType,
        exchange_rate: exchangeRate,
        freight_exterior_per_kg: freightExteriorPerKg,
        freight_local_per_kg: freightLocalPerKg,
        freight_champion_cost: calculationType === 'actual' ? actualFreightChampion : null,
        swissport_cost: calculationType === 'actual' ? actualSwissport : null,
        local_logistics_usd: calculationType === 'estimate' ? localLogisticsUSD : actualLocalLogisticsUSD,
        labor_xcg: calculationType === 'estimate' ? laborXCG : actualLaborXCG,
        bank_charges_usd: calculationType === 'estimate' ? bankChargesUSD : actualBankChargesUSD,
        products: products,
        results: results,
        total_pallets: results.totalPallets,
        total_chargeable_weight: results.totalChargeableWeight,
        limiting_factor: results.limitingFactor,
        selected_distribution_method: selectedMethod,
        notes: notes,
        created_by: (await supabase.auth.getUser()).data.user?.id
      };
      
      const { error } = await supabase
        .from('cif_calculations')
        .insert([saveData]);
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Calculation saved successfully"
      });
      
      setShowSaveDialog(false);
      setCalculationName('');
      setNotes('');
    } catch (error) {
      console.error('Error saving calculation:', error);
      toast({
        title: "Error",
        description: "Failed to save calculation",
        variant: "destructive"
      });
    }
  };

  const handleExportExcel = () => {
    const results = activeTab === 'estimate' ? estimateResults : actualResults;
    const method = selectedMethod as keyof typeof results;
    const selectedResults = results[method] as CIFResult[];
    
    if (!selectedResults || selectedResults.length === 0) {
      toast({
        title: "No Data",
        description: "Please calculate results before exporting",
        variant: "destructive"
      });
      return;
    }

    const metadata = {
      calculationType: activeTab,
      exchangeRate,
      freightExteriorPerKg,
      freightLocalPerKg,
      freightChampionCost: activeTab === 'actual' ? actualFreightChampion : undefined,
      swissportCost: activeTab === 'actual' ? actualSwissport : undefined,
      totalPallets: results.totalPallets,
      totalChargeableWeight: results.totalChargeableWeight,
      totalActualWeight: results.totalActualWeight,
      totalVolumetricWeight: results.totalVolumetricWeight,
      distributionMethod: selectedMethod,
      limitingFactor: results.limitingFactor
    };

    const products = selectedResults.map(r => ({
      code: r.productCode,
      name: r.productName,
      quantity: r.quantity,
      weightPerUnit: r.costUSD / r.quantity || 0,
      totalWeight: r.costUSD,
      freightAllocated: r.freightCost,
      cifPerUnit: r.cifXCG,
      wholesalePrice: r.wholesalePrice,
      margin: r.wholesaleMargin
    }));

    exportToExcel(metadata, products, `CIF_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    exportToPDF('cif-results', `CIF_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const calculateCIF = (
    products: ProductInput[],
    freightChampionCost?: number,
    swissportCost?: number,
    localLogisticsUSD?: number,
    laborXCG?: number,
    bankChargesUSD?: number
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
    // Return empty results if no products have quantity
    const hasValidProducts = products.some(p => p.quantity > 0);
    if (!hasValidProducts) {
      return {
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

    // Use provided values or fall back to defaults
    const LOCAL_LOGISTICS_USD = localLogisticsUSD ?? 91;
    const LABOR_XCG = laborXCG ?? 50;
    const BANK_CHARGES_USD = bankChargesUSD ?? 0;
    const WHOLESALE_MULTIPLIER = 1.25;
    const RETAIL_MULTIPLIER = 1.786;

    // Convert products to weight info format
    const productsWithWeight: ProductWeightInfo[] = products.map(p => ({
      code: p.code,
      name: p.name,
      quantity: p.quantity,
      netWeightPerUnit: p.weightPerUnit * 1000,
      grossWeightPerUnit: p.weightPerUnit * 1000,
      emptyCaseWeight: (p.emptyCaseWeight || 0) * 1000,
      lengthCm: p.lengthCm,
      widthCm: p.widthCm,
      heightCm: p.heightCm,
      supplierId: p.supplierId || 'unknown',
      supplierName: p.supplierName || 'Unknown',
      supplierCasesPerPallet: p.supplierCasesPerPallet,
      supplierPalletConfig: p.supplierPalletConfig,
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
      ? (freightChampionCost + swissportCost + LOCAL_LOGISTICS_USD + BANK_CHARGES_USD)
      : (totalChargeableWeight * combinedTariffPerKg + LOCAL_LOGISTICS_USD + BANK_CHARGES_USD);

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
        const cifXCG = cifUSD * exchangeRate;
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
    if (!storedPrice || storedPrice === 0) {
      return (
        <div className="text-sm">
          <p className="font-semibold">{priceType} Price</p>
          <p>Current (Calculated): <span className="font-medium">Cg {currentPrice.toFixed(2)}</span></p>
          <p className="text-muted-foreground text-xs mt-1">No stored price in database</p>
        </div>
      );
    }

    const isHigher = priceDiff && priceDiff > 0;
    const diffColor = isHigher ? "text-red-500" : "text-green-500";

    return (
      <div className="text-sm space-y-1">
        <p className="font-semibold">{priceType} Price Comparison</p>
        <div className="space-y-1">
          <p>Database Price: <span className="font-medium">Cg {storedPrice.toFixed(2)}</span></p>
          <p>Calculated Price: <span className="font-medium">Cg {currentPrice.toFixed(2)}</span></p>
        </div>
        {priceDiff !== undefined && priceDiffPercent !== undefined && (
          <div className={`pt-1 border-t ${diffColor}`}>
            <p className="font-semibold">
              Difference: {isHigher ? '+' : ''}{priceDiff.toFixed(2)} ({priceDiffPercent.toFixed(1)}%)
            </p>
            <p className="text-xs">
              {isHigher ? '⚠️ Calculated price is higher than database' : '✓ Calculated price is lower than database'}
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
                      <SelectValue placeholder="Select product">
                        {product.name} {product.code && `(${product.code})`}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-popover max-h-[300px] z-50 overflow-y-auto">
                      {allProducts.map(p => (
                        <SelectItem key={p.code} value={p.code} className="cursor-pointer hover:bg-accent">
                          {p.name} ({p.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {product.code && !product.costPerUnit && !product.weightPerUnit && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Loading product data...
                    </div>
                  )}
                  {!product.code && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Please select a product
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>Quantity</Label>
                    <div className="flex gap-1">
                      <Button
                        variant={product.quantityInputMode === 'units' ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => updateProduct(index, 'quantityInputMode', 'units', isActual)}
                        disabled={!product.code || !product.weightPerUnit}
                      >
                        Units
                      </Button>
                      <Button
                        variant={product.quantityInputMode === 'cases' ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => updateProduct(index, 'quantityInputMode', 'cases', isActual)}
                        disabled={!product.code || !product.packSize}
                      >
                        Cases
                      </Button>
                    </div>
                  </div>
                  
                  {product.quantityInputMode === 'units' ? (
                    <div className="space-y-1">
                      <Input
                        type="number"
                        value={product.quantity || ''}
                        onChange={(e) => updateProduct(index, 'quantity', parseFloat(e.target.value) || 0, isActual)}
                        placeholder={product.weightPerUnit ? "Enter units" : "Select product first"}
                        disabled={!product.weightPerUnit}
                      />
                      {product.packSize && product.quantity > 0 && (
                        <p className="text-xs text-muted-foreground">
                          = {(product.quantity / product.packSize).toFixed(2)} cases
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Input
                        type="number"
                        value={product.packSize && product.quantity > 0 ? (product.quantity / product.packSize).toFixed(2) : ''}
                        onChange={(e) => {
                          if (!product.packSize) {
                            return;
                          }
                          const cases = parseFloat(e.target.value) || 0;
                          const units = cases * product.packSize;
                          updateProduct(index, 'quantity', units, isActual);
                        }}
                        placeholder={product.packSize ? "Enter cases" : "Select product first"}
                        disabled={!product.packSize}
                      />
                      {product.packSize && product.quantity > 0 && (
                        <p className="text-xs text-muted-foreground">
                          = {product.quantity} units
                        </p>
                      )}
                    </div>
                  )}
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

  const estimateResults = calculateCIF(estimateProducts, undefined, undefined, localLogisticsUSD, laborXCG, bankChargesUSD);
  const actualResults = calculateCIF(actualProducts, actualFreightChampion, actualSwissport, actualLocalLogisticsUSD, actualLaborXCG, actualBankChargesUSD);

  const renderWeightInfo = (results: ReturnType<typeof calculateCIF>) => {
    // Don't show weight info if no products have quantity
    if (!results.totalChargeableWeight || results.totalChargeableWeight === 0) return null;

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

            {/* Additional Costs - Estimate */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Additional Costs</CardTitle>
                <CardDescription>Configure logistics, labor, and bank charges</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Local Logistics (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={localLogisticsUSD}
                      onChange={(e) => setLocalLogisticsUSD(parseFloat(e.target.value) || 0)}
                      placeholder="Default: $91.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      If not applicable, use default $91.00
                    </p>
                  </div>
                  <div>
                    <Label>Labor Cost (XCG)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={laborXCG}
                      onChange={(e) => setLaborXCG(parseFloat(e.target.value) || 0)}
                      placeholder="Default: 50 XCG"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      If not applicable, use default 50 XCG
                    </p>
                  </div>
                  <div>
                    <Label>Bank Charges (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={bankChargesUSD}
                      onChange={(e) => setBankChargesUSD(parseFloat(e.target.value) || 0)}
                      placeholder="Enter bank charges"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Optional: Enter if applicable
                    </p>
                  </div>
                </div>
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

              {estimateProducts.some(p => p.quantity > 0) && (
                <Card className="mb-4">
                  <CardContent className="pt-6">
                    <div className="flex gap-2 justify-end flex-wrap">
                      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                        <DialogTrigger asChild>
                          <Button variant="default">
                            <Save className="mr-2 h-4 w-4" />
                            Save
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Save CIF Calculation</DialogTitle>
                            <DialogDescription>
                              Give this calculation a name to save it for later
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="calculation-name">Calculation Name</Label>
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
                              <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="weight">By Weight</SelectItem>
                                  <SelectItem value="cost">By Cost</SelectItem>
                                  <SelectItem value="equal">Equal Distribution</SelectItem>
                                  <SelectItem value="hybrid">Hybrid</SelectItem>
                                  <SelectItem value="strategic">Strategic</SelectItem>
                                  <SelectItem value="volumeOptimized">Volume-Optimized</SelectItem>
                                  <SelectItem value="customerTier">Customer Tier</SelectItem>
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
              )}

              <Tabs defaultValue="weight" className="w-full" onValueChange={setSelectedMethod as any}>
                <TabsList className="grid w-full grid-cols-7 mb-4">
                  <TabsTrigger value="weight">Weight</TabsTrigger>
                  <TabsTrigger value="cost">Cost</TabsTrigger>
                  <TabsTrigger value="equal">Equal</TabsTrigger>
                  <TabsTrigger value="hybrid">Hybrid</TabsTrigger>
                  <TabsTrigger value="strategic">Strategic</TabsTrigger>
                  <TabsTrigger value="volumeOptimized">Vol-Opt</TabsTrigger>
                  <TabsTrigger value="customerTier">Tier</TabsTrigger>
                </TabsList>

                <div id="cif-results">

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
                </div>

                <Separator className="my-6" />

                {/* Additional Costs - Actual */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Additional Costs</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure logistics, labor, and bank charges
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="actualLocalLogistics">Local Logistics (USD)</Label>
                      <Input
                        id="actualLocalLogistics"
                        type="number"
                        step="0.01"
                        placeholder="Default: $91.00"
                        value={actualLocalLogisticsUSD}
                        onChange={(e) => setActualLocalLogisticsUSD(parseFloat(e.target.value) || 0)}
                      />
                      <p className="text-xs text-muted-foreground">
                        If not applicable, use default $91.00
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="actualLaborCost">Labor Cost (XCG)</Label>
                      <Input
                        id="actualLaborCost"
                        type="number"
                        step="0.01"
                        placeholder="Default: 50 XCG"
                        value={actualLaborXCG}
                        onChange={(e) => setActualLaborXCG(parseFloat(e.target.value) || 0)}
                      />
                      <p className="text-xs text-muted-foreground">
                        If not applicable, use default 50 XCG
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="actualBankCharges">Bank Charges (USD)</Label>
                      <Input
                        id="actualBankCharges"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={actualBankChargesUSD}
                        onChange={(e) => setActualBankChargesUSD(parseFloat(e.target.value) || 0)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Optional: Enter if applicable
                      </p>
                    </div>
                  </div>
                </div>
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

              {actualProducts.some(p => p.quantity > 0) && (
                <Card className="mb-4">
                  <CardContent className="pt-6">
                    <div className="flex gap-2 justify-end flex-wrap">
                      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                        <DialogTrigger asChild>
                          <Button variant="default">
                            <Save className="mr-2 h-4 w-4" />
                            Save
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Save CIF Calculation</DialogTitle>
                            <DialogDescription>
                              Give this calculation a name to save it for later
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="calculation-name-actual">Calculation Name</Label>
                              <Input
                                id="calculation-name-actual"
                                placeholder="e.g., Weekly Import - Dec 2024"
                                value={calculationName}
                                onChange={(e) => setCalculationName(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="notes-actual">Notes (Optional)</Label>
                              <Textarea
                                id="notes-actual"
                                placeholder="Add any notes about this calculation..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>Distribution Method</Label>
                              <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="weight">By Weight</SelectItem>
                                  <SelectItem value="cost">By Cost</SelectItem>
                                  <SelectItem value="equal">Equal Distribution</SelectItem>
                                  <SelectItem value="hybrid">Hybrid</SelectItem>
                                  <SelectItem value="strategic">Strategic</SelectItem>
                                  <SelectItem value="volumeOptimized">Volume-Optimized</SelectItem>
                                  <SelectItem value="customerTier">Customer Tier</SelectItem>
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
              )}

              <Tabs defaultValue="weight" className="w-full" onValueChange={setSelectedMethod as any}>
                <TabsList className="grid w-full grid-cols-7 mb-4">
                  <TabsTrigger value="weight">Weight</TabsTrigger>
                  <TabsTrigger value="cost">Cost</TabsTrigger>
                  <TabsTrigger value="equal">Equal</TabsTrigger>
                  <TabsTrigger value="hybrid">Hybrid</TabsTrigger>
                  <TabsTrigger value="strategic">Strategic</TabsTrigger>
                  <TabsTrigger value="volumeOptimized">Vol-Opt</TabsTrigger>
                  <TabsTrigger value="customerTier">Tier</TabsTrigger>
                </TabsList>

                <div id="cif-results">

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
                </div>
              </Tabs>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
