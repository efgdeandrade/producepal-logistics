/**
 * CIF Audit Pack Generator
 * 
 * Generates a comprehensive JSON audit pack for CIF calculations,
 * including embedded ChatGPT instructions and multi-method results.
 */

import {
  type CifProduct,
  type CifComponent,
  type CifSettings,
  type AllocationBasis,
  calculateCIF,
  DEFAULT_CIF_SETTINGS,
} from "./cifEngine";
import { supabase } from "@/integrations/supabase/client";

const ALL_METHODS: AllocationBasis[] = [
  'chargeable_weight', 'actual_weight', 'volume', 'value', 'cases', 'pieces', 'equal'
];

const METHOD_LABEL_MAP: Record<string, string> = {
  chargeable_weight: 'weight',
  actual_weight: 'actual_weight',
  volume: 'volume',
  value: 'value',
  cases: 'quantity',
  pieces: 'pieces',
  equal: 'equal',
};

export type ExportType = 'estimate' | 'actual' | 'full';

interface AuditPackOptions {
  orderId: string;
  exportType: ExportType;
  userId?: string;
  userEmail?: string;
}

export async function generateAuditPack(options: AuditPackOptions) {
  const { orderId, exportType, userId, userEmail } = options;

  // Fetch order
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  // Fetch order items + products
  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  const codes = [...new Set((items || []).map(i => i.product_code))];
  const { data: products } = await supabase
    .from("products")
    .select("id, code, name, pack_size, weight, length_cm, width_cm, height_cm, price_usd_per_unit, price_usd, supplier_id")
    .in("code", codes);

  const productMap = new Map((products || []).map(p => [p.code, p]));

  // Fetch CIF versions
  const versionQuery = supabase
    .from("cif_versions")
    .select("*, cif_components(*), cif_allocations(*)")
    .eq("import_order_id", orderId)
    .order("version_no", { ascending: true });

  if (exportType === 'estimate') {
    versionQuery.eq("version_type", "estimate");
  } else if (exportType === 'actual') {
    versionQuery.eq("version_type", "actual");
  }

  const { data: versions } = await versionQuery;

  // Fetch global settings
  const { data: globalSettings } = await supabase
    .from("settings")
    .select("key, value")
    .like("key", "cif_%");

  const settings: CifSettings = { ...DEFAULT_CIF_SETTINGS };
  if (globalSettings) {
    const map = new Map(globalSettings.map(gs => [gs.key, gs.value as any]));
    settings.fx_rate_usd_to_xcg = map.get("cif_fx_rate_usd_to_xcg")?.rate ?? settings.fx_rate_usd_to_xcg;
    settings.champion_cost_per_kg = map.get("cif_champion_cost_per_kg")?.rate ?? settings.champion_cost_per_kg;
    settings.swissport_cost_per_kg = map.get("cif_swissport_cost_per_kg")?.rate ?? settings.swissport_cost_per_kg;
    settings.local_logistics_xcg = map.get("cif_local_logistics_cost")?.amount ?? settings.local_logistics_xcg;
    settings.bank_charges_usd = map.get("cif_bank_charges")?.amount ?? settings.bank_charges_usd;
  }

  // Build CIF products
  const grouped = new Map<string, { totalQty: number; prod: any; costPerCase: number }>();
  for (const item of (items || [])) {
    const prod = productMap.get(item.product_code);
    const packSize = prod?.pack_size || 1;
    let costPerCase = item.supplier_cost_usd_per_case != null ? Number(item.supplier_cost_usd_per_case) : 0;
    if (costPerCase <= 0 && prod?.price_usd_per_unit) costPerCase = Number(prod.price_usd_per_unit) * packSize;
    if (costPerCase <= 0 && prod?.price_usd) costPerCase = Number(prod.price_usd);

    const existing = grouped.get(item.product_code);
    if (existing) {
      existing.totalQty += (item.quantity || 0);
      if (existing.costPerCase <= 0 && costPerCase > 0) existing.costPerCase = costPerCase;
    } else {
      grouped.set(item.product_code, { totalQty: item.quantity || 0, prod, costPerCase });
    }
  }

  const cifProducts: CifProduct[] = Array.from(grouped.entries())
    .map(([code, { totalQty, prod, costPerCase }]) => ({
      product_id: prod?.id || '',
      product_code: code,
      product_name: prod?.name || code,
      qty_cases: totalQty,
      case_pack: prod?.pack_size || 1,
      weight_case_kg: (Number(prod?.weight) || 0) / 1000,
      length_cm: Number(prod?.length_cm) || 0,
      width_cm: Number(prod?.width_cm) || 0,
      height_cm: Number(prod?.height_cm) || 0,
      supplier_cost_usd_per_case: costPerCase,
    }))
    .filter(p => p.qty_cases > 0);

  // Detect missing fields
  const missingFields = cifProducts
    .filter(p =>
      !p.case_pack || !p.weight_case_kg || !p.length_cm || !p.width_cm || !p.height_cm || !p.supplier_cost_usd_per_case
    )
    .map(p => ({
      product_id: p.product_id,
      missing: [
        ...(p.case_pack ? [] : ['case_pack']),
        ...(p.weight_case_kg ? [] : ['weight_case_kg']),
        ...(p.length_cm ? [] : ['length_cm']),
        ...(p.width_cm ? [] : ['width_cm']),
        ...(p.height_cm ? [] : ['height_cm']),
        ...(p.supplier_cost_usd_per_case ? [] : ['supplier_cost_usd_per_case']),
      ],
    }));

  // Products full detail
  const productsFullDetail = cifProducts.map(p => ({
    product_id: p.product_id,
    sku: p.product_code,
    name: p.product_name,
    supplier_id: productMap.get(p.product_code)?.supplier_id || '',
    case_pack: p.case_pack,
    weight_case_kg: p.weight_case_kg,
    length_cm: p.length_cm,
    width_cm: p.width_cm,
    height_cm: p.height_cm,
    supplier_cost_usd_per_case: p.supplier_cost_usd_per_case,
  }));

  // Build CIF version results with multi-method calculations
  const cifVersionsOutput = (versions || []).map(v => {
    const versionComponents: CifComponent[] = (v.cif_components || []).map((c: any) => ({
      id: c.id,
      component_type: c.component_type,
      label: c.label,
      status: c.status as 'pending' | 'received' | 'approved',
      currency: c.currency as 'USD' | 'XCG',
      amount: c.amount,
      allocation_basis: c.allocation_basis as AllocationBasis,
      notes: c.notes,
    }));

    const versionSettings: CifSettings = {
      ...settings,
      fx_rate_usd_to_xcg: v.fx_rate_usd_to_xcg,
      champion_cost_per_kg: v.champion_cost_per_kg,
      swissport_cost_per_kg: v.swissport_cost_per_kg,
      local_logistics_xcg: v.local_logistics_xcg,
      bank_charges_usd: v.bank_charges_usd,
    };

    // Calculate for ALL methods
    const methodResults: Record<string, any> = {};
    for (const method of ALL_METHODS) {
      const methodComponents = versionComponents.map(c => ({ ...c, allocation_basis: method }));
      const calcResult = calculateCIF(cifProducts, methodComponents, versionSettings);

      const methodKey = METHOD_LABEL_MAP[method] || method;
      methodResults[methodKey] = {
        allocations: calcResult.allocations.map(a => ({
          product_id: a.product_id,
          qty_cases: a.qty_cases,
          qty_pieces: a.qty_pieces,
          actual_weight_kg_line: a.actual_weight_kg,
          volumetric_weight_kg_line: a.volumetric_weight_kg,
          chargeable_weight_kg_line: a.chargeable_weight_kg,
          supplier_cost_usd_line: a.supplier_cost_usd,
          allocated_shared_costs_usd_line: a.allocated_shared_costs_usd,
          landed_total_usd_line: a.landed_total_usd,
          landed_cost_per_piece_usd: a.landed_cost_per_piece_usd,
          landed_cost_per_case_usd: a.landed_cost_per_case_usd,
          landed_cost_per_kg_usd: a.landed_cost_per_kg_usd,
          landed_cost_per_piece_xcg: a.landed_cost_per_piece_xcg,
          landed_cost_per_case_xcg: a.landed_cost_per_case_xcg,
          landed_cost_per_kg_xcg: a.landed_cost_per_kg_xcg,
          component_breakdown: a.allocated_costs,
        })),
        totals: {
          total_landed_usd: calcResult.total_landed_usd,
          total_landed_xcg: calcResult.total_landed_xcg,
          total_shared_costs_usd: calcResult.total_shared_costs_usd,
          rounding_adjustment_usd: calcResult.rounding_adjustment_usd,
        },
      };
    }

    // Get totals from the primary method (chargeable_weight)
    const primaryResult = calculateCIF(cifProducts, versionComponents, versionSettings);

    return {
      cif_version_id: v.id,
      type: v.version_type,
      version_no: v.version_no,
      is_final: v.is_final,
      created_at: v.created_at,
      totals: {
        total_cases: primaryResult.totals.total_cases,
        total_pieces: primaryResult.totals.total_pieces,
        total_actual_weight_kg: primaryResult.totals.total_actual_weight_kg,
        total_volumetric_weight_kg: primaryResult.totals.total_volumetric_weight_kg,
        total_chargeable_weight_kg: primaryResult.totals.total_chargeable_weight_kg,
        total_value_usd: primaryResult.totals.total_value_usd,
      },
      components: versionComponents.map(c => ({
        component_type: c.component_type,
        status: c.status,
        currency: c.currency,
        amount: c.amount,
        amount_usd: c.currency === 'XCG' ? c.amount / versionSettings.fx_rate_usd_to_xcg : c.amount,
        allocation_basis: c.allocation_basis,
        notes: c.notes || '',
        source_document_id: '',
      })),
      method_results: methodResults,
    };
  });

  // Build final pack
  const auditPack = {
    export_meta: {
      export_version: "1.0",
      exported_at: new Date().toISOString(),
      exported_by: userEmail || userId || 'unknown',
      module: "IMPORT",
      fx_usd_to_xcg: settings.fx_rate_usd_to_xcg,
    },
    chatgpt_instructions: {
      role: "You are ChatGPT acting as a CIF calculation auditor.",
      task: [
        "1) Validate formulas match the rules in formulas_used (volumetric divisor 6000, chargeable=max(actual, volumetric), FX conversion direction, pricing margins).",
        "2) Recompute and verify: per piece (primary), per case, per kg costs for EACH product line for EACH method (weight/volume/value/quantity/equal).",
        "3) Verify allocations: for each component, sum of allocated amounts across products equals component total within rounding tolerance.",
        "4) Detect anomalies/errors: missing fields, division by zero, negative values, incorrect currency conversions, wrong margin/markup formulas, incorrect totals.",
        "5) Output: PASS/FAIL + list of issues with severity + corrected formulas/pseudocode.",
        "6) If FAIL: Generate a Lovable 'Fix Prompt' that is copy/paste ready and only includes the minimal changes needed.",
      ],
      required_output_format: {
        audit_status: "PASS or FAIL",
        issues: [
          {
            severity: "CRITICAL/HIGH/MEDIUM/LOW",
            where: "<method/component/product/formula>",
            problem: "...",
            expected: "...",
            found: "...",
            fix: "...",
          },
        ],
        summary: "short",
        lovable_fix_prompt: "If FAIL, include here, else empty string",
      },
    },
    order: {
      import_order_id: orderId,
      order_reference: order?.order_number || '',
      status: order?.status || '',
      created_at: order?.created_at || '',
      supplier_pos: [],
      settings_snapshot: {
        champion_usd_per_kg: settings.champion_cost_per_kg,
        swissport_usd_per_kg: settings.swissport_cost_per_kg,
        bank_usd: settings.bank_charges_usd,
        local_logistics_xcg: settings.local_logistics_xcg,
        spoilage_mode: settings.spoilage_mode,
        spoilage_value: settings.spoilage_pct,
        volumetric_divisor: 6000,
        chargeable_rule: "max(actual, volumetric)",
      },
    },
    products_full_detail: productsFullDetail,
    cif_versions: cifVersionsOutput,
    formulas_used: {
      volumetric_weight_per_case: "(L*W*H)/6000",
      chargeable_weight_line: "max(actual_weight_line, volumetric_weight_line)",
      wholesale_price: "cost/(1-0.20)",
      retail_price: "cost/(1-0.44)",
      fx_rule: `xcg = usd*${settings.fx_rate_usd_to_xcg}, usd = xcg/${settings.fx_rate_usd_to_xcg}`,
      unit_outputs: "primary per piece; secondary per case and per kg",
    },
    rounding: {
      tolerance_usd: 0.02,
      tolerance_xcg: 0.05,
    },
    missing_fields: missingFields,
  };

  return auditPack;
}

/**
 * Save audit pack to storage and record in cif_exports table
 */
export async function saveAuditPackToStorage(
  pack: any,
  orderId: string,
  exportType: ExportType,
  versionId?: string,
  userId?: string
) {
  const versionNo = pack.cif_versions?.[0]?.version_no || 0;
  const timestamp = Date.now();
  const path = `cif_exports/${orderId}/${exportType}_v${versionNo}_${timestamp}.json`;

  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });

  const { error: uploadError } = await supabase.storage
    .from('cif-exports')
    .upload(path, blob, { contentType: 'application/json' });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error('Failed to upload export to storage');
  }

  // Record in cif_exports table
  await supabase.from('cif_exports').insert({
    import_order_id: orderId,
    cif_version_id: versionId || null,
    export_type: exportType,
    storage_path: path,
    created_by: userId || null,
  } as any);

  return path;
}

/**
 * Simple hash for caching audit results
 */
export function hashAuditPack(pack: any): string {
  const str = JSON.stringify({
    products: pack.products_full_detail,
    versions: pack.cif_versions,
    settings: pack.order?.settings_snapshot,
  });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
