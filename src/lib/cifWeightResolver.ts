/**
 * CIF Weight Resolver
 * 
 * Canonical function for resolving product case weight in kg.
 * Used by readiness check, CIF engine, export builder, and debug panel.
 * 
 * Priority:
 * 1. product.weight (stored in grams) -> /1000
 * 2. product.netto_weight_per_unit * pack_size + empty_case_weight (all grams) -> /1000
 * 3. product.netto_weight_per_unit * pack_size (grams) -> /1000
 * 4. product.gross_weight_per_unit * pack_size (grams) -> /1000
 * 5. FAILED
 */

export interface WeightResolution {
  weight_case_kg: number | null;
  source: string;
  debug: WeightDebug;
}

export interface WeightDebug {
  weight_raw: number | null;
  netto_weight_per_unit_raw: number | null;
  gross_weight_per_unit_raw: number | null;
  empty_case_weight_raw: number | null;
  pack_size_raw: number | null;
  weight_case_kg_used: number | null;
  weight_source: string;
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
  // Default unit is grams (per memory: weights stored in grams)
  if (!unit || unit === 'g') return value / 1000;
  if (unit === 'kg') return value;
  if (unit === 'lb') return value * 0.45359237;
  return null;
}

/**
 * Resolve case weight in kg from product record fields.
 * `product` should contain raw DB fields.
 */
export function resolveWeightCaseKg(product: {
  weight?: number | null;
  netto_weight_per_unit?: number | null;
  gross_weight_per_unit?: number | null;
  empty_case_weight?: number | null;
  pack_size?: number | null;
}): WeightResolution {
  const debug: WeightDebug = {
    weight_raw: product.weight ?? null,
    netto_weight_per_unit_raw: product.netto_weight_per_unit ?? null,
    gross_weight_per_unit_raw: product.gross_weight_per_unit ?? null,
    empty_case_weight_raw: product.empty_case_weight ?? null,
    pack_size_raw: product.pack_size ?? null,
    weight_case_kg_used: null,
    weight_source: 'FAILED',
  };

  const w = Number(product.weight);
  if (w > 0) {
    const kg = w / 1000;
    debug.weight_case_kg_used = kg;
    debug.weight_source = 'product.weight';
    return { weight_case_kg: kg, source: 'product.weight', debug };
  }

  const packSize = Number(product.pack_size) || 1;
  const netto = Number(product.netto_weight_per_unit);
  const emptyCase = Number(product.empty_case_weight);

  // netto * pack_size + empty_case_weight
  if (netto > 0) {
    const totalG = netto * packSize + (emptyCase > 0 ? emptyCase : 0);
    const kg = totalG / 1000;
    debug.weight_case_kg_used = kg;
    debug.weight_source = emptyCase > 0
      ? 'product.netto_weight_per_unit*pack_size+empty_case_weight'
      : 'product.netto_weight_per_unit*pack_size';
    return { weight_case_kg: kg, source: debug.weight_source, debug };
  }

  const gross = Number(product.gross_weight_per_unit);
  if (gross > 0) {
    const kg = (gross * packSize) / 1000;
    debug.weight_case_kg_used = kg;
    debug.weight_source = 'product.gross_weight_per_unit*pack_size';
    return { weight_case_kg: kg, source: debug.weight_source, debug };
  }

  return { weight_case_kg: null, source: 'FAILED', debug };
}
