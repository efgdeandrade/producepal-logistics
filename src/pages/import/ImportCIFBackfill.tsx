import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Play, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  type CifProduct,
  type CifComponent,
  DEFAULT_CIF_SETTINGS,
  calculateCIF,
} from "@/lib/cifEngine";

const BATCH_SIZE = 20;

interface OrderRow {
  id: string;
  order_number: string;
  delivery_date: string;
  status: string;
  item_count: number;
  has_cif: boolean;
}

export default function ImportCIFBackfill() {
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: [] as string[] });

  // Fetch orders with CIF status
  const { data: orders, isLoading } = useQuery({
    queryKey: ["backfill-orders", dateFrom, dateTo, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, order_number, delivery_date, status")
        .order("delivery_date", { ascending: false })
        .limit(200);

      if (dateFrom) query = query.gte("delivery_date", dateFrom);
      if (dateTo) query = query.lte("delivery_date", dateTo);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);

      const { data: ordersData, error } = await query;
      if (error) throw error;

      // Check which orders already have CIF versions
      const orderIds = ordersData.map(o => o.id);
      const { data: cifVersions } = await supabase
        .from("cif_versions")
        .select("import_order_id")
        .in("import_order_id", orderIds);

      const cifSet = new Set(cifVersions?.map(v => v.import_order_id) || []);

      // Get item counts
      const { data: itemCounts } = await supabase
        .from("order_items")
        .select("order_id")
        .in("order_id", orderIds)
        .gt("quantity", 0);

      const countMap = new Map<string, number>();
      itemCounts?.forEach(i => countMap.set(i.order_id, (countMap.get(i.order_id) || 0) + 1));

      return ordersData.map(o => ({
        id: o.id,
        order_number: o.order_number,
        delivery_date: o.delivery_date,
        status: o.status,
        item_count: countMap.get(o.id) || 0,
        has_cif: cifSet.has(o.id),
      })) as OrderRow[];
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllWithoutCif = () => {
    if (!orders) return;
    setSelectedIds(new Set(orders.filter(o => !o.has_cif && o.item_count > 0).map(o => o.id)));
  };

  const handleBackfill = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) { toast.error("Select at least one order"); return; }

    setProcessing(true);
    setProgress({ done: 0, total: ids.length, errors: [] });

    // Load global settings
    const { data: gsData } = await supabase.from("settings").select("key, value").like("key", "cif_%");
    const gMap = new Map(gsData?.map(g => [g.key, g.value as any]) || []);
    const settings = {
      ...DEFAULT_CIF_SETTINGS,
      fx_rate_usd_to_xcg: gMap.get("cif_fx_rate_usd_to_xcg")?.rate ?? DEFAULT_CIF_SETTINGS.fx_rate_usd_to_xcg,
      champion_cost_per_kg: gMap.get("cif_champion_cost_per_kg")?.rate ?? DEFAULT_CIF_SETTINGS.champion_cost_per_kg,
      swissport_cost_per_kg: gMap.get("cif_swissport_cost_per_kg")?.rate ?? DEFAULT_CIF_SETTINGS.swissport_cost_per_kg,
      local_logistics_xcg: gMap.get("cif_local_logistics_cost")?.amount ?? DEFAULT_CIF_SETTINGS.local_logistics_xcg,
      bank_charges_usd: gMap.get("cif_bank_charges")?.amount ?? DEFAULT_CIF_SETTINGS.bank_charges_usd,
    };

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Process in batches
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      
      for (const orderId of batch) {
        try {
          // Check if already has a CIF version
          const { data: existing } = await supabase
            .from("cif_versions")
            .select("id")
            .eq("import_order_id", orderId)
            .limit(1);
          
          if (existing && existing.length > 0) {
            setProgress(prev => ({ ...prev, done: prev.done + 1 }));
            continue;
          }

          // Get order items with product info
          const { data: items } = await supabase
            .from("order_items")
            .select("id, product_code, quantity, units_quantity, supplier_cost_usd_per_case")
            .eq("order_id", orderId)
            .gt("quantity", 0);

          if (!items || items.length === 0) {
            setProgress(prev => ({
              ...prev,
              done: prev.done + 1,
              errors: [...prev.errors, `${orderId}: No items`],
            }));
            continue;
          }

          const codes = [...new Set(items.map(i => i.product_code))];
          const { data: products } = await supabase
            .from("products")
            .select("id, code, name, pack_size, weight, length_cm, width_cm, height_cm, price_usd, price_usd_per_unit")
            .in("code", codes);

          const prodMap = new Map(products?.map(p => [p.code, p]) || []);

          // Build CIF products
          const cifProducts: CifProduct[] = items.map(item => {
            const prod = prodMap.get(item.product_code);
            const packSize = prod?.pack_size || 1;
            
            // Supplier cost priority: line > product price_usd_per_unit * pack > price_usd > 0
            let costPerCase = item.supplier_cost_usd_per_case != null ? Number(item.supplier_cost_usd_per_case) : 0;
            if (costPerCase <= 0 && prod?.price_usd_per_unit) {
              costPerCase = Number(prod.price_usd_per_unit) * packSize;
            }
            if (costPerCase <= 0 && prod?.price_usd) {
              costPerCase = Number(prod.price_usd);
            }

            return {
              product_id: prod?.id || '',
              product_code: item.product_code,
              product_name: prod?.name || item.product_code,
              qty_cases: item.quantity,
              case_pack: packSize,
              weight_case_kg: (Number(prod?.weight) || 0) / 1000,
              length_cm: Number(prod?.length_cm) || 0,
              width_cm: Number(prod?.width_cm) || 0,
              height_cm: Number(prod?.height_cm) || 0,
              supplier_cost_usd_per_case: costPerCase,
            };
          }).filter(p => p.qty_cases > 0);

          if (cifProducts.length === 0) {
            setProgress(prev => ({
              ...prev,
              done: prev.done + 1,
              errors: [...prev.errors, `${orderId}: No valid products`],
            }));
            continue;
          }

          // Calculate with default estimate components
          const tempResult = calculateCIF(cifProducts, [], settings);
          const chgWt = tempResult.totals.total_chargeable_weight_kg;

          const defaultComponents: CifComponent[] = [
            { component_type: 'champion', label: 'Champion', status: 'pending', currency: 'USD', amount: settings.champion_cost_per_kg * chgWt, allocation_basis: 'chargeable_weight' },
            { component_type: 'swissport', label: 'Swissport', status: 'pending', currency: 'USD', amount: settings.swissport_cost_per_kg * chgWt, allocation_basis: 'chargeable_weight' },
            { component_type: 'bank_charges', label: 'Bank Charges', status: 'pending', currency: 'USD', amount: settings.bank_charges_usd, allocation_basis: 'value' },
            { component_type: 'handling_terminal', label: 'Local Logistics', status: 'pending', currency: 'XCG', amount: settings.local_logistics_xcg, allocation_basis: 'cases' },
          ];

          const result = calculateCIF(cifProducts, defaultComponents, settings);

          // Create CIF version
          const { data: version, error: vErr } = await supabase
            .from("cif_versions")
            .insert({
              import_order_id: orderId,
              version_no: 1,
              version_type: "estimate",
              is_final: false,
              fx_rate_usd_to_xcg: settings.fx_rate_usd_to_xcg,
              champion_cost_per_kg: settings.champion_cost_per_kg,
              swissport_cost_per_kg: settings.swissport_cost_per_kg,
              local_logistics_xcg: settings.local_logistics_xcg,
              bank_charges_usd: settings.bank_charges_usd,
              totals_json: result.totals as any,
              created_by: user?.id || null,
            })
            .select()
            .single();

          if (vErr) throw vErr;

          // Save components
          const compRows = defaultComponents.map(c => ({
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

          // Log in change log
          await supabase.from("cif_change_log").insert({
            table_name: "cif_versions",
            record_id: version.id,
            action: "backfill_estimate",
            changed_by: user?.id || null,
            new_data: { order_id: orderId, version_no: 1, products_count: cifProducts.length } as any,
          });

          setProgress(prev => ({ ...prev, done: prev.done + 1 }));
        } catch (err: any) {
          console.error(`Backfill error for ${orderId}:`, err);
          setProgress(prev => ({
            ...prev,
            done: prev.done + 1,
            errors: [...prev.errors, `${orderId}: ${err.message}`],
          }));
        }
      }
    }

    setProcessing(false);
    queryClient.invalidateQueries({ queryKey: ["backfill-orders"] });
    toast.success(`Backfill complete: ${progress.done} orders processed`);
  };

  const withoutCifCount = orders?.filter(o => !o.has_cif && o.item_count > 0).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Backfill CIF for Existing Orders</h1>
        <p className="text-muted-foreground">Create estimate CIF versions for historical import orders using current global settings.</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="text-xs">From Date</Label>
              <Input type="date" className="w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To Date</Label>
              <Input type="date" className="w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={selectAllWithoutCif}>
              Select All Without CIF ({withoutCifCount})
            </Button>
            <Button
              onClick={handleBackfill}
              disabled={processing || selectedIds.size === 0}
              className="ml-auto"
            >
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Backfill {selectedIds.size} Order{selectedIds.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {processing && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processing...</span>
              <span>{progress.done}/{progress.total}</span>
            </div>
            <Progress value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0} />
            {progress.errors.length > 0 && (
              <div className="text-xs text-destructive mt-2 space-y-1">
                {progress.errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Orders Table */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead>CIF Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.map(order => (
                  <TableRow key={order.id} className={order.has_cif ? "opacity-60" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(order.id)}
                        onCheckedChange={() => toggleSelect(order.id)}
                        disabled={order.has_cif || order.item_count === 0}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{order.delivery_date}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{order.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{order.item_count}</TableCell>
                    <TableCell>
                      {order.has_cif ? (
                        <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Has CIF</Badge>
                      ) : order.item_count === 0 ? (
                        <Badge variant="secondary">No items</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600">
                          <AlertCircle className="h-3 w-3 mr-1" />No CIF
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
