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
  CIF_ENGINE_VERSION,
  DEFAULT_ALLOCATION_BASIS,
} from "./cifEngine";
import { resolveWeightCaseKg, type WeightDebug } from "./cifWeightResolver";
import { supabase } from "@/integrations/supabase/client";

const ALL_METHODS: AllocationBasis[] = [
  'chargeable_weight', 'actual_weight', 'volume', 'value', 'cases', 'pieces', 'equal'
];

const METHOD_KEY_MAP: Record<string, string> = {
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

export interface MissingFieldEntry {
  product_id: string;
  product_code: string;
  product_name: string;
  missing: string[];
}

export interface ProductDebugInfo {
  product_id: string;
  product_code: string;
  product_name: string;
  weight_debug: WeightDebug;
  raw_fields: Record<string, any>;
  duplicates?: { id: string; name: string; code: string }[];
}

/**
 * Fetch products with all weight-related fields for an order.
 */
async function fetchProductsForOrder(orderId: string) {
  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  const codes = [...new Set((items || []).map(i => i.product_code))];
  if (codes.length === 0) return { items: items || [], products: [], productMap: new Map() };

  const { data: products } = await supabase
    .from("products")
    .select("id, code, name, pack_size, weight, length_cm, width_cm, height_cm, price_usd_per_unit, price_usd, supplier_id, empty_case_weight, netto_weight_per_unit, gross_weight_per_unit, volumetric_weight_kg")
    .in("code", codes);

  const productMap = new Map((products || []).map(p => [p.code, p]));
  return { items: items || [], products: products || [], productMap };
}

/**
 * Check CIF readiness using the canonical weight resolver.
 */
export async function checkCifReadiness(orderId: string): Promise<{
  ready: boolean;
  missingFields: MissingFieldEntry[];
  cifProducts: CifProduct[];
  debugInfo: ProductDebugInfo[];
}> {
  const { items, products, productMap } = await fetchProductsForOrder(orderId);

  if (items.length === 0) {
    return { ready: false, missingFields: [], cifProducts: [], debugInfo: [] };
  }

  // Check for duplicate product codes
  const codeToProducts = new Map<string, any[]>();
  for (const p of products) {
    const list = codeToProducts.get(p.code) || [];
    list.push(p);
    codeToProducts.set(p.code, list);
  }

  // Build CIF products (consolidate same product_code)
  const grouped = new Map<string, { totalQty: number; prod: any; costPerCase: number }>();
  for (const item of items) {
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

  const debugInfo: ProductDebugInfo[] = [];

  const cifProducts: CifProduct[] = Array.from(grouped.entries())
    .map(([code, { totalQty, prod, costPerCase }]) => {
      // Use canonical weight resolver
      const weightResult = resolveWeightCaseKg({
        weight: prod?.weight,
        netto_weight_per_unit: prod?.netto_weight_per_unit,
        gross_weight_per_unit: prod?.gross_weight_per_unit,
        empty_case_weight: prod?.empty_case_weight,
        pack_size: prod?.pack_size,
      });

      const dupes = (codeToProducts.get(code) || []).length > 1
        ? (codeToProducts.get(code) || []).map(d => ({ id: d.id, name: d.name, code: d.code }))
        : undefined;

      debugInfo.push({
        product_id: prod?.id || '',
        product_code: code,
        product_name: prod?.name || code,
        weight_debug: weightResult.debug,
        raw_fields: {
          weight: prod?.weight,
          empty_case_weight: prod?.empty_case_weight,
          netto_weight_per_unit: prod?.netto_weight_per_unit,
          gross_weight_per_unit: prod?.gross_weight_per_unit,
          volumetric_weight_kg: prod?.volumetric_weight_kg,
          pack_size: prod?.pack_size,
        },
        duplicates: dupes,
      });

      return {
        product_id: prod?.id || '',
        product_code: code,
        product_name: prod?.name || code,
        qty_cases: totalQty,
        case_pack: prod?.pack_size || 0,
        weight_case_kg: weightResult.weight_case_kg || 0,
        length_cm: Number(prod?.length_cm) || 0,
        width_cm: Number(prod?.width_cm) || 0,
        height_cm: Number(prod?.height_cm) || 0,
        supplier_cost_usd_per_case: costPerCase,
      };
    })
    .filter(p => p.qty_cases > 0);

  const REQUIRED_FIELDS: (keyof CifProduct)[] = [
    'case_pack', 'weight_case_kg', 'length_cm', 'width_cm', 'height_cm', 'supplier_cost_usd_per_case'
  ];

  const missingFields: MissingFieldEntry[] = cifProducts
    .map(p => ({
      product_id: p.product_id,
      product_code: p.product_code,
      product_name: p.product_name,
      missing: REQUIRED_FIELDS.filter(f => !p[f] || Number(p[f]) <= 0),
    }))
    .filter(m => m.missing.length > 0);

  return {
    ready: missingFields.length === 0,
    missingFields,
    cifProducts,
    debugInfo,
  };
}

export async function generateAuditPack(options: AuditPackOptions) {
  const { orderId, exportType, userId, userEmail } = options;

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  const { cifProducts, missingFields: missingFieldEntries, debugInfo } = await checkCifReadiness(orderId);

  const codes = cifProducts.map(p => p.product_code);
  const { data: products } = await supabase
    .from("products")
    .select("id, code, supplier_id")
    .in("code", codes.length > 0 ? codes : ['__none__']);

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

  // Build debug map for weight_debug per product
  const debugMap = new Map(debugInfo.map(d => [d.product_code, d]));

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
    weight_debug: debugMap.get(p.product_code)?.weight_debug || null,
  }));

  let cifVersionsOutput = buildVersionsOutput(versions || [], cifProducts, settings);

  if (cifVersionsOutput.length === 0 && cifProducts.length > 0) {
    cifVersionsOutput = [generateOnTheFlyEstimate(cifProducts, settings)];
  }

  const missingFields = missingFieldEntries.map(m => ({
    product_id: m.product_id,
    missing: m.missing,
  }));

  const auditPack = {
    export_meta: {
      export_version: "1.0",
      engine_version: CIF_ENGINE_VERSION,
      exported_at: new Date().toISOString(),
      exported_by: userEmail || userId || 'unknown',
      module: "IMPORT",
      fx_usd_to_xcg: settings.fx_rate_usd_to_xcg,
    },
    chatgpt_instructions: {
      role: "You are ChatGPT acting as a CIF calculation auditor.",
      task: [
        "Validate formulas and constants match formulas_used (FX 1.82, divisor 6000, chargeable=max(actual, volumetric), wholesale cost/0.80, retail cost/0.56).",
        "Recompute and verify per piece (primary), per case, per kg for EACH product line for EACH method (weight/volume/value/quantity/equal).",
        "Verify allocations: per component, sum of allocated across products equals component total within rounding tolerance.",
        "Flag missing fields, division by zero, negatives, currency direction errors, wrong totals, wrong margin/markup logic.",
        "Check weight_debug for each product to verify the weight source is consistent and correct.",
        "Output PASS/FAIL + issues + minimal Lovable fix prompt if FAIL.",
      ],
      required_output_format: {
        audit_status: "PASS or FAIL",
        issues: [
          {
            severity: "CRITICAL/HIGH/MEDIUM/LOW",
            code: "...",
            where: "...",
            problem: "...",
            expected: "...",
            found: "...",
            fix: "...",
          },
        ],
        summary: "short",
        lovable_fix_prompt: "If FAIL include here, else empty string",
      },
    },
    order: {
      import_order_id: orderId,
      order_reference: order?.order_number || '',
      status: order?.status || '',
      created_at: order?.created_at || '',
      supplier_pos: [],
      settings_snapshot: {
        fx_usd_to_xcg: settings.fx_rate_usd_to_xcg,
        champion_usd_per_kg: settings.champion_cost_per_kg,
        swissport_usd_per_kg: settings.swissport_cost_per_kg,
        bank_usd: settings.bank_charges_usd,
        local_logistics_xcg: settings.local_logistics_xcg,
        spoilage_mode: settings.spoilage_mode,
        spoilage_value: settings.spoilage_pct,
        volumetric_divisor: 6000,
        chargeable_rule: "max(actual, volumetric)",
        pricing: {
          wholesale_margin: 0.20,
          retail_margin: 0.44,
          wholesale_price_formula: "cost/0.80",
          retail_price_formula: "cost/0.56",
        },
      },
    },
    products_full_detail: productsFullDetail,
    cif_versions: cifVersionsOutput,
    formulas_used: {
      volumetric_weight_per_case: "(L*W*H)/6000",
      chargeable_weight_line: "max(actual_weight_line, volumetric_weight_line)",
      fx_rule: `xcg = usd*${settings.fx_rate_usd_to_xcg}, usd = xcg/${settings.fx_rate_usd_to_xcg}`,
      wholesale_price: "cost/0.80",
      retail_price: "cost/0.56",
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
 * Build methods comparison for a set of components against cifProducts.
 */
function buildMethodsComparison(
  cifProducts: CifProduct[],
  versionComponents: CifComponent[],
  versionSettings: CifSettings,
): Record<string, any> {
  const methodsComparison: Record<string, any> = {};

  for (const method of ALL_METHODS) {
    const methodComponents = versionComponents.map(c => ({ ...c, allocation_basis: method }));
    const calcResult = calculateCIF(cifProducts, methodComponents, versionSettings);

    const key = METHOD_KEY_MAP[method] || method;
    methodsComparison[key] = {
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
        totals_shared_usd: calcResult.total_shared_costs_usd,
        totals_supplier_usd: calcResult.allocations.reduce((s, a) => s + a.supplier_cost_usd, 0),
        totals_landed_usd: calcResult.total_landed_usd,
        totals_shared_xcg: calcResult.total_shared_costs_usd * versionSettings.fx_rate_usd_to_xcg,
        totals_supplier_xcg: calcResult.allocations.reduce((s, a) => s + a.supplier_cost_xcg, 0),
        totals_landed_xcg: calcResult.total_landed_xcg,
        rounding_adjustment_usd: calcResult.rounding_adjustment_usd,
      },
    };
  }

  return methodsComparison;
}

/**
 * Build output from existing DB cif_versions.
 */
function buildVersionsOutput(
  versions: any[],
  cifProducts: CifProduct[],
  settings: CifSettings,
) {
  return versions.map(v => {
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

    const methodsComparison = buildMethodsComparison(cifProducts, versionComponents, versionSettings);
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
      methods_comparison: methodsComparison,
    };
  });
}

/**
 * Generate an on-the-fly Estimate CIF version when no DB versions exist.
 * Uses default settings to build shared cost components automatically.
 */
function generateOnTheFlyEstimate(
  cifProducts: CifProduct[],
  settings: CifSettings,
) {
  const primaryResult = calculateCIF(cifProducts, [], settings);
  const totalChargeableKg = primaryResult.totals.total_chargeable_weight_kg;

  const defaultComponents: CifComponent[] = [
    {
      component_type: 'champion',
      label: 'Champion (External)',
      status: 'pending',
      currency: 'USD',
      amount: totalChargeableKg * settings.champion_cost_per_kg,
      allocation_basis: DEFAULT_ALLOCATION_BASIS['champion'] || 'chargeable_weight',
    },
    {
      component_type: 'swissport',
      label: 'Swissport (Local)',
      status: 'pending',
      currency: 'USD',
      amount: totalChargeableKg * settings.swissport_cost_per_kg,
      allocation_basis: DEFAULT_ALLOCATION_BASIS['swissport'] || 'chargeable_weight',
    },
    {
      component_type: 'bank_charges',
      label: 'Bank Charges',
      status: 'pending',
      currency: 'USD',
      amount: settings.bank_charges_usd,
      allocation_basis: DEFAULT_ALLOCATION_BASIS['bank_charges'] || 'value',
    },
    {
      component_type: 'handling_terminal',
      label: 'Local Logistics',
      status: 'pending',
      currency: 'XCG',
      amount: settings.local_logistics_xcg,
      allocation_basis: DEFAULT_ALLOCATION_BASIS['handling_terminal'] || 'cases',
    },
  ];

  const components = defaultComponents.filter(c => c.amount > 0);
  const fullResult = calculateCIF(cifProducts, components, settings);
  const methodsComparison = buildMethodsComparison(cifProducts, components, settings);

  return {
    cif_version_id: 'on-the-fly-estimate',
    type: 'estimate',
    version_no: 1,
    is_final: false,
    created_at: new Date().toISOString(),
    totals: {
      total_cases: fullResult.totals.total_cases,
      total_pieces: fullResult.totals.total_pieces,
      total_actual_weight_kg: fullResult.totals.total_actual_weight_kg,
      total_volumetric_weight_kg: fullResult.totals.total_volumetric_weight_kg,
      total_chargeable_weight_kg: fullResult.totals.total_chargeable_weight_kg,
      total_value_usd: fullResult.totals.total_value_usd,
    },
    components: components.map(c => ({
      component_type: c.component_type,
      status: c.status,
      currency: c.currency,
      amount: c.amount,
      amount_usd: c.currency === 'XCG' ? c.amount / settings.fx_rate_usd_to_xcg : c.amount,
      allocation_basis: c.allocation_basis,
      notes: 'Auto-generated estimate from default settings',
      source_document_id: '',
    })),
    methods_comparison: methodsComparison,
  };
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
  const engineVersion = pack.export_meta?.engine_version || CIF_ENGINE_VERSION;
  const timestamp = Date.now();
  const path = `cif_exports/${orderId}/${exportType}_${engineVersion}_${timestamp}.json`;

  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });

  const { error: uploadError } = await supabase.storage
    .from('cif-exports')
    .upload(path, blob, { contentType: 'application/json' });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error('Failed to upload export to storage');
  }

  const inputHash = await computeInputHash(pack);

  await supabase.from('cif_exports').insert({
    import_order_id: orderId,
    cif_version_id: versionId || null,
    export_type: exportType,
    engine_version: engineVersion,
    storage_path: path,
    input_hash: inputHash,
    created_by: userId || null,
  } as any);

  return path;
}

/**
 * SHA-256 hash of audit pack + engine version for caching
 */
export async function computeInputHash(pack: any): Promise<string> {
  const engineVersion = pack.export_meta?.engine_version || CIF_ENGINE_VERSION;
  const str = JSON.stringify(pack) + engineVersion;
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
