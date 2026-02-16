/**
 * CIF Profile - Deterministic Calculation Engine
 * 
 * All formulas are locked and deterministic. AI cannot modify these formulas.
 * Full precision is maintained in all calculations; rounding is UI-only.
 */

/** Bump this value whenever CIF formulas change. */
export const CIF_ENGINE_VERSION = "2026-02-16_v1.1";

// =============================================
// TYPES
// =============================================

export interface CifProduct {
  product_id: string;
  product_code: string;
  product_name: string;
  qty_cases: number;
  case_pack: number; // pieces per case
  weight_case_kg: number; // weight per case in kg
  length_cm: number;
  width_cm: number;
  height_cm: number;
  supplier_cost_usd_per_case: number;
}

export interface CifComponent {
  id?: string;
  component_type: string;
  label?: string;
  status: 'pending' | 'received' | 'approved';
  currency: 'USD' | 'XCG';
  amount: number;
  allocation_basis: AllocationBasis;
  notes?: string;
}

export type AllocationBasis = 
  | 'chargeable_weight' 
  | 'actual_weight' 
  | 'volume' 
  | 'value' 
  | 'cases' 
  | 'pieces' 
  | 'equal';

export interface CifSettings {
  fx_rate_usd_to_xcg: number;
  champion_cost_per_kg: number;
  swissport_cost_per_kg: number;
  local_logistics_xcg: number;
  bank_charges_usd: number;
  spoilage_mode: 'percentage' | 'component';
  spoilage_pct: number;
  wholesale_margin_pct: number;
  retail_margin_pct: number;
}

export const DEFAULT_CIF_SETTINGS: CifSettings = {
  fx_rate_usd_to_xcg: 1.82,
  champion_cost_per_kg: 2.63,
  swissport_cost_per_kg: 0.37,
  local_logistics_xcg: 100.00,
  bank_charges_usd: 75.00,
  spoilage_mode: 'percentage',
  spoilage_pct: 0,
  wholesale_margin_pct: 20,
  retail_margin_pct: 44,
};

// Default allocation basis per component type
export const DEFAULT_ALLOCATION_BASIS: Record<string, AllocationBasis> = {
  'air_freight': 'chargeable_weight',
  'champion': 'chargeable_weight',
  'swissport': 'chargeable_weight',
  'handling_terminal': 'cases',
  'broker_fees': 'value',
  'insurance': 'value',
  'duties_taxes': 'value',
  'bank_charges': 'value',
  'spoilage': 'value',
  'other': 'equal',
};

export const COMPONENT_TYPES = [
  { value: 'air_freight', label: 'Air Freight' },
  { value: 'champion', label: 'Champion (External)' },
  { value: 'swissport', label: 'Swissport (Local)' },
  { value: 'handling_terminal', label: 'Handling / Terminal' },
  { value: 'broker_fees', label: 'Customs Broker Fees' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'duties_taxes', label: 'Import Duties / Taxes' },
  { value: 'bank_charges', label: 'Bank Charges' },
  { value: 'spoilage', label: 'Spoilage Allowance' },
  { value: 'other', label: 'Other' },
];

// =============================================
// LINE-LEVEL CALCULATIONS
// =============================================

export interface LineCalculation {
  product_id: string;
  product_code: string;
  product_name: string;
  qty_cases: number;
  qty_pieces: number;
  supplier_cost_usd_per_case: number;
  line_value_usd: number;
  actual_weight_kg: number;
  volumetric_weight_kg_per_case: number;
  volumetric_weight_kg: number;
  chargeable_weight_kg: number;
}

export function calculateLineWeights(product: CifProduct): LineCalculation {
  const qty_pieces = product.qty_cases * product.case_pack;
  const line_value_usd = product.qty_cases * product.supplier_cost_usd_per_case;
  const actual_weight_kg = product.qty_cases * product.weight_case_kg;
  
  // Volumetric weight: (L × W × H) / 6000 per case
  const volumetric_weight_kg_per_case = 
    (product.length_cm * product.width_cm * product.height_cm) / 6000;
  const volumetric_weight_kg = product.qty_cases * volumetric_weight_kg_per_case;
  
  // Chargeable = max(actual, volumetric)
  const chargeable_weight_kg = Math.max(actual_weight_kg, volumetric_weight_kg);

  return {
    product_id: product.product_id,
    product_code: product.product_code,
    product_name: product.product_name,
    qty_cases: product.qty_cases,
    qty_pieces,
    supplier_cost_usd_per_case: product.supplier_cost_usd_per_case,
    line_value_usd,
    actual_weight_kg,
    volumetric_weight_kg_per_case,
    volumetric_weight_kg,
    chargeable_weight_kg,
  };
}

// =============================================
// SHIPMENT TOTALS
// =============================================

export interface ShipmentTotals {
  total_cases: number;
  total_pieces: number;
  total_actual_weight_kg: number;
  total_volumetric_weight_kg: number;
  total_chargeable_weight_kg: number;
  total_value_usd: number;
  number_of_lines: number;
}

export function calculateShipmentTotals(lines: LineCalculation[]): ShipmentTotals {
  return {
    total_cases: lines.reduce((s, l) => s + l.qty_cases, 0),
    total_pieces: lines.reduce((s, l) => s + l.qty_pieces, 0),
    total_actual_weight_kg: lines.reduce((s, l) => s + l.actual_weight_kg, 0),
    total_volumetric_weight_kg: lines.reduce((s, l) => s + l.volumetric_weight_kg, 0),
    total_chargeable_weight_kg: lines.reduce((s, l) => s + l.chargeable_weight_kg, 0),
    total_value_usd: lines.reduce((s, l) => s + l.line_value_usd, 0),
    number_of_lines: lines.length,
  };
}

// =============================================
// COST ALLOCATION ENGINE
// =============================================

function getBasisValues(
  basis: AllocationBasis,
  line: LineCalculation,
  totals: ShipmentTotals
): { basis_line: number; basis_total: number } {
  switch (basis) {
    case 'chargeable_weight':
      return { basis_line: line.chargeable_weight_kg, basis_total: totals.total_chargeable_weight_kg };
    case 'actual_weight':
      return { basis_line: line.actual_weight_kg, basis_total: totals.total_actual_weight_kg };
    case 'volume':
      return { basis_line: line.volumetric_weight_kg, basis_total: totals.total_volumetric_weight_kg };
    case 'value':
      return { basis_line: line.line_value_usd, basis_total: totals.total_value_usd };
    case 'cases':
      return { basis_line: line.qty_cases, basis_total: totals.total_cases };
    case 'pieces':
      return { basis_line: line.qty_pieces, basis_total: totals.total_pieces };
    case 'equal':
      return { basis_line: 1, basis_total: totals.number_of_lines };
    default:
      return { basis_line: 1, basis_total: totals.number_of_lines };
  }
}

function normalizeToUSD(amount: number, currency: 'USD' | 'XCG', fxRate: number): number {
  if (currency === 'XCG') {
    return amount / fxRate;
  }
  return amount;
}

export interface AllocationResult {
  product_code: string;
  product_id: string;
  product_name: string;
  qty_cases: number;
  qty_pieces: number;
  supplier_cost_usd_per_case: number;
  supplier_cost_usd: number;
  supplier_cost_xcg: number;
  actual_weight_kg: number;
  volumetric_weight_kg: number;
  chargeable_weight_kg: number;
  // Per-component breakdown
  allocated_costs: Record<string, number>; // component_type -> USD amount
  allocated_shared_costs_usd: number;
  allocated_shared_costs_xcg: number;
  spoilage_usd: number;
  // Landed totals
  landed_total_usd: number;
  landed_total_xcg: number;
  // Unit costs
  landed_cost_per_piece_usd: number;
  landed_cost_per_piece_xcg: number;
  landed_cost_per_case_usd: number;
  landed_cost_per_case_xcg: number;
  landed_cost_per_kg_usd: number | null;
  landed_cost_per_kg_xcg: number | null;
}

export interface PricingSuggestion {
  product_code: string;
  wholesale_price_per_piece_usd: number;
  wholesale_price_per_piece_xcg: number;
  wholesale_price_per_case_usd: number;
  wholesale_price_per_case_xcg: number;
  wholesale_price_per_kg_usd: number | null;
  wholesale_price_per_kg_xcg: number | null;
  retail_price_per_piece_usd: number;
  retail_price_per_piece_xcg: number;
  retail_price_per_case_usd: number;
  retail_price_per_case_xcg: number;
  retail_price_per_kg_usd: number | null;
  retail_price_per_kg_xcg: number | null;
  wholesale_margin_pct: number;
  retail_margin_pct: number;
}

export interface CifCalculationResult {
  lines: LineCalculation[];
  totals: ShipmentTotals;
  allocations: AllocationResult[];
  pricing: PricingSuggestion[];
  total_shared_costs_usd: number;
  total_landed_usd: number;
  total_landed_xcg: number;
  rounding_adjustment_usd: number;
}

export function calculateCIF(
  products: CifProduct[],
  components: CifComponent[],
  settings: CifSettings
): CifCalculationResult {
  const fxRate = settings.fx_rate_usd_to_xcg;
  
  // Step 1: Calculate line weights
  const lines = products.map(calculateLineWeights);
  const totals = calculateShipmentTotals(lines);

  // Step 2: Normalize all component amounts to USD
  const normalizedComponents = components.map(c => ({
    ...c,
    amount_usd: normalizeToUSD(c.amount, c.currency, fxRate),
  }));

  // Step 3: Allocate each component to each line
  const allocations: AllocationResult[] = lines.map(line => {
    const allocated_costs: Record<string, number> = {};
    let allocated_shared_costs_usd = 0;

    for (const comp of normalizedComponents) {
      // Skip spoilage component if we're using percentage mode
      if (comp.component_type === 'spoilage' && settings.spoilage_mode === 'percentage') {
        continue;
      }

      const { basis_line, basis_total } = getBasisValues(comp.allocation_basis, line, totals);
      const share = basis_total > 0 ? basis_line / basis_total : 0;
      const allocated_usd = comp.amount_usd * share;

      allocated_costs[comp.component_type] = (allocated_costs[comp.component_type] || 0) + allocated_usd;
      allocated_shared_costs_usd += allocated_usd;
    }

    // Spoilage (percentage mode)
    let spoilage_usd = 0;
    if (settings.spoilage_mode === 'percentage' && settings.spoilage_pct > 0) {
      spoilage_usd = (settings.spoilage_pct / 100) * line.line_value_usd;
    }

    const supplier_cost_usd = line.line_value_usd;
    const landed_total_usd = supplier_cost_usd + allocated_shared_costs_usd + spoilage_usd;

    const landed_cost_per_piece_usd = line.qty_pieces > 0 ? landed_total_usd / line.qty_pieces : 0;
    const landed_cost_per_case_usd = line.qty_cases > 0 ? landed_total_usd / line.qty_cases : 0;
    const landed_cost_per_kg_usd = line.actual_weight_kg > 0 ? landed_total_usd / line.actual_weight_kg : null;

    return {
      product_code: line.product_code,
      product_id: line.product_id,
      product_name: line.product_name,
      qty_cases: line.qty_cases,
      qty_pieces: line.qty_pieces,
      supplier_cost_usd_per_case: line.supplier_cost_usd_per_case,
      supplier_cost_usd,
      supplier_cost_xcg: supplier_cost_usd * fxRate,
      actual_weight_kg: line.actual_weight_kg,
      volumetric_weight_kg: line.volumetric_weight_kg,
      chargeable_weight_kg: line.chargeable_weight_kg,
      allocated_costs,
      allocated_shared_costs_usd,
      allocated_shared_costs_xcg: allocated_shared_costs_usd * fxRate,
      spoilage_usd,
      landed_total_usd,
      landed_total_xcg: landed_total_usd * fxRate,
      landed_cost_per_piece_usd,
      landed_cost_per_piece_xcg: landed_cost_per_piece_usd * fxRate,
      landed_cost_per_case_usd,
      landed_cost_per_case_xcg: landed_cost_per_case_usd * fxRate,
      landed_cost_per_kg_usd,
      landed_cost_per_kg_xcg: landed_cost_per_kg_usd !== null ? landed_cost_per_kg_usd * fxRate : null,
    };
  });

  // Step 4: Rounding adjustment
  const totalComponentsUSD = normalizedComponents
    .filter(c => !(c.component_type === 'spoilage' && settings.spoilage_mode === 'percentage'))
    .reduce((s, c) => s + c.amount_usd, 0);
  const totalAllocatedUSD = allocations.reduce((s, a) => s + a.allocated_shared_costs_usd, 0);
  const rounding_adjustment_usd = totalComponentsUSD - totalAllocatedUSD;

  // Step 5: Pricing suggestions
  const wholesaleMargin = settings.wholesale_margin_pct / 100;
  const retailMargin = settings.retail_margin_pct / 100;

  const pricing: PricingSuggestion[] = allocations.map(alloc => {
    const wp_piece_usd = alloc.landed_cost_per_piece_usd / (1 - wholesaleMargin);
    const rp_piece_usd = alloc.landed_cost_per_piece_usd / (1 - retailMargin);
    const wp_case_usd = alloc.landed_cost_per_case_usd / (1 - wholesaleMargin);
    const rp_case_usd = alloc.landed_cost_per_case_usd / (1 - retailMargin);
    const wp_kg_usd = alloc.landed_cost_per_kg_usd !== null ? alloc.landed_cost_per_kg_usd / (1 - wholesaleMargin) : null;
    const rp_kg_usd = alloc.landed_cost_per_kg_usd !== null ? alloc.landed_cost_per_kg_usd / (1 - retailMargin) : null;

    return {
      product_code: alloc.product_code,
      wholesale_price_per_piece_usd: wp_piece_usd,
      wholesale_price_per_piece_xcg: wp_piece_usd * fxRate,
      wholesale_price_per_case_usd: wp_case_usd,
      wholesale_price_per_case_xcg: wp_case_usd * fxRate,
      wholesale_price_per_kg_usd: wp_kg_usd,
      wholesale_price_per_kg_xcg: wp_kg_usd !== null ? wp_kg_usd * fxRate : null,
      retail_price_per_piece_usd: rp_piece_usd,
      retail_price_per_piece_xcg: rp_piece_usd * fxRate,
      retail_price_per_case_usd: rp_case_usd,
      retail_price_per_case_xcg: rp_case_usd * fxRate,
      retail_price_per_kg_usd: rp_kg_usd,
      retail_price_per_kg_xcg: rp_kg_usd !== null ? rp_kg_usd * fxRate : null,
      wholesale_margin_pct: settings.wholesale_margin_pct,
      retail_margin_pct: settings.retail_margin_pct,
    };
  });

  const total_shared_costs_usd = totalComponentsUSD;
  const total_supplier_usd = allocations.reduce((s, a) => s + a.supplier_cost_usd, 0);
  const total_spoilage_usd = allocations.reduce((s, a) => s + a.spoilage_usd, 0);
  const total_landed_usd = total_supplier_usd + total_shared_costs_usd + total_spoilage_usd;

  return {
    lines,
    totals,
    allocations,
    pricing,
    total_shared_costs_usd,
    total_landed_usd,
    total_landed_xcg: total_landed_usd * fxRate,
    rounding_adjustment_usd,
  };
}

// =============================================
// UTILITY: Format currency
// =============================================
export function formatUSD(value: number | null | undefined): string {
  if (value == null) return '—';
  return `$${value.toFixed(2)}`;
}

export function formatXCG(value: number | null | undefined): string {
  if (value == null) return '—';
  return `ƒ${value.toFixed(2)}`;
}
