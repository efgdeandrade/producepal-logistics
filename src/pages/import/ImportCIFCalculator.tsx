import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Plus, Trash2, Settings2, DollarSign, Package, Scale, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { resolveWeightCaseKg } from "@/lib/cifWeightResolver";
import {
  type CifProduct,
  type CifComponent,
  type CifSettings,
  type CifCalculationResult,
  DEFAULT_CIF_SETTINGS,
  DEFAULT_ALLOCATION_BASIS,
  COMPONENT_TYPES,
  calculateCIF,
  formatUSD,
  formatXCG,
} from "@/lib/cifEngine";

type UnitView = 'piece' | 'case' | 'kg';
type CurrencyView = 'USD' | 'XCG';

export default function ImportCIFCalculator() {
  const [products, setProducts] = useState<CifProduct[]>([]);
  const [components, setComponents] = useState<CifComponent[]>([]);
  const [settings, setSettings] = useState<CifSettings>(DEFAULT_CIF_SETTINGS);
  const [unitView, setUnitView] = useState<UnitView>('piece');
  const [currencyView, setCurrencyView] = useState<CurrencyView>('USD');

  // Fetch available products
  const { data: dbProducts } = useQuery({
    queryKey: ["cif-calculator-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, code, name, pack_size, weight, length_cm, width_cm, height_cm, price_usd_per_unit, supplier_id, empty_case_weight, netto_weight_per_unit, gross_weight_per_unit")
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  // Load global settings
  useQuery({
    queryKey: ["cif-global-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("key, value")
        .like("key", "cif_%");
      if (error) throw error;
      if (data) {
        const map = new Map(data.map(s => [s.key, s.value as any]));
        setSettings(prev => ({
          ...prev,
          fx_rate_usd_to_xcg: map.get("cif_fx_rate_usd_to_xcg")?.rate ?? prev.fx_rate_usd_to_xcg,
          champion_cost_per_kg: map.get("cif_champion_cost_per_kg")?.rate ?? prev.champion_cost_per_kg,
          swissport_cost_per_kg: map.get("cif_swissport_cost_per_kg")?.rate ?? prev.swissport_cost_per_kg,
          local_logistics_xcg: map.get("cif_local_logistics_cost")?.amount ?? prev.local_logistics_xcg,
          bank_charges_usd: map.get("cif_bank_charges")?.amount ?? prev.bank_charges_usd,
          spoilage_pct: map.get("cif_spoilage_allowance")?.percentage ?? prev.spoilage_pct,
          wholesale_margin_pct: map.get("cif_wholesale_margin")?.margin_pct ?? prev.wholesale_margin_pct,
          retail_margin_pct: map.get("cif_retail_margin")?.margin_pct ?? prev.retail_margin_pct,
        }));
      }
      return data;
    },
  });

  const addProduct = useCallback((productId: string) => {
    const dbProd = dbProducts?.find(p => p.id === productId);
    if (!dbProd) return;
    
    // Use canonical weight resolver
    const weightCaseKg = resolveWeightCaseKg({
      weight: dbProd.weight,
      netto_weight_per_unit: (dbProd as any).netto_weight_per_unit,
      gross_weight_per_unit: (dbProd as any).gross_weight_per_unit,
      empty_case_weight: (dbProd as any).empty_case_weight,
      pack_size: dbProd.pack_size,
    }).weight_case_kg || 0;

    const newProduct: CifProduct = {
      product_id: dbProd.id,
      product_code: dbProd.code,
      product_name: dbProd.name,
      qty_cases: 1,
      case_pack: dbProd.pack_size || 1,
      weight_case_kg: weightCaseKg,
      length_cm: Number(dbProd.length_cm) || 0,
      width_cm: Number(dbProd.width_cm) || 0,
      height_cm: Number(dbProd.height_cm) || 0,
      supplier_cost_usd_per_case: (Number(dbProd.price_usd_per_unit) || 0) * (dbProd.pack_size || 1),
    };
    setProducts(prev => [...prev, newProduct]);
  }, [dbProducts]);

  const removeProduct = (index: number) => {
    setProducts(prev => prev.filter((_, i) => i !== index));
  };

  const updateProduct = (index: number, field: keyof CifProduct, value: number) => {
    setProducts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const addComponent = (type: string) => {
    const comp: CifComponent = {
      component_type: type,
      label: COMPONENT_TYPES.find(t => t.value === type)?.label || type,
      status: 'received',
      currency: 'USD',
      amount: 0,
      allocation_basis: DEFAULT_ALLOCATION_BASIS[type] || 'equal',
    };
    setComponents(prev => [...prev, comp]);
  };

  const removeComponent = (index: number) => {
    setComponents(prev => prev.filter((_, i) => i !== index));
  };

  const updateComponent = (index: number, field: string, value: any) => {
    setComponents(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  // Run calculation
  const result: CifCalculationResult | null = useMemo(() => {
    if (products.length === 0) return null;
    try {
      return calculateCIF(products, components, settings);
    } catch (e) {
      console.error("CIF calculation error:", e);
      return null;
    }
  }, [products, components, settings]);

  const getPrice = (alloc: any, pricing: any, type: 'landed' | 'wholesale' | 'retail') => {
    const cur = currencyView.toLowerCase();
    const suffix = cur === 'usd' ? 'usd' : 'xcg';
    const fmt = currencyView === 'USD' ? formatUSD : formatXCG;

    if (type === 'landed') {
      const key = `landed_cost_per_${unitView}_${suffix}`;
      return fmt(alloc[key]);
    }
    const key = `${type}_price_per_${unitView}_${suffix}`;
    return fmt(pricing?.[key]);
  };

  // Auto-populate default cost components
  const addDefaultComponents = () => {
    const defaults: CifComponent[] = [
      { component_type: 'air_freight', label: 'Air Freight', status: 'pending', currency: 'USD', amount: 0, allocation_basis: 'chargeable_weight' },
      { component_type: 'champion', label: 'Champion', status: 'pending', currency: 'USD', amount: settings.champion_cost_per_kg * (result?.totals.total_chargeable_weight_kg || 0), allocation_basis: 'chargeable_weight' },
      { component_type: 'swissport', label: 'Swissport', status: 'pending', currency: 'USD', amount: settings.swissport_cost_per_kg * (result?.totals.total_chargeable_weight_kg || 0), allocation_basis: 'chargeable_weight' },
      { component_type: 'bank_charges', label: 'Bank Charges', status: 'pending', currency: 'USD', amount: settings.bank_charges_usd, allocation_basis: 'value' },
    ];
    // Add local logistics in XCG
    defaults.push({
      component_type: 'handling_terminal', label: 'Local Logistics', status: 'pending', currency: 'XCG', amount: settings.local_logistics_xcg, allocation_basis: 'cases'
    });
    setComponents(defaults);
    toast.success("Default cost components added");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="h-8 w-8" />
            CIF Calculator
          </h1>
          <p className="text-muted-foreground">
            Simulate landed cost calculations for planning and negotiations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={unitView} onValueChange={(v) => setUnitView(v as UnitView)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="piece">Per Piece</SelectItem>
              <SelectItem value="case">Per Case</SelectItem>
              <SelectItem value="kg">Per KG</SelectItem>
            </SelectContent>
          </Select>
          <Select value={currencyView} onValueChange={(v) => setCurrencyView(v as CurrencyView)}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="XCG">XCG</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT: Products + Components */}
        <div className="lg:col-span-2 space-y-4">
          {/* Products */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Products
                </CardTitle>
                <Select onValueChange={addProduct}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Add product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dbProducts?.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Add products to start calculating CIF
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="w-[80px]">Cases</TableHead>
                      <TableHead className="w-[80px]">Pcs/Case</TableHead>
                      <TableHead className="w-[100px]">Cost/Case</TableHead>
                      <TableHead className="w-[80px]">Wt/Case</TableHead>
                      <TableHead className="w-[80px]">Chrg Wt</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((prod, idx) => {
                      const line = result?.lines[idx];
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-sm">
                            <div>{prod.product_code}</div>
                            <div className="text-xs text-muted-foreground">{prod.product_name}</div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              value={prod.qty_cases}
                              onChange={e => updateProduct(idx, 'qty_cases', parseInt(e.target.value) || 0)}
                              className="h-8 w-16"
                            />
                          </TableCell>
                          <TableCell className="text-sm">{prod.case_pack}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={prod.supplier_cost_usd_per_case}
                              onChange={e => updateProduct(idx, 'supplier_cost_usd_per_case', parseFloat(e.target.value) || 0)}
                              className="h-8 w-20"
                            />
                          </TableCell>
                          <TableCell className="text-sm">{prod.weight_case_kg.toFixed(1)}kg</TableCell>
                          <TableCell className="text-sm font-medium">
                            {line ? `${line.chargeable_weight_kg.toFixed(1)}kg` : '—'}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeProduct(idx)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Cost Components */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Cost Components
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={addDefaultComponents}>
                    <Settings2 className="h-4 w-4 mr-1" />
                    Auto-Fill Defaults
                  </Button>
                  <Select onValueChange={addComponent}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Add cost..." />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPONENT_TYPES.map(ct => (
                        <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {components.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  Add cost components or use Auto-Fill
                </div>
              ) : (
                <div className="space-y-3">
                  {components.map((comp, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{comp.label}</div>
                        <div className="text-xs text-muted-foreground">
                          Allocate by: {comp.allocation_basis.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <Select 
                        value={comp.currency} 
                        onValueChange={v => updateComponent(idx, 'currency', v)}
                      >
                        <SelectTrigger className="w-[80px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="XCG">XCG</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="0.01"
                        value={comp.amount}
                        onChange={e => updateComponent(idx, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-[120px] h-8"
                      />
                      <Select
                        value={comp.allocation_basis}
                        onValueChange={v => updateComponent(idx, 'allocation_basis', v)}
                      >
                        <SelectTrigger className="w-[140px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="chargeable_weight">Chargeable Wt</SelectItem>
                          <SelectItem value="actual_weight">Actual Wt</SelectItem>
                          <SelectItem value="volume">Volume</SelectItem>
                          <SelectItem value="value">Value</SelectItem>
                          <SelectItem value="cases">Cases</SelectItem>
                          <SelectItem value="pieces">Pieces</SelectItem>
                          <SelectItem value="equal">Equal</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeComponent(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Settings + Summary */}
        <div className="space-y-4">
          {/* Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">FX Rate (USD→XCG)</Label>
                  <Input type="number" step="0.01" value={settings.fx_rate_usd_to_xcg}
                    onChange={e => setSettings(s => ({ ...s, fx_rate_usd_to_xcg: parseFloat(e.target.value) || 0 }))}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Spoilage %</Label>
                  <Input type="number" step="0.1" value={settings.spoilage_pct}
                    onChange={e => setSettings(s => ({ ...s, spoilage_pct: parseFloat(e.target.value) || 0 }))}
                    className="h-8"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Wholesale Margin %</Label>
                  <Input type="number" step="1" value={settings.wholesale_margin_pct}
                    onChange={e => setSettings(s => ({ ...s, wholesale_margin_pct: parseFloat(e.target.value) || 0 }))}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Retail Margin %</Label>
                  <Input type="number" step="1" value={settings.retail_margin_pct}
                    onChange={e => setSettings(s => ({ ...s, retail_margin_pct: parseFloat(e.target.value) || 0 }))}
                    className="h-8"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipment Summary */}
          {result && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Shipment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Cases</span>
                  <span className="font-medium">{result.totals.total_cases}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Pieces</span>
                  <span className="font-medium">{result.totals.total_pieces.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actual Weight</span>
                  <span className="font-medium">{result.totals.total_actual_weight_kg.toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Volumetric Weight</span>
                  <span className="font-medium">{result.totals.total_volumetric_weight_kg.toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Chargeable Weight</span>
                  <span>{result.totals.total_chargeable_weight_kg.toFixed(1)} kg</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier Cost</span>
                  <span className="font-medium">{formatUSD(result.totals.total_value_usd)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shared Costs</span>
                  <span className="font-medium">{formatUSD(result.total_shared_costs_usd)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>Total Landed</span>
                  <span className="text-primary">
                    {currencyView === 'USD' ? formatUSD(result.total_landed_usd) : formatXCG(result.total_landed_xcg)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Results Table */}
      {result && result.allocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              CIF Breakdown ({unitView === 'piece' ? 'Per Piece' : unitView === 'case' ? 'Per Case' : 'Per KG'} / {currencyView})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Supplier Cost</TableHead>
                  <TableHead className="text-right">Shared Costs</TableHead>
                  <TableHead className="text-right">Landed Cost</TableHead>
                  <TableHead className="text-right">Wholesale</TableHead>
                  <TableHead className="text-right">Retail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.allocations.map((alloc, idx) => {
                  const pricing = result.pricing[idx];
                  const fmt = currencyView === 'USD' ? formatUSD : formatXCG;
                  const suffix = currencyView === 'USD' ? 'usd' : 'xcg';
                  
                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="font-medium">{alloc.product_code}</div>
                        <div className="text-xs text-muted-foreground">{alloc.product_name}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {unitView === 'piece' ? alloc.qty_pieces : unitView === 'case' ? alloc.qty_cases : `${alloc.actual_weight_kg.toFixed(1)}kg`}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmt(alloc[`supplier_cost_${suffix}` as keyof typeof alloc] as number)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmt(alloc[`allocated_shared_costs_${suffix}` as keyof typeof alloc] as number)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {getPrice(alloc, pricing, 'landed')}
                      </TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-400">
                        {getPrice(alloc, pricing, 'wholesale')}
                      </TableCell>
                      <TableCell className="text-right text-blue-600 dark:text-blue-400">
                        {getPrice(alloc, pricing, 'retail')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
