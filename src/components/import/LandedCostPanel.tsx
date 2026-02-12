import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calculator, Save, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  type CifProduct,
  type CifComponent,
  type CifSettings,
  DEFAULT_CIF_SETTINGS,
  calculateCIF,
  formatUSD,
  formatXCG,
} from "@/lib/cifEngine";
import { CifComponentManager } from "./CifComponentManager";
import { CifDocumentUpload } from "./CifDocumentUpload";
import { GoogleDriveFileBrowser } from "./GoogleDriveFileBrowser";
import { AsycudaMetadataSection } from "./AsycudaMetadataSection";
import { CifAIAuditor } from "./CifAIAuditor";
import { CifReadinessChecker } from "./CifReadinessChecker";

interface LandedCostPanelProps {
  orderId: string;
}

type UnitView = 'piece' | 'case' | 'kg';
type CurrencyView = 'usd' | 'xcg';
type VersionType = 'estimate' | 'actual';
type AllocationMethod = 'chargeable_weight' | 'actual_weight' | 'volume' | 'value' | 'cases' | 'pieces' | 'equal';

const ALLOCATION_METHOD_LABELS: Record<AllocationMethod, string> = {
  chargeable_weight: 'Chargeable Wt',
  actual_weight: 'Actual Wt',
  volume: 'Volume',
  value: 'Value',
  cases: 'Cases',
  pieces: 'Pieces',
  equal: 'Equal',
};

export function LandedCostPanel({ orderId }: LandedCostPanelProps) {
  const queryClient = useQueryClient();
  const [unitView, setUnitView] = useState<UnitView>('piece');
  const [currencyView, setCurrencyView] = useState<CurrencyView>('xcg');
  const [saving, setSaving] = useState(false);
  const [versionType, setVersionType] = useState<VersionType>('estimate');
  const [components, setComponents] = useState<CifComponent[]>([]);
  const [showReadiness, setShowReadiness] = useState(false);
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>('chargeable_weight');

  // Fetch order items with products joined manually
  const { data: orderItems } = useQuery({
    queryKey: ["order-items-cif", orderId],
    queryFn: async () => {
      const { data: items, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);
      if (error) throw error;
      if (!items || items.length === 0) return [];

      // Get unique product codes and fetch products
      const codes = [...new Set(items.map(i => i.product_code))];
      const { data: products } = await supabase
        .from("products")
        .select("id, code, name, pack_size, weight, length_cm, width_cm, height_cm, price_usd_per_unit, price_usd, price_xcg, wholesale_price_xcg_per_unit, retail_price_xcg_per_unit")
        .in("code", codes);

      const productMap = new Map((products || []).map(p => [p.code, p]));
      return items.map(item => ({
        ...item,
        products: productMap.get(item.product_code) || null,
      }));
    },
  });

  // Fetch latest CIF version
  const { data: latestVersion } = useQuery({
    queryKey: ["cif-version-latest", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cif_versions")
        .select("*, cif_components(*), cif_allocations(*)")
        .eq("import_order_id", orderId)
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Load global settings
  const { data: globalSettings } = useQuery({
    queryKey: ["cif-global-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("key, value")
        .like("key", "cif_%");
      if (error) throw error;
      return data;
    },
  });

  const settings: CifSettings = useMemo(() => {
    const s = { ...DEFAULT_CIF_SETTINGS };
    if (globalSettings) {
      const map = new Map(globalSettings.map(gs => [gs.key, gs.value as any]));
      s.fx_rate_usd_to_xcg = map.get("cif_fx_rate_usd_to_xcg")?.rate ?? s.fx_rate_usd_to_xcg;
      s.champion_cost_per_kg = map.get("cif_champion_cost_per_kg")?.rate ?? s.champion_cost_per_kg;
      s.swissport_cost_per_kg = map.get("cif_swissport_cost_per_kg")?.rate ?? s.swissport_cost_per_kg;
      s.local_logistics_xcg = map.get("cif_local_logistics_cost")?.amount ?? s.local_logistics_xcg;
      s.bank_charges_usd = map.get("cif_bank_charges")?.amount ?? s.bank_charges_usd;
    }
    return s;
  }, [globalSettings]);

  // Build a map of product code -> product data (including selling prices)
  const productDataMap = useMemo(() => {
    const map = new Map<string, any>();
    if (!orderItems) return map;
    for (const item of orderItems) {
      if (item.products && !map.has(item.product_code)) {
        map.set(item.product_code, item.products);
      }
    }
    return map;
  }, [orderItems]);

  // Build products from order items — consolidate lines with the same product_code
  const cifProducts: CifProduct[] = useMemo(() => {
    if (!orderItems) return [];

    const grouped = new Map<string, { totalQty: number; prod: any; costPerCase: number }>();

    for (const item of orderItems) {
      const prod = item.products as any;
      const packSize = prod?.pack_size || 1;

      // Supplier cost priority: line > product price_usd_per_unit * pack > price_usd > 0
      let costPerCase = item.supplier_cost_usd_per_case != null ? Number(item.supplier_cost_usd_per_case) : 0;
      if (costPerCase <= 0 && prod?.price_usd_per_unit) {
        costPerCase = Number(prod.price_usd_per_unit) * packSize;
      }
      if (costPerCase <= 0 && prod?.price_usd) {
        costPerCase = Number(prod.price_usd);
      }

      const existing = grouped.get(item.product_code);
      if (existing) {
        existing.totalQty += (item.quantity || 0);
        // Keep the first non-zero cost found
        if (existing.costPerCase <= 0 && costPerCase > 0) {
          existing.costPerCase = costPerCase;
        }
      } else {
        grouped.set(item.product_code, {
          totalQty: item.quantity || 0,
          prod,
          costPerCase,
        });
      }
    }

    return Array.from(grouped.entries())
      .map(([code, { totalQty, prod, costPerCase }]) => {
        const packSize = prod?.pack_size || 1;
        return {
          product_id: prod?.id || '',
          product_code: code,
          product_name: prod?.name || code,
          qty_cases: totalQty,
          case_pack: packSize,
          weight_case_kg: (Number(prod?.weight) || 0) / 1000,
          length_cm: Number(prod?.length_cm) || 0,
          width_cm: Number(prod?.width_cm) || 0,
          height_cm: Number(prod?.height_cm) || 0,
          supplier_cost_usd_per_case: costPerCase,
        };
      })
      .filter(p => p.qty_cases > 0);
  }, [orderItems]);

  // Build effective components — apply allocationMethod override
  const effectiveComponents: CifComponent[] = useMemo(() => {
    const base = (() => {
      if (components.length > 0) return components;
      if (cifProducts.length === 0) return [];

      const tempResult = calculateCIF(cifProducts, [], settings);
      const chgWt = tempResult.totals.total_chargeable_weight_kg;
      return [
        { component_type: 'champion', label: 'Champion', status: 'received' as const, currency: 'USD' as const, amount: settings.champion_cost_per_kg * chgWt, allocation_basis: 'chargeable_weight' as const },
        { component_type: 'swissport', label: 'Swissport', status: 'pending' as const, currency: 'USD' as const, amount: settings.swissport_cost_per_kg * chgWt, allocation_basis: 'chargeable_weight' as const },
        { component_type: 'bank_charges', label: 'Bank Charges', status: 'received' as const, currency: 'USD' as const, amount: settings.bank_charges_usd, allocation_basis: 'value' as const },
        { component_type: 'handling_terminal', label: 'Local Logistics', status: 'received' as const, currency: 'XCG' as const, amount: settings.local_logistics_xcg, allocation_basis: 'cases' as const },
      ];
    })();

    // Override allocation_basis with the selected method
    return base.map(c => ({ ...c, allocation_basis: allocationMethod }));
  }, [cifProducts, components, settings, allocationMethod]);

  // Calculate CIF
  const result = useMemo(() => {
    if (cifProducts.length === 0) return null;
    return calculateCIF(cifProducts, effectiveComponents, settings);
  }, [cifProducts, effectiveComponents, settings]);

  const pendingCount = components.filter(c => c.status === 'pending').length;
  const isFinal = versionType === 'actual' && components.length > 0 && components.every(c => c.status === 'approved');
  const hasCifVersions = !!latestVersion;

  const fmt = currencyView === 'usd' ? formatUSD : formatXCG;
  const currSuffix = currencyView === 'usd' ? '_usd' : '_xcg';

  // Save CIF version
  const handleSaveVersion = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const nextVersion = (latestVersion?.version_no || 0) + 1;

      const { data: version, error: vErr } = await supabase
        .from("cif_versions")
        .insert({
          import_order_id: orderId,
          version_no: nextVersion,
          version_type: versionType,
          is_final: isFinal,
          fx_rate_usd_to_xcg: settings.fx_rate_usd_to_xcg,
          champion_cost_per_kg: settings.champion_cost_per_kg,
          swissport_cost_per_kg: settings.swissport_cost_per_kg,
          local_logistics_xcg: settings.local_logistics_xcg,
          bank_charges_usd: settings.bank_charges_usd,
          totals_json: result.totals as any,
        })
        .select()
        .single();
      if (vErr) throw vErr;

      // Save components
      if (components.length > 0) {
        const compRows = components.map(c => ({
          cif_version_id: version.id,
          component_type: c.component_type,
          label: c.label,
          status: c.status,
          currency: c.currency,
          amount: c.amount,
          amount_usd: c.currency === 'XCG' ? c.amount / settings.fx_rate_usd_to_xcg : c.amount,
          allocation_basis: c.allocation_basis,
        }));
        await supabase.from("cif_components").insert(compRows);
      }

      // Save allocations
      const allocRows = result.allocations.map(a => ({
        cif_version_id: version.id,
        product_id: a.product_id || null,
        product_code: a.product_code,
        qty_cases: a.qty_cases,
        qty_pieces: a.qty_pieces,
        supplier_cost_usd_per_case: a.supplier_cost_usd_per_case,
        supplier_cost_usd: a.supplier_cost_usd,
        supplier_cost_xcg: a.supplier_cost_xcg,
        actual_weight_kg: a.actual_weight_kg,
        volumetric_weight_kg: a.volumetric_weight_kg,
        chargeable_weight_kg: a.chargeable_weight_kg,
        allocated_costs_json: a.allocated_costs as any,
        allocated_shared_costs_usd: a.allocated_shared_costs_usd,
        allocated_shared_costs_xcg: a.allocated_shared_costs_xcg,
        spoilage_usd: a.spoilage_usd,
        landed_total_usd: a.landed_total_usd,
        landed_total_xcg: a.landed_total_xcg,
        landed_cost_per_piece_usd: a.landed_cost_per_piece_usd,
        landed_cost_per_piece_xcg: a.landed_cost_per_piece_xcg,
        landed_cost_per_case_usd: a.landed_cost_per_case_usd,
        landed_cost_per_case_xcg: a.landed_cost_per_case_xcg,
        landed_cost_per_kg_usd: a.landed_cost_per_kg_usd,
        landed_cost_per_kg_xcg: a.landed_cost_per_kg_xcg,
      }));
      const { data: savedAllocs } = await supabase.from("cif_allocations").insert(allocRows).select("id, product_code");

      // Save pricing
      if (savedAllocs) {
        const allocMap = new Map(savedAllocs.map(a => [a.product_code, a.id]));
        const pricingRows = result.pricing.map(p => ({
          cif_version_id: version.id,
          cif_allocation_id: allocMap.get(p.product_code) || savedAllocs[0]?.id,
          product_code: p.product_code,
          wholesale_margin_pct: p.wholesale_margin_pct,
          retail_margin_pct: p.retail_margin_pct,
          wholesale_price_per_piece_usd: p.wholesale_price_per_piece_usd,
          wholesale_price_per_piece_xcg: p.wholesale_price_per_piece_xcg,
          wholesale_price_per_case_usd: p.wholesale_price_per_case_usd,
          wholesale_price_per_case_xcg: p.wholesale_price_per_case_xcg,
          wholesale_price_per_kg_usd: p.wholesale_price_per_kg_usd,
          wholesale_price_per_kg_xcg: p.wholesale_price_per_kg_xcg,
          retail_price_per_piece_usd: p.retail_price_per_piece_usd,
          retail_price_per_piece_xcg: p.retail_price_per_piece_xcg,
          retail_price_per_case_usd: p.retail_price_per_case_usd,
          retail_price_per_case_xcg: p.retail_price_per_case_xcg,
          retail_price_per_kg_usd: p.retail_price_per_kg_usd,
          retail_price_per_kg_xcg: p.retail_price_per_kg_xcg,
        }));
        await supabase.from("cif_pricing_suggestions").insert(pricingRows);
      }

      queryClient.invalidateQueries({ queryKey: ["cif-version-latest", orderId] });
      toast.success(`CIF ${versionType} v${nextVersion} saved${isFinal ? ' (FINAL)' : ''}`);
    } catch (error) {
      console.error("Error saving CIF version:", error);
      toast.error("Failed to save CIF version");
    } finally {
      setSaving(false);
    }
  };

  // Create Actual CIF Draft
  const handleCreateActualDraft = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("cif_versions")
        .select("version_no")
        .eq("import_order_id", orderId)
        .eq("version_type", "actual")
        .order("version_no", { ascending: false })
        .limit(1);

      const nextVersion = existing && existing.length > 0 ? existing[0].version_no + 1 : 1;

      const { data: version, error: vErr } = await supabase
        .from("cif_versions")
        .insert({
          import_order_id: orderId,
          version_no: nextVersion,
          version_type: "actual",
          is_final: false,
          fx_rate_usd_to_xcg: settings.fx_rate_usd_to_xcg,
          champion_cost_per_kg: settings.champion_cost_per_kg,
          swissport_cost_per_kg: settings.swissport_cost_per_kg,
          local_logistics_xcg: settings.local_logistics_xcg,
          bank_charges_usd: settings.bank_charges_usd,
        })
        .select()
        .single();
      if (vErr) throw vErr;

      // Create pending components for user to fill
      const pendingComps = [
        { component_type: 'air_freight', label: 'Air Freight', allocation_basis: 'chargeable_weight' },
        { component_type: 'champion', label: 'Champion', allocation_basis: 'chargeable_weight' },
        { component_type: 'swissport', label: 'Swissport', allocation_basis: 'chargeable_weight' },
        { component_type: 'broker_fees', label: 'Customs Broker', allocation_basis: 'value' },
        { component_type: 'duties_taxes', label: 'Duties & Taxes', allocation_basis: 'value' },
        { component_type: 'bank_charges', label: 'Bank Charges', allocation_basis: 'value' },
        { component_type: 'handling_terminal', label: 'Local Logistics', allocation_basis: 'cases' },
      ].map(c => ({
        cif_version_id: version.id,
        component_type: c.component_type,
        label: c.label,
        status: 'pending',
        currency: 'USD' as const,
        amount: 0,
        amount_usd: 0,
        allocation_basis: c.allocation_basis,
      }));

      await supabase.from("cif_components").insert(pendingComps);

      queryClient.invalidateQueries({ queryKey: ["cif-version-latest", orderId] });
      setVersionType('actual');
      toast.success(`Actual CIF draft v${nextVersion} created — fill in component amounts from invoices`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create actual CIF draft");
    } finally {
      setSaving(false);
    }
  };

  const handleDocumentExtracted = (fields: any) => {
    if (!fields) return;
    const newComp: CifComponent = {
      component_type: fields.document_type || 'other',
      label: fields.vendor_name || fields.document_type || 'Extracted',
      status: 'received',
      currency: fields.currency === 'XCG' || fields.currency === 'ANG' ? 'XCG' : 'USD',
      amount: fields.total_amount || 0,
      allocation_basis: fields.document_type === 'air_freight' || fields.document_type === 'champion' || fields.document_type === 'swissport'
        ? 'chargeable_weight' : 'value',
    };
    setComponents(prev => [...prev, newComp]);
    toast.success(`Component "${newComp.label}" added from document`);
  };

  // No CIF version exists — show readiness + compute button
  if (!hasCifVersions && !result) {
    return (
      <div className="space-y-4">
        <CifReadinessChecker orderId={orderId} />
        <Card>
          <CardContent className="py-8 text-center">
            <Calculator className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground mb-3">No CIF profile computed yet for this order.</p>
            <Button onClick={() => setShowReadiness(true)}>
              <Calculator className="h-4 w-4 mr-2" />
              Compute CIF for this Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="space-y-4">
        <CifReadinessChecker orderId={orderId} />
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No products with valid quantities to calculate CIF
          </CardContent>
        </Card>
      </div>
    );
  }

  // Helper to build margin hover content for a row
  const renderMarginPopup = (alloc: typeof result.allocations[0], pricing: typeof result.pricing[0]) => {
    const prod = productDataMap.get(alloc.product_code);
    const wholesaleSellXCG = prod?.wholesale_price_xcg_per_unit ? Number(prod.wholesale_price_xcg_per_unit) : null;
    const retailSellXCG = prod?.retail_price_xcg_per_unit ? Number(prod.retail_price_xcg_per_unit) : null;

    const landedPerPieceXCG = alloc.landed_cost_per_piece_xcg ?? 0;

    const wholesaleSuggestedXCG = pricing.wholesale_price_per_piece_xcg ?? 0;
    const retailSuggestedXCG = pricing.retail_price_per_piece_xcg ?? 0;

    // Actual margin: (sell - landed) / sell * 100
    const actualWholesaleMargin = wholesaleSellXCG && wholesaleSellXCG > 0
      ? ((wholesaleSellXCG - landedPerPieceXCG) / wholesaleSellXCG * 100)
      : null;
    const actualRetailMargin = retailSellXCG && retailSellXCG > 0
      ? ((retailSellXCG - landedPerPieceXCG) / retailSellXCG * 100)
      : null;

    return (
      <div className="space-y-2 text-sm">
        <div className="font-semibold border-b pb-1 text-foreground">
          {alloc.product_code} — {alloc.product_name}
        </div>

        {/* Wholesale section */}
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase">Wholesale</div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">CIF Suggested:</span>
            <span className="font-medium">{formatXCG(wholesaleSuggestedXCG)} /unit</span>
          </div>
          {wholesaleSellXCG != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Sell:</span>
              <span className="font-medium">{formatXCG(wholesaleSellXCG)} /unit</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Target Margin:</span>
            <span className="font-medium">{pricing.wholesale_margin_pct}%</span>
          </div>
          {actualWholesaleMargin != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Actual Margin:</span>
              <span className={`font-bold ${actualWholesaleMargin < pricing.wholesale_margin_pct ? 'text-destructive' : 'text-primary'}`}>
                {actualWholesaleMargin.toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Retail section */}
        <div className="space-y-1 border-t pt-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase">Retail</div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">CIF Suggested:</span>
            <span className="font-medium">{formatXCG(retailSuggestedXCG)} /unit</span>
          </div>
          {retailSellXCG != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Sell:</span>
              <span className="font-medium">{formatXCG(retailSellXCG)} /unit</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Target Margin:</span>
            <span className="font-medium">{pricing.retail_margin_pct}%</span>
          </div>
          {actualRetailMargin != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Actual Margin:</span>
              <span className={`font-bold ${actualRetailMargin < pricing.retail_margin_pct ? 'text-destructive' : 'text-primary'}`}>
                {actualRetailMargin.toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {wholesaleSellXCG == null && retailSellXCG == null && (
          <div className="text-xs text-muted-foreground italic border-t pt-1">
            No wholesale or retail price set for this product.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Readiness Checker (collapsed if ready) */}
      <CifReadinessChecker orderId={orderId} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          <h3 className="font-semibold">CIF Profile</h3>
          {latestVersion && (
            <Badge variant="secondary">v{latestVersion.version_no} ({latestVersion.version_type})</Badge>
          )}
          {versionType === 'actual' && pendingCount > 0 && (
            <Badge variant="outline" className="text-amber-600">NOT FINAL</Badge>
          )}
          {isFinal && <Badge className="bg-primary text-primary-foreground">FINAL</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Select value={currencyView} onValueChange={v => setCurrencyView(v as CurrencyView)}>
            <SelectTrigger className="w-[80px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usd">USD</SelectItem>
              <SelectItem value="xcg">XCG</SelectItem>
            </SelectContent>
          </Select>
          <Select value={versionType} onValueChange={v => setVersionType(v as VersionType)}>
            <SelectTrigger className="w-[110px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="estimate">Estimate</SelectItem>
              <SelectItem value="actual">Actual</SelectItem>
            </SelectContent>
          </Select>
          <Select value={unitView} onValueChange={v => setUnitView(v as UnitView)}>
            <SelectTrigger className="w-[110px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="piece">Per Piece</SelectItem>
              <SelectItem value="case">Per Case</SelectItem>
              <SelectItem value="kg">Per KG</SelectItem>
            </SelectContent>
          </Select>
          <Select value={allocationMethod} onValueChange={v => setAllocationMethod(v as AllocationMethod)}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ALLOCATION_METHOD_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleSaveVersion} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save Version"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCreateActualDraft} disabled={saving}>
            <Plus className="h-4 w-4 mr-1" />
            Actual Draft
          </Button>
        </div>
      </div>

      <Tabs defaultValue="breakdown">
        <TabsList>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="drive">Drive</TabsTrigger>
          <TabsTrigger value="customs">Customs</TabsTrigger>
          <TabsTrigger value="ai">AI Auditor</TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Chargeable Wt</div>
              <div className="text-lg font-bold">{result.totals.total_chargeable_weight_kg.toFixed(1)} kg</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Supplier Cost</div>
              <div className="text-lg font-bold">
                {currencyView === 'usd' ? formatUSD(result.totals.total_value_usd) : formatXCG(result.totals.total_value_usd * settings.fx_rate_usd_to_xcg)}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Shared Costs</div>
              <div className="text-lg font-bold">
                {currencyView === 'usd' ? formatUSD(result.total_shared_costs_usd) : formatXCG(result.total_shared_costs_usd * settings.fx_rate_usd_to_xcg)}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Total Landed</div>
              <div className="text-lg font-bold text-primary">
                {currencyView === 'usd' ? formatUSD(result.total_landed_usd) : formatXCG(result.total_landed_xcg)}
              </div>
            </Card>
          </div>

          {/* Shared Costs Breakdown */}
          <Card className="p-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Shared Costs Breakdown</div>
            <div className="space-y-1">
              {effectiveComponents.map((comp, i) => {
                const amountUsd = comp.currency === 'XCG' ? comp.amount / settings.fx_rate_usd_to_xcg : comp.amount;
                const displayAmount = currencyView === 'usd' ? formatUSD(amountUsd) : formatXCG(amountUsd * settings.fx_rate_usd_to_xcg);
                return (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {comp.label || comp.component_type}
                      <span className="text-xs ml-1 opacity-60">({comp.allocation_basis.replace('_', ' ')})</span>
                    </span>
                    <span className="font-medium">{displayAmount}</span>
                  </div>
                );
              })}
              <div className="flex justify-between text-sm font-bold border-t pt-1 mt-1">
                <span>Total Shared</span>
                <span>{currencyView === 'usd' ? formatUSD(result.total_shared_costs_usd) : formatXCG(result.total_shared_costs_usd * settings.fx_rate_usd_to_xcg)}</span>
              </div>
            </div>
          </Card>

          {/* Allocation Table */}
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">{unitView === 'piece' ? 'Pieces' : unitView === 'kg' ? 'Weight (kg)' : 'Cases'}</TableHead>
                    <TableHead className="text-right">Landed/{unitView}</TableHead>
                    <TableHead className="text-right">Wholesale</TableHead>
                    <TableHead className="text-right">Retail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.allocations.map((alloc, idx) => {
                    const pricing = result.pricing[idx];
                    const lcKey = `landed_cost_per_${unitView}${currSuffix}` as keyof typeof alloc;
                    const wpKey = `wholesale_price_per_${unitView}${currSuffix}` as keyof typeof pricing;
                    const rpKey = `retail_price_per_${unitView}${currSuffix}` as keyof typeof pricing;

                    const retailVal = pricing[rpKey] as number | null | undefined;

                    return (
                      <HoverCard key={idx} openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <TableRow className="cursor-pointer">
                            <TableCell>
                              <div className="font-medium text-sm">{alloc.product_code}</div>
                              <div className="text-xs text-muted-foreground">{alloc.product_name}</div>
                            </TableCell>
                            <TableCell className="text-right">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help">
                                      {unitView === 'piece'
                                        ? alloc.qty_pieces
                                        : unitView === 'kg'
                                          ? alloc.actual_weight_kg.toFixed(1)
                                          : alloc.qty_cases}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {unitView === 'piece'
                                      ? `${alloc.qty_cases} cases`
                                      : unitView === 'kg'
                                        ? `${alloc.qty_cases} cases`
                                        : `${alloc.qty_pieces} pieces`}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {fmt(alloc[lcKey] as number)}
                            </TableCell>
                            <TableCell className="text-right text-primary">
                              {fmt(pricing[wpKey] as number)}
                            </TableCell>
                            <TableCell className="text-right text-foreground">
                              {retailVal != null ? fmt(retailVal) : '--'}
                            </TableCell>
                          </TableRow>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-72" side="left">
                          {renderMarginPopup(alloc, pricing)}
                        </HoverCardContent>
                      </HoverCard>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* FX info */}
          <div className="text-xs text-muted-foreground text-center">
            FX: 1 USD = {settings.fx_rate_usd_to_xcg} XCG •
            Champion: ${settings.champion_cost_per_kg}/kg •
            Swissport: ${settings.swissport_cost_per_kg}/kg
          </div>
        </TabsContent>

        <TabsContent value="components">
          <CifComponentManager
            components={components}
            onChange={setComponents}
            versionType={versionType}
            chargeableWeightKg={result.totals.total_chargeable_weight_kg}
            defaultSettings={{
              champion_cost_per_kg: settings.champion_cost_per_kg,
              swissport_cost_per_kg: settings.swissport_cost_per_kg,
              bank_charges_usd: settings.bank_charges_usd,
              local_logistics_xcg: settings.local_logistics_xcg,
            }}
          />
        </TabsContent>

        <TabsContent value="documents">
          <CifDocumentUpload
            orderId={orderId}
            onComponentExtracted={handleDocumentExtracted}
          />
        </TabsContent>

        <TabsContent value="drive">
          <GoogleDriveFileBrowser orderId={orderId} />
        </TabsContent>

        <TabsContent value="customs">
          <AsycudaMetadataSection orderId={orderId} />
        </TabsContent>

        <TabsContent value="ai">
          <CifAIAuditor cifVersionId={latestVersion?.id} orderId={orderId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
