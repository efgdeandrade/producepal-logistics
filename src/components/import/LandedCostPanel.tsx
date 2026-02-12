import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Save, FileText, Upload } from "lucide-react";
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

interface LandedCostPanelProps {
  orderId: string;
}

type UnitView = 'piece' | 'case' | 'kg';
type VersionType = 'estimate' | 'actual';

export function LandedCostPanel({ orderId }: LandedCostPanelProps) {
  const queryClient = useQueryClient();
  const [unitView, setUnitView] = useState<UnitView>('piece');
  const [saving, setSaving] = useState(false);
  const [versionType, setVersionType] = useState<VersionType>('estimate');
  const [components, setComponents] = useState<CifComponent[]>([]);

  // Fetch order items
  const { data: orderItems } = useQuery({
    queryKey: ["order-items-cif", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products:product_code(id, code, name, pack_size, weight, length_cm, width_cm, height_cm, price_usd_per_unit)")
        .eq("order_id", orderId);
      if (error) throw error;
      return data;
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

  // Build products from order items
  const cifProducts: CifProduct[] = useMemo(() => {
    if (!orderItems) return [];
    return orderItems.map(item => {
      const prod = item.products as any;
      const packSize = prod?.pack_size || 1;
      const weightPerUnitKg = (prod?.weight || 0) / 1000;
      return {
        product_id: prod?.id || '',
        product_code: item.product_code,
        product_name: prod?.name || item.product_code,
        qty_cases: item.quantity || 0,
        case_pack: packSize,
        weight_case_kg: weightPerUnitKg * packSize,
        length_cm: Number(prod?.length_cm) || 0,
        width_cm: Number(prod?.width_cm) || 0,
        height_cm: Number(prod?.height_cm) || 0,
        supplier_cost_usd_per_case: (Number(prod?.price_usd_per_unit) || 0) * packSize,
      };
    }).filter(p => p.qty_cases > 0);
  }, [orderItems]);

  // Calculate CIF
  const result = useMemo(() => {
    if (cifProducts.length === 0) return null;

    // Use user-managed components if any, else auto-generate defaults for estimate
    if (components.length > 0) {
      return calculateCIF(cifProducts, components, settings);
    }

    // Auto-generate default for estimate preview
    const tempResult = calculateCIF(cifProducts, [], settings);
    const chgWt = tempResult.totals.total_chargeable_weight_kg;
    const defaultComponents: CifComponent[] = [
      { component_type: 'champion', label: 'Champion', status: 'received', currency: 'USD', amount: settings.champion_cost_per_kg * chgWt, allocation_basis: 'chargeable_weight' },
      { component_type: 'swissport', label: 'Swissport', status: 'pending', currency: 'USD', amount: settings.swissport_cost_per_kg * chgWt, allocation_basis: 'chargeable_weight' },
      { component_type: 'bank_charges', label: 'Bank Charges', status: 'received', currency: 'USD', amount: settings.bank_charges_usd, allocation_basis: 'value' },
      { component_type: 'handling_terminal', label: 'Local Logistics', status: 'received', currency: 'XCG', amount: settings.local_logistics_xcg, allocation_basis: 'cases' },
    ];
    return calculateCIF(cifProducts, defaultComponents, settings);
  }, [cifProducts, components, settings]);

  const pendingCount = components.filter(c => c.status === 'pending').length;
  const isFinal = versionType === 'actual' && components.length > 0 && components.every(c => c.status === 'approved');

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
      await supabase.from("cif_allocations").insert(allocRows);

      // Save pricing suggestions
      const pricingRows = result.pricing.map((p, i) => ({
        cif_version_id: version.id,
        cif_allocation_id: version.id, // will be overridden below
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

      // Get saved allocations to link pricing
      const { data: savedAllocs } = await supabase
        .from("cif_allocations")
        .select("id, product_code")
        .eq("cif_version_id", version.id);

      if (savedAllocs) {
        const allocMap = new Map(savedAllocs.map(a => [a.product_code, a.id]));
        const linkedPricing = pricingRows.map(p => ({
          ...p,
          cif_allocation_id: allocMap.get(p.product_code) || savedAllocs[0]?.id,
        }));
        await supabase.from("cif_pricing_suggestions").insert(linkedPricing);
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

  const handleDocumentExtracted = (fields: any) => {
    if (!fields) return;
    // Auto-add extracted component
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

  if (!result) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No products with valid quantities to calculate CIF
        </CardContent>
      </Card>
    );
  }

  const fmt = formatUSD;
  const fmtX = formatXCG;

  return (
    <div className="space-y-4">
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
          {isFinal && <Badge className="bg-green-600">FINAL</Badge>}
        </div>
        <div className="flex items-center gap-2">
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
          <Button size="sm" onClick={handleSaveVersion} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save Version"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="breakdown">
        <TabsList>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
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
              <div className="text-lg font-bold">{fmt(result.totals.total_value_usd)}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Shared Costs</div>
              <div className="text-lg font-bold">{fmt(result.total_shared_costs_usd)}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Total Landed</div>
              <div className="text-lg font-bold text-primary">{fmtX(result.total_landed_xcg)}</div>
              <div className="text-xs text-muted-foreground">{fmt(result.total_landed_usd)}</div>
            </Card>
          </div>

          {/* Allocation Table */}
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Cases</TableHead>
                    <TableHead className="text-right">Landed/{unitView}</TableHead>
                    <TableHead className="text-right">Wholesale</TableHead>
                    <TableHead className="text-right">Retail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.allocations.map((alloc, idx) => {
                    const pricing = result.pricing[idx];
                    const lcKey = `landed_cost_per_${unitView}_xcg` as keyof typeof alloc;
                    const wpKey = `wholesale_price_per_${unitView}_xcg` as keyof typeof pricing;
                    const rpKey = `retail_price_per_${unitView}_xcg` as keyof typeof pricing;

                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="font-medium text-sm">{alloc.product_code}</div>
                          <div className="text-xs text-muted-foreground">{alloc.product_name}</div>
                        </TableCell>
                        <TableCell className="text-right">{alloc.qty_cases}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {fmtX(alloc[lcKey] as number)}
                        </TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-400">
                          {fmtX(pricing[wpKey] as number)}
                        </TableCell>
                        <TableCell className="text-right text-blue-600 dark:text-blue-400">
                          {fmtX(pricing[rpKey] as number)}
                        </TableCell>
                      </TableRow>
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
      </Tabs>
    </div>
  );
}
