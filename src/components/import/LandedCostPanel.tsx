import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Save, Calculator, Plus, Trash2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  type CifProduct,
  type CifComponent,
  type CifSettings,
  type AllocationBasis,
  DEFAULT_CIF_SETTINGS,
  DEFAULT_ALLOCATION_BASIS,
  COMPONENT_TYPES,
  calculateCIF,
  formatUSD,
  formatXCG,
} from "@/lib/cifEngine";

interface LandedCostPanelProps {
  orderId: string;
}

type UnitView = 'piece' | 'case' | 'kg';

export function LandedCostPanel({ orderId }: LandedCostPanelProps) {
  const queryClient = useQueryClient();
  const [unitView, setUnitView] = useState<UnitView>('piece');
  const [showComponents, setShowComponents] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch order items with product data
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

  // Fetch latest CIF version for this order
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
      const weightCaseKg = weightPerUnitKg * packSize;
      const cases = item.quantity || 0;

      return {
        product_id: prod?.id || '',
        product_code: item.product_code,
        product_name: prod?.name || item.product_code,
        qty_cases: cases,
        case_pack: packSize,
        weight_case_kg: weightCaseKg,
        length_cm: Number(prod?.length_cm) || 0,
        width_cm: Number(prod?.width_cm) || 0,
        height_cm: Number(prod?.height_cm) || 0,
        supplier_cost_usd_per_case: (Number(prod?.price_usd_per_unit) || 0) * packSize,
      };
    }).filter(p => p.qty_cases > 0);
  }, [orderItems]);

  // Calculate CIF with default components
  const result = useMemo(() => {
    if (cifProducts.length === 0) return null;
    
    // Auto-generate default components based on shipment
    const tempResult = calculateCIF(cifProducts, [], settings);
    const chgWt = tempResult.totals.total_chargeable_weight_kg;

    const defaultComponents: CifComponent[] = [
      { component_type: 'champion', label: 'Champion', status: 'received', currency: 'USD', amount: settings.champion_cost_per_kg * chgWt, allocation_basis: 'chargeable_weight' },
      { component_type: 'swissport', label: 'Swissport', status: 'pending', currency: 'USD', amount: settings.swissport_cost_per_kg * chgWt, allocation_basis: 'chargeable_weight' },
      { component_type: 'bank_charges', label: 'Bank Charges', status: 'received', currency: 'USD', amount: settings.bank_charges_usd, allocation_basis: 'value' },
      { component_type: 'handling_terminal', label: 'Local Logistics', status: 'received', currency: 'XCG', amount: settings.local_logistics_xcg, allocation_basis: 'cases' },
    ];

    return calculateCIF(cifProducts, defaultComponents, settings);
  }, [cifProducts, settings]);

  // Save as CIF version
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
          version_type: 'estimate',
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

      const { error: aErr } = await supabase.from("cif_allocations").insert(allocRows);
      if (aErr) throw aErr;

      queryClient.invalidateQueries({ queryKey: ["cif-version-latest", orderId] });
      toast.success(`CIF Estimate v${nextVersion} saved`);
    } catch (error) {
      console.error("Error saving CIF version:", error);
      toast.error("Failed to save CIF version");
    } finally {
      setSaving(false);
    }
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
      {/* Header with version info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          <h3 className="font-semibold">CIF Profile</h3>
          {latestVersion && (
            <Badge variant="secondary">v{latestVersion.version_no} ({latestVersion.version_type})</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
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

      {/* Shipment Summary Cards */}
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
        FX Rate: 1 USD = {settings.fx_rate_usd_to_xcg} XCG • 
        Champion: ${settings.champion_cost_per_kg}/kg • 
        Swissport: ${settings.swissport_cost_per_kg}/kg
      </div>
    </div>
  );
}
