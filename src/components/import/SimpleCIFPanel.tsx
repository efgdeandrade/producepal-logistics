import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Calculator, Save, Upload, DollarSign, Package, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { WarehouseDocumentUpload } from '@/components/WarehouseDocumentUpload';

interface OrderItem {
  id?: string;
  product_code: string;
  quantity: number;
  units_quantity?: number | null;
  is_from_stock?: boolean;
}

interface SimpleCIFPanelProps {
  orderId: string;
  orderItems: OrderItem[];
}

interface ProductCIF {
  productCode: string;
  productName: string;
  quantity: number;
  costPerUnitUSD: number;
  totalCostUSD: number;
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  weightType: 'actual' | 'volumetric';
  estimatedFreightUSD: number;
  estimatedCIFUSD: number;
  estimatedCIFXCG: number;
  estimatedCIFPerUnit: number;
  actualFreightUSD?: number;
  actualCIFUSD?: number;
  actualCIFXCG?: number;
  actualCIFPerUnit?: number;
}

interface FreightSettings {
  exteriorTariffPerKg: number;
  localTariffPerKg: number;
  exchangeRate: number;
}

export function SimpleCIFPanel({ orderId, orderItems }: SimpleCIFPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<FreightSettings>({
    exteriorTariffPerKg: 2.46,
    localTariffPerKg: 0.41,
    exchangeRate: 1.82,
  });
  
  // Actual costs inputs
  const [actualFreightExterior, setActualFreightExterior] = useState('');
  const [actualFreightLocal, setActualFreightLocal] = useState('');
  const [actualOtherCosts, setActualOtherCosts] = useState('');
  
  // Product data
  const [productsCIF, setProductsCIF] = useState<ProductCIF[]>([]);
  
  // Has saved actuals
  const [hasSavedActuals, setHasSavedActuals] = useState(false);

  useEffect(() => {
    loadData();
  }, [orderId, orderItems]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch settings
      const { data: settingsData } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['freight_exterior_tariff', 'freight_local_tariff', 'usd_to_xcg_rate']);
      
      const settingsMap = new Map(settingsData?.map(s => [s.key, s.value]) || []);
      const freightSettings: FreightSettings = {
        exteriorTariffPerKg: (settingsMap.get('freight_exterior_tariff') as any)?.rate || 2.46,
        localTariffPerKg: (settingsMap.get('freight_local_tariff') as any)?.rate || 0.41,
        exchangeRate: (settingsMap.get('usd_to_xcg_rate') as any)?.rate || 1.82,
      };
      setSettings(freightSettings);
      
      // Filter out stock items
      const importItems = orderItems.filter(item => !item.is_from_stock);
      
      // Consolidate by product code
      const consolidated = importItems.reduce((acc, item) => {
        const existing = acc.find(i => i.product_code === item.product_code);
        if (existing) {
          existing.quantity += item.quantity;
          if (item.units_quantity != null) {
            existing.units_quantity = (existing.units_quantity || 0) + item.units_quantity;
          }
        } else {
          acc.push({ ...item });
        }
        return acc;
      }, [] as OrderItem[]);
      
      // Fetch product details
      const productCodes = [...new Set(consolidated.map(i => i.product_code))];
      const { data: products } = await supabase
        .from('products')
        .select('code, name, price_usd_per_unit, gross_weight_per_unit, netto_weight_per_unit, pack_size, empty_case_weight, length_cm, width_cm, height_cm, volumetric_weight_kg')
        .in('code', productCodes);
      
      const productMap = new Map(products?.map(p => [p.code, p]) || []);
      
      // Calculate CIF for each product
      const cifProducts: ProductCIF[] = consolidated.map(item => {
        const product = productMap.get(item.product_code);
        if (!product) {
          return {
            productCode: item.product_code,
            productName: item.product_code,
            quantity: item.quantity,
            costPerUnitUSD: 0,
            totalCostUSD: 0,
            actualWeightKg: 0,
            volumetricWeightKg: 0,
            chargeableWeightKg: 0,
            weightType: 'actual' as const,
            estimatedFreightUSD: 0,
            estimatedCIFUSD: 0,
            estimatedCIFXCG: 0,
            estimatedCIFPerUnit: 0,
          };
        }
        
        const packSize = product.pack_size || 1;
        const totalUnits = item.units_quantity ?? (item.quantity * packSize);
        const costPerUnit = product.price_usd_per_unit || 0;
        const totalCost = totalUnits * costPerUnit;
        
        // Weight calculations
        const weightPerUnit = (product.gross_weight_per_unit || product.netto_weight_per_unit || 0) / 1000; // Convert to kg
        const emptyCaseWeight = (product.empty_case_weight || 0) / 1000;
        const actualWeight = (totalUnits * weightPerUnit) + (item.quantity * emptyCaseWeight);
        
        // Volumetric weight
        const volumetricWeightPerUnit = product.volumetric_weight_kg || 
          (product.length_cm && product.width_cm && product.height_cm 
            ? (product.length_cm * product.width_cm * product.height_cm) / 6000 
            : 0);
        const volumetricWeight = totalUnits * volumetricWeightPerUnit;
        
        const chargeableWeight = Math.max(actualWeight, volumetricWeight);
        const weightType = volumetricWeight > actualWeight ? 'volumetric' : 'actual';
        
        return {
          productCode: product.code,
          productName: product.name,
          quantity: totalUnits,
          costPerUnitUSD: costPerUnit,
          totalCostUSD: totalCost,
          actualWeightKg: actualWeight,
          volumetricWeightKg: volumetricWeight,
          chargeableWeightKg: chargeableWeight,
          weightType: weightType as 'actual' | 'volumetric',
          estimatedFreightUSD: 0, // Will be calculated in memo
          estimatedCIFUSD: 0,
          estimatedCIFXCG: 0,
          estimatedCIFPerUnit: 0,
        };
      });
      
      setProductsCIF(cifProducts);
      
      // Check for existing actual costs
      const { data: existingActuals } = await supabase
        .from('cif_estimates')
        .select('*')
        .eq('order_id', orderId)
        .not('actual_total_freight_usd', 'is', null)
        .limit(1);
      
      if (existingActuals && existingActuals.length > 0) {
        setHasSavedActuals(true);
        const firstActual = existingActuals[0];
        setActualFreightExterior(firstActual.actual_freight_exterior_usd?.toString() || '');
        setActualFreightLocal(firstActual.actual_freight_local_usd?.toString() || '');
        setActualOtherCosts(firstActual.actual_other_costs_usd?.toString() || '');
      }
      
    } catch (error) {
      console.error('Error loading CIF data:', error);
      toast.error('Failed to load CIF data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate estimates using Tariff × Weight formula
  const calculations = useMemo(() => {
    const totalChargeableWeight = productsCIF.reduce((sum, p) => sum + p.chargeableWeightKg, 0);
    const totalCostUSD = productsCIF.reduce((sum, p) => sum + p.totalCostUSD, 0);
    
    // Estimate: (Exterior Tariff + Local Tariff) × Chargeable Weight
    const combinedTariff = settings.exteriorTariffPerKg + settings.localTariffPerKg;
    const estimatedTotalFreightUSD = totalChargeableWeight * combinedTariff;
    
    // Distribute freight proportionally by weight
    const productsWithEstimate = productsCIF.map(product => {
      const weightRatio = totalChargeableWeight > 0 ? product.chargeableWeightKg / totalChargeableWeight : 0;
      const freightShare = estimatedTotalFreightUSD * weightRatio;
      const cifUSD = product.totalCostUSD + freightShare;
      const cifXCG = cifUSD * settings.exchangeRate;
      const cifPerUnit = product.quantity > 0 ? cifXCG / product.quantity : 0;
      
      return {
        ...product,
        estimatedFreightUSD: freightShare,
        estimatedCIFUSD: cifUSD,
        estimatedCIFXCG: cifXCG,
        estimatedCIFPerUnit: cifPerUnit,
      };
    });
    
    // Actual costs (if entered)
    const actualFreightExteriorNum = parseFloat(actualFreightExterior) || 0;
    const actualFreightLocalNum = parseFloat(actualFreightLocal) || 0;
    const actualOtherCostsNum = parseFloat(actualOtherCosts) || 0;
    const actualTotalFreightUSD = actualFreightExteriorNum + actualFreightLocalNum + actualOtherCostsNum;
    
    const productsWithActual = actualTotalFreightUSD > 0 
      ? productsWithEstimate.map(product => {
          const weightRatio = totalChargeableWeight > 0 ? product.chargeableWeightKg / totalChargeableWeight : 0;
          const actualFreightShare = actualTotalFreightUSD * weightRatio;
          const actualCIFUSD = product.totalCostUSD + actualFreightShare;
          const actualCIFXCG = actualCIFUSD * settings.exchangeRate;
          const actualCIFPerUnit = product.quantity > 0 ? actualCIFXCG / product.quantity : 0;
          
          return {
            ...product,
            actualFreightUSD: actualFreightShare,
            actualCIFUSD,
            actualCIFXCG,
            actualCIFPerUnit,
          };
        })
      : productsWithEstimate;
    
    return {
      products: productsWithActual,
      totals: {
        totalChargeableWeight,
        totalCostUSD,
        estimatedTotalFreightUSD,
        estimatedTotalCIFUSD: totalCostUSD + estimatedTotalFreightUSD,
        estimatedTotalCIFXCG: (totalCostUSD + estimatedTotalFreightUSD) * settings.exchangeRate,
        actualTotalFreightUSD,
        actualTotalCIFUSD: actualTotalFreightUSD > 0 ? totalCostUSD + actualTotalFreightUSD : null,
        actualTotalCIFXCG: actualTotalFreightUSD > 0 ? (totalCostUSD + actualTotalFreightUSD) * settings.exchangeRate : null,
        variance: actualTotalFreightUSD > 0 
          ? ((actualTotalFreightUSD - estimatedTotalFreightUSD) / estimatedTotalFreightUSD * 100) 
          : null,
      },
    };
  }, [productsCIF, settings, actualFreightExterior, actualFreightLocal, actualOtherCosts]);

  const handleSaveActuals = async () => {
    try {
      setSaving(true);
      
      const actualFreightExteriorNum = parseFloat(actualFreightExterior) || 0;
      const actualFreightLocalNum = parseFloat(actualFreightLocal) || 0;
      const actualOtherCostsNum = parseFloat(actualOtherCosts) || 0;
      
      if (actualFreightExteriorNum === 0 && actualFreightLocalNum === 0) {
        toast.error('Please enter at least one actual freight cost');
        return;
      }
      
      // Save to cif_estimates table
      for (const product of calculations.products) {
        await supabase
          .from('cif_estimates')
          .upsert({
            order_id: orderId,
            product_code: product.productCode,
            actual_weight_kg: product.actualWeightKg,
            volumetric_weight_kg: product.volumetricWeightKg,
            chargeable_weight_kg: product.chargeableWeightKg,
            weight_type_used: product.weightType,
            estimated_freight_exterior_usd: product.estimatedFreightUSD * 0.85, // ~85% exterior
            estimated_freight_local_usd: product.estimatedFreightUSD * 0.15, // ~15% local
            estimated_total_freight_usd: product.estimatedFreightUSD,
            actual_freight_exterior_usd: actualFreightExteriorNum,
            actual_freight_local_usd: actualFreightLocalNum,
            actual_other_costs_usd: actualOtherCostsNum,
            actual_total_freight_usd: product.actualFreightUSD || 0,
            variance_amount_usd: (product.actualFreightUSD || 0) - product.estimatedFreightUSD,
            variance_percentage: product.estimatedFreightUSD > 0 
              ? (((product.actualFreightUSD || 0) - product.estimatedFreightUSD) / product.estimatedFreightUSD * 100) 
              : 0,
            estimated_date: new Date().toISOString(),
          }, {
            onConflict: 'order_id,product_code',
          });
      }
      
      setHasSavedActuals(true);
      toast.success('Actual costs saved successfully!');
      
    } catch (error) {
      console.error('Error saving actual costs:', error);
      toast.error('Failed to save actual costs');
    } finally {
      setSaving(false);
    }
  };

  const handleDocumentExtraction = (extractedData: any) => {
    // Handle extraction from warehouse document
    if (extractedData.totalFreight) {
      const total = extractedData.totalFreight;
      setActualFreightExterior((total * 0.85).toFixed(2));
      setActualFreightLocal((total * 0.15).toFixed(2));
      toast.success('Freight costs extracted from document');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const stockItemCount = orderItems.filter(item => item.is_from_stock).length;

  return (
    <div className="space-y-6">
      {/* Header with formula explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            CIF Calculator
          </CardTitle>
          <CardDescription>
            <strong>Estimate Formula:</strong> (Exterior Tariff + Local Tariff) × Chargeable Weight
            <br />
            <span className="text-xs">
              Current rates: ${settings.exteriorTariffPerKg.toFixed(2)}/kg exterior + ${settings.localTariffPerKg.toFixed(2)}/kg local = ${(settings.exteriorTariffPerKg + settings.localTariffPerKg).toFixed(2)}/kg total
            </span>
          </CardDescription>
        </CardHeader>
      </Card>

      {stockItemCount > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg border text-sm">
          <span className="font-medium">{stockItemCount} item{stockItemCount !== 1 ? 's' : ''} from stock</span>
          <span className="text-muted-foreground"> excluded from CIF (already in warehouse)</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Package className="h-4 w-4" />
            Chargeable Weight
          </div>
          <div className="text-2xl font-bold">{calculations.totals.totalChargeableWeight.toFixed(2)} kg</div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <DollarSign className="h-4 w-4" />
            Product Cost
          </div>
          <div className="text-2xl font-bold">${calculations.totals.totalCostUSD.toFixed(2)}</div>
        </Card>
        
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/30">
          <div className="text-muted-foreground text-sm mb-1">Estimated CIF</div>
          <div className="text-2xl font-bold text-blue-600">${calculations.totals.estimatedTotalCIFUSD.toFixed(2)}</div>
          <div className="text-sm text-muted-foreground">Cg {calculations.totals.estimatedTotalCIFXCG.toFixed(2)}</div>
        </Card>
        
        {calculations.totals.actualTotalCIFUSD !== null && (
          <Card className="p-4 bg-green-50 dark:bg-green-950/30">
            <div className="text-muted-foreground text-sm mb-1">Actual CIF</div>
            <div className="text-2xl font-bold text-green-600">${calculations.totals.actualTotalCIFUSD.toFixed(2)}</div>
            <div className="flex items-center gap-1 text-sm">
              {calculations.totals.variance !== null && (
                <>
                  {calculations.totals.variance > 0 ? (
                    <TrendingUp className="h-3 w-3 text-destructive" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-green-600" />
                  )}
                  <span className={calculations.totals.variance > 0 ? 'text-destructive' : 'text-green-600'}>
                    {calculations.totals.variance > 0 ? '+' : ''}{calculations.totals.variance.toFixed(1)}%
                  </span>
                </>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Actual Costs Entry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Enter Actual Costs
          </CardTitle>
          <CardDescription>
            Enter the actual freight costs from your invoices after shipment arrival
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="freightExterior">Exterior Freight (USD)</Label>
              <Input
                id="freightExterior"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={actualFreightExterior}
                onChange={(e) => setActualFreightExterior(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="freightLocal">Local Freight (USD)</Label>
              <Input
                id="freightLocal"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={actualFreightLocal}
                onChange={(e) => setActualFreightLocal(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="otherCosts">Other Costs (USD)</Label>
              <Input
                id="otherCosts"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={actualOtherCosts}
                onChange={(e) => setActualOtherCosts(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button onClick={handleSaveActuals} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Actual Costs'}
            </Button>
            
            {hasSavedActuals && (
              <Badge variant="outline" className="bg-green-50 text-green-600">
                ✓ Actuals Saved
              </Badge>
            )}
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Or upload freight invoice (optional)
            </Label>
            <WarehouseDocumentUpload
              onDataExtracted={(data) => {
                // Extract total freight from parsed data if available
                if (data && data.length > 0) {
                  const totalFreight = data.reduce((sum, d) => sum + (d.actualWeightKg * (settings.exteriorTariffPerKg + settings.localTariffPerKg)), 0);
                  setActualFreightExterior((totalFreight * 0.85).toFixed(2));
                  setActualFreightLocal((totalFreight * 0.15).toFixed(2));
                  toast.success('Freight costs calculated from document');
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Product Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product CIF Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Weight (kg)</TableHead>
                  <TableHead className="text-right">Cost (USD)</TableHead>
                  <TableHead className="text-right">Est. Freight</TableHead>
                  <TableHead className="text-right">Est. CIF/Unit</TableHead>
                  {calculations.totals.actualTotalCIFUSD !== null && (
                    <>
                      <TableHead className="text-right">Act. Freight</TableHead>
                      <TableHead className="text-right">Act. CIF/Unit</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculations.products.map((product) => (
                  <TableRow key={product.productCode}>
                    <TableCell>
                      <div className="font-medium">{product.productCode}</div>
                      <div className="text-xs text-muted-foreground">{product.productName}</div>
                      {product.weightType === 'volumetric' && (
                        <Badge variant="outline" className="text-xs mt-1">Volumetric</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{product.quantity}</TableCell>
                    <TableCell className="text-right">{product.chargeableWeightKg.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${product.totalCostUSD.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${product.estimatedFreightUSD.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">
                      Cg {product.estimatedCIFPerUnit.toFixed(2)}
                    </TableCell>
                    {calculations.totals.actualTotalCIFUSD !== null && (
                      <>
                        <TableCell className="text-right">${product.actualFreightUSD?.toFixed(2) || '-'}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          Cg {product.actualCIFPerUnit?.toFixed(2) || '-'}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
