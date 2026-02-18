/**
 * CIF Weight Resolver v2
 * 
 * Canonical function for resolving product case gross weight in grams/kg.
 * Used by readiness check, CIF engine, export builder, and debug panel.
 * 
 * New strict model (v1.5+):
 * 1. If case_weight_override_enabled && case_gross_g > 0 → use case_gross_g
 * 2. If case_gross_g > 0 && weight_mode == "CASE_GROSS" → use case_gross_g
 * 3. If case_pack > 0 && unit weight available → compute base_unit * case_pack + case_tare_g
 *    - weight_mode == "UNIT_GROSS_PLUS_TARE" uses unit_gross_g
 *    - otherwise uses unit_net_g
 * 4. Legacy fallback: product.weight / 1000 (DEPRECATED - only used if new fields empty)
 * 5. Legacy fallback: netto_weight_per_unit * pack_size + empty_case_weight
 * 6. Legacy fallback: gross_weight_per_unit * pack_size
 * 7. FAILED
 */

export type WeightMode = 'CASE_GROSS' | 'UNIT_NET_PLUS_TARE' | 'UNIT_GROSS_PLUS_TARE';

export interface WeightResolution {
  weight_case_kg: number | null;
  case_gross_g_used: number | null;
  source: string;
  debug: WeightDebug;
}

export interface WeightDebug {
  // New explicit fields
  unit_net_g: number | null;
  unit_gross_g: number | null;
  case_tare_g: number | null;
  case_gross_g: number | null;
  case_gross_g_used: number | null;
  weight_mode: string | null;
  case_weight_override_enabled: boolean;
  // Legacy fields (for backward compat display)
  weight_raw: number | null;
  netto_weight_per_unit_raw: number | null;
  gross_weight_per_unit_raw: number | null;
  empty_case_weight_raw: number | null;
  pack_size_raw: number | null;
  weight_case_kg_used: number | null;
  weight_source: string;
}

export interface ProductWeightFields {
  // New explicit fields
  unit_net_g?: number | null;
  unit_gross_g?: number | null;
  case_tare_g?: number | null;
  case_gross_g?: number | null;
  weight_mode?: string | null;
  case_weight_override_enabled?: boolean | null;
  // Legacy fields
  weight?: number | null;
  netto_weight_per_unit?: number | null;
  gross_weight_per_unit?: number | null;
  empty_case_weight?: number | null;
  pack_size?: number | null;
}

export function normalizeUnit(u: string | null | undefined): string | null {
  if (!u) return null;
  const u2 = u.trim().toLowerCase();
  if (['g', 'gram', 'grams'].includes(u2)) return 'g';
  if (['kg', 'kilogram', 'kilograms'].includes(u2)) return 'kg';
  if (['lb', 'lbs'].includes(u2)) return 'lb';
  return u2;
}

export function normalizeToKg(value: number | null, unit: string | null): number | null {
  if (value == null || value <= 0) return null;
  if (!unit || unit === 'g') return value / 1000;
  if (unit === 'kg') return value;
  if (unit === 'lb') return value * 0.45359237;
  return null;
}

/**
 * Resolve case gross weight using the strict weight model.
 * Returns weight in both grams (case_gross_g_used) and kg (weight_case_kg).
 */
export function resolveWeightCaseKg(product: ProductWeightFields): WeightResolution {
  const debug: WeightDebug = {
    unit_net_g: product.unit_net_g ?? null,
    unit_gross_g: product.unit_gross_g ?? null,
    case_tare_g: product.case_tare_g ?? null,
    case_gross_g: product.case_gross_g ?? null,
    case_gross_g_used: null,
    weight_mode: product.weight_mode ?? null,
    case_weight_override_enabled: !!product.case_weight_override_enabled,
    weight_raw: product.weight ?? null,
    netto_weight_per_unit_raw: product.netto_weight_per_unit ?? null,
    gross_weight_per_unit_raw: product.gross_weight_per_unit ?? null,
    empty_case_weight_raw: product.empty_case_weight ?? null,
    pack_size_raw: product.pack_size ?? null,
    weight_case_kg_used: null,
    weight_source: 'FAILED',
  };

  const makeResult = (grams: number, source: string): WeightResolution => {
    const kg = grams / 1000;
    debug.case_gross_g_used = grams;
    debug.weight_case_kg_used = kg;
    debug.weight_source = source;
    return { weight_case_kg: kg, case_gross_g_used: grams, source, debug };
  };

  // Priority 1: Override enabled
  const caseGrossG = Number(product.case_gross_g);
  if (product.case_weight_override_enabled && caseGrossG > 0) {
    return makeResult(caseGrossG, 'case_gross_g_override');
  }

  // Priority 2: case_gross_g with CASE_GROSS mode
  if (caseGrossG > 0 && product.weight_mode === 'CASE_GROSS') {
    return makeResult(caseGrossG, 'case_gross_g');
  }

  // Priority 3: Computed from unit weights
  const packSize = Number(product.pack_size) || 0;
  const unitNetG = Number(product.unit_net_g);
  const unitGrossG = Number(product.unit_gross_g);
  const caseTareG = Number(product.case_tare_g) || 0;

  if (packSize > 0) {
    if (product.weight_mode === 'UNIT_GROSS_PLUS_TARE' && unitGrossG > 0) {
      const total = unitGrossG * packSize + caseTareG;
      return makeResult(total, 'computed_unit_gross*pack+tare');
    }
    if (unitNetG > 0) {
      const total = unitNetG * packSize + caseTareG;
      return makeResult(total, 'computed_unit_net*pack+tare');
    }
    if (unitGrossG > 0) {
      const total = unitGrossG * packSize + caseTareG;
      return makeResult(total, 'computed_unit_gross*pack+tare');
    }
  }

  // Priority 4: case_gross_g without explicit mode (still valid if set)
  if (caseGrossG > 0) {
    return makeResult(caseGrossG, 'case_gross_g_no_mode');
  }

  // ---- LEGACY FALLBACKS (for products not yet migrated) ----

  // Legacy 1: product.weight (ambiguous - may be per-piece or per-case)
  const w = Number(product.weight);
  if (w > 0) {
    // HEURISTIC: if weight looks like per-piece (small value with large pack), skip it
    // Only use if it looks like a reasonable case weight
    const ps = Number(product.pack_size) || 1;
    if (w > 500 || ps <= 2) {
      // Likely a case weight
      return makeResult(w, 'legacy_product.weight');
    }
    // Small weight + large pack = probably per-piece, fall through to netto logic
  }

  // Legacy 2: netto * pack + empty_case
  const netto = Number(product.netto_weight_per_unit);
  const emptyCase = Number(product.empty_case_weight);
  if (netto > 0 && packSize > 0) {
    const totalG = netto * packSize + (emptyCase > 0 ? emptyCase : 0);
    return makeResult(totalG, emptyCase > 0
      ? 'legacy_netto*pack+empty_case'
      : 'legacy_netto*pack');
  }

  // Legacy 3: gross * pack
  const gross = Number(product.gross_weight_per_unit);
  if (gross > 0 && packSize > 0) {
    const totalG = gross * packSize;
    return makeResult(totalG, 'legacy_gross*pack');
  }

  // Legacy 4: use product.weight even if it looked per-piece (last resort)
  if (w > 0) {
    return makeResult(w, 'legacy_product.weight_ambiguous');
  }

  return { weight_case_kg: null, case_gross_g_used: null, source: 'FAILED', debug };
}

/**
 * Check if a product has a weight discrepancy between stored case_gross_g
 * and computed value from unit weights.
 */
export function checkWeightDiscrepancy(product: ProductWeightFields): {
  hasDiscrepancy: boolean;
  storedG: number | null;
  computedG: number | null;
  diffG: number;
  diffPct: number;
} {
  const storedG = Number(product.case_gross_g) || null;
  const packSize = Number(product.pack_size) || 0;
  const unitNetG = Number(product.unit_net_g) || 0;
  const unitGrossG = Number(product.unit_gross_g) || 0;
  const caseTareG = Number(product.case_tare_g) || 0;

  if (!storedG || packSize <= 0) {
    return { hasDiscrepancy: false, storedG, computedG: null, diffG: 0, diffPct: 0 };
  }

  const baseUnit = unitGrossG > 0 ? unitGrossG : unitNetG;
  if (baseUnit <= 0) {
    return { hasDiscrepancy: false, storedG, computedG: null, diffG: 0, diffPct: 0 };
  }

  const computedG = baseUnit * packSize + caseTareG;
  const diffG = Math.abs(storedG - computedG);
  const diffPct = (diffG / Math.max(storedG, computedG)) * 100;

  // Threshold: > max(50g, 5%)
  const hasDiscrepancy = diffG > 50 && diffPct > 5;

  return { hasDiscrepancy, storedG, computedG, diffG, diffPct };
}
