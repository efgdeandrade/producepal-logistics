import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductWeightInfo {
  code: string;
  name: string;
  quantity: number;
  packSize: number;
  grossWeightPerUnit?: number;
  netWeightPerUnit?: number;
  emptyCaseWeight?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  priceUsdPerUnit?: number;
  supplierId?: string;
  supplierName?: string;
  isFromStock?: boolean;
}

interface CIFProductResult {
  productCode: string;
  productName: string;
  quantity: number;
  costUSD: number;
  freightShare: number;
  cifUSD: number;
  cifXCG: number;
  cifPerUnit: number;
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  adjustmentFactor?: number;
  adjustmentConfidence?: number;
}

// Calculate volumetric weight per case: (L × W × H) / 6000
function calculateVolumetricWeightPerCase(product: ProductWeightInfo): number {
  if (!product.lengthCm || !product.widthCm || !product.heightCm) return 0;
  return (product.lengthCm * product.widthCm * product.heightCm) / 6000;
}

// Calculate actual weight per case (product weight + case weight)
function calculateActualWeightPerCase(product: ProductWeightInfo): number {
  const weightPerUnit = product.grossWeightPerUnit || product.netWeightPerUnit || 0;
  const totalProductWeight = weightPerUnit * product.packSize;
  const caseWeight = product.emptyCaseWeight || 0;
  return totalProductWeight + caseWeight;
}

// Calculate freight share using Smart Blend method
function calculateFreightShare(
  product: ProductWeightInfo,
  productChargeableWeight: number,
  productCost: number,
  totalChargeableWeight: number,
  totalCost: number,
  totalFreight: number,
  blendRatio: number = 0.7
): number {
  if (totalChargeableWeight === 0 && totalCost === 0) return 0;
  
  const weightShare = totalChargeableWeight > 0 
    ? (productChargeableWeight / totalChargeableWeight) * totalFreight 
    : 0;
  const costShare = totalCost > 0 
    ? (productCost / totalCost) * totalFreight 
    : 0;
  
  return (weightShare * blendRatio) + (costShare * (1 - blendRatio));
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { orderId, forceRecalculate = false } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'orderId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CIF Auto-Estimate] Processing order: ${orderId}, forceRecalculate: ${forceRecalculate}`);

    // Check if estimate already exists (unless force recalculate)
    if (!forceRecalculate) {
      const { data: existingSnapshot } = await supabase
        .from('cif_calculation_snapshots')
        .select('id')
        .eq('order_id', orderId)
        .eq('snapshot_type', 'estimate')
        .maybeSingle();

      if (existingSnapshot) {
        console.log(`[CIF Auto-Estimate] Estimate already exists for order ${orderId}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Estimate already exists', 
            snapshotId: existingSnapshot.id 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('[CIF Auto-Estimate] Order not found:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch order items (exclude from_stock items)
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .or('is_from_stock.is.null,is_from_stock.eq.false');

    if (itemsError) {
      console.error('[CIF Auto-Estimate] Error fetching order items:', itemsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch order items' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!orderItems || orderItems.length === 0) {
      console.log('[CIF Auto-Estimate] No items to calculate CIF for');
      return new Response(
        JSON.stringify({ success: true, message: 'No items to calculate (all from stock or empty)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique product codes
    const productCodes = [...new Set(orderItems.map(item => item.product_code))];

    // Fetch product details with supplier info
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*, suppliers(id, name)')
      .in('code', productCodes);

    if (productsError) {
      console.error('[CIF Auto-Estimate] Error fetching products:', productsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch product details' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create product lookup map
    const productMap = new Map(products?.map(p => [p.code, p]) || []);

    // Fetch tariff settings
    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', [
        'freight_exterior_tariff',
        'freight_local_tariff',
        'usd_to_xcg_rate',
        'local_logistics_usd',
        'labor_xcg',
        'default_bank_charges_usd'
      ]);

    const settings: Record<string, any> = {};
    settingsData?.forEach(s => {
      settings[s.key] = s.value;
    });

    const exteriorTariff = settings.freight_exterior_tariff?.rate || 2.63;
    const localTariff = settings.freight_local_tariff?.rate || 0.37;
    const exchangeRate = settings.usd_to_xcg_rate?.rate || 1.82;
    const localLogisticsUSD = parseFloat(settings.local_logistics_usd) || 91;
    const laborXCG = parseFloat(settings.labor_xcg) || 50;
    const bankChargesUSD = parseFloat(settings.default_bank_charges_usd) || 0;

    console.log('[CIF Auto-Estimate] Tariffs:', { exteriorTariff, localTariff, exchangeRate, localLogisticsUSD, laborXCG, bankChargesUSD });

    // Get unique supplier IDs
    const supplierIds = [...new Set(
      products?.map(p => (p.suppliers as any)?.id).filter(Boolean)
    )];

    // Fetch supplier fixed costs
    let supplierFixedCostsTotal = 0;
    if (supplierIds.length > 0) {
      const { data: supplierCosts } = await supabase
        .from('supplier_cost_config')
        .select('*')
        .in('supplier_id', supplierIds)
        .eq('is_active', true);

      supplierCosts?.forEach(cost => {
        supplierFixedCostsTotal += parseFloat(cost.fixed_cost_per_shipment_usd) || 0;
      });
    }

    console.log('[CIF Auto-Estimate] Supplier fixed costs total:', supplierFixedCostsTotal);

    // Fetch learning patterns for products
    const { data: learningPatterns } = await supabase
      .from('cif_learning_patterns')
      .select('*')
      .eq('pattern_type', 'product')
      .in('pattern_key', productCodes);

    const patternMap = new Map(
      learningPatterns?.map(p => [p.pattern_key, p]) || []
    );

    // Build product weight info and calculate weights
    const productInfoList: ProductWeightInfo[] = [];
    let totalActualWeightKg = 0;
    let totalVolumetricWeightKg = 0;
    let totalCost = 0;

    for (const item of orderItems) {
      const product = productMap.get(item.product_code);
      if (!product) {
        console.warn(`[CIF Auto-Estimate] Product not found: ${item.product_code}`);
        continue;
      }

      const quantity = item.units_quantity || item.quantity || 0;
      const packSize = product.pack_size || 1;
      const cases = Math.ceil(quantity / packSize);

      const productInfo: ProductWeightInfo = {
        code: product.code,
        name: product.name,
        quantity,
        packSize,
        grossWeightPerUnit: product.gross_weight_per_unit,
        netWeightPerUnit: product.netto_weight_per_unit,
        emptyCaseWeight: product.empty_case_weight,
        lengthCm: product.length_cm,
        widthCm: product.width_cm,
        heightCm: product.height_cm,
        priceUsdPerUnit: product.price_usd_per_unit,
        supplierId: (product.suppliers as any)?.id,
        supplierName: (product.suppliers as any)?.name,
        isFromStock: false,
      };

      productInfoList.push(productInfo);

      // Calculate weights for this product
      const actualPerCase = calculateActualWeightPerCase(productInfo);
      const volumetricPerCase = calculateVolumetricWeightPerCase(productInfo);

      const actualWeightKg = (actualPerCase * cases) / 1000;
      const volumetricWeightKg = volumetricPerCase * cases;

      totalActualWeightKg += actualWeightKg;
      totalVolumetricWeightKg += volumetricWeightKg;
      totalCost += (productInfo.priceUsdPerUnit || 0) * quantity;
    }

    // Chargeable weight = MAX(actual, volumetric)
    const totalChargeableWeightKg = Math.max(totalActualWeightKg, totalVolumetricWeightKg);
    const limitingFactor = totalVolumetricWeightKg > totalActualWeightKg ? 'volumetric' : 'actual';

    console.log('[CIF Auto-Estimate] Weights:', { 
      totalActualWeightKg, 
      totalVolumetricWeightKg, 
      totalChargeableWeightKg,
      limitingFactor
    });

    // Calculate total freight
    const freightExteriorUSD = totalChargeableWeightKg * exteriorTariff;
    const freightLocalUSD = totalChargeableWeightKg * localTariff;
    const totalFreightUSD = freightExteriorUSD + freightLocalUSD + localLogisticsUSD + bankChargesUSD + supplierFixedCostsTotal;

    console.log('[CIF Auto-Estimate] Freight breakdown:', {
      freightExteriorUSD,
      freightLocalUSD,
      localLogisticsUSD,
      bankChargesUSD,
      supplierFixedCostsTotal,
      totalFreightUSD
    });

    // Calculate CIF per product using Smart Blend (default 0.7 weight ratio)
    const blendRatio = 0.7;
    const productResults: CIFProductResult[] = [];
    const aiAdjustments: any[] = [];

    for (const productInfo of productInfoList) {
      const cases = Math.ceil(productInfo.quantity / productInfo.packSize);
      const actualPerCase = calculateActualWeightPerCase(productInfo);
      const volumetricPerCase = calculateVolumetricWeightPerCase(productInfo);
      
      const actualWeightKg = (actualPerCase * cases) / 1000;
      const volumetricWeightKg = volumetricPerCase * cases;
      const chargeableWeightKg = Math.max(actualWeightKg, volumetricWeightKg);
      
      const productCost = (productInfo.priceUsdPerUnit || 0) * productInfo.quantity;
      
      // Calculate freight share using Smart Blend
      const freightShare = calculateFreightShare(
        productInfo,
        chargeableWeightKg,
        productCost,
        totalChargeableWeightKg,
        totalCost,
        totalFreightUSD,
        blendRatio
      );

      let cifUSD = productCost + freightShare;
      let cifXCG = cifUSD * exchangeRate;
      let cifPerUnit = productInfo.quantity > 0 ? cifXCG / productInfo.quantity : 0;

      // Apply learning adjustments if confidence > 70%
      const pattern = patternMap.get(productInfo.code);
      let adjustmentFactor: number | undefined;
      let adjustmentConfidence: number | undefined;

      if (pattern && (pattern.confidence_score || 0) >= 70) {
        const factor = pattern.adjustment_factor || 1;
        adjustmentFactor = factor;
        adjustmentConfidence = pattern.confidence_score ?? undefined;
        cifPerUnit = cifPerUnit * factor;
        cifXCG = cifPerUnit * productInfo.quantity;
        cifUSD = cifXCG / exchangeRate;

        aiAdjustments.push({
          productCode: productInfo.code,
          factor: factor,
          confidence: adjustmentConfidence,
          source: 'auto_applied'
        });

        console.log(`[CIF Auto-Estimate] Applied AI adjustment for ${productInfo.code}: ${adjustmentFactor}x (${adjustmentConfidence}% confidence)`);
      } else if (pattern && (pattern.confidence_score || 0) >= 50) {
        // Suggest but don't auto-apply
        aiAdjustments.push({
          productCode: productInfo.code,
          factor: pattern.adjustment_factor,
          confidence: pattern.confidence_score,
          source: 'suggested'
        });
      }

      productResults.push({
        productCode: productInfo.code,
        productName: productInfo.name,
        quantity: productInfo.quantity,
        costUSD: productCost,
        freightShare,
        cifUSD,
        cifXCG,
        cifPerUnit,
        actualWeightKg,
        volumetricWeightKg,
        chargeableWeightKg,
        adjustmentFactor,
        adjustmentConfidence
      });
    }

    // Save snapshot to database
    const snapshotData = {
      order_id: orderId,
      snapshot_type: 'estimate',
      total_freight_usd: totalFreightUSD,
      freight_exterior_usd: freightExteriorUSD,
      freight_local_usd: freightLocalUSD,
      local_logistics_usd: localLogisticsUSD,
      labor_xcg: laborXCG,
      bank_charges_usd: bankChargesUSD,
      supplier_fixed_costs_usd: supplierFixedCostsTotal,
      distribution_method: 'smartBlend',
      blend_ratio: blendRatio,
      exchange_rate: exchangeRate,
      total_chargeable_weight_kg: totalChargeableWeightKg,
      total_actual_weight_kg: totalActualWeightKg,
      total_volumetric_weight_kg: totalVolumetricWeightKg,
      products_data: productResults,
      ai_adjustments_applied: aiAdjustments.length > 0 ? aiAdjustments : null,
      notes: `Auto-generated estimate. Limiting factor: ${limitingFactor}.`,
    };

    // Delete existing estimate if force recalculating
    if (forceRecalculate) {
      await supabase
        .from('cif_calculation_snapshots')
        .delete()
        .eq('order_id', orderId)
        .eq('snapshot_type', 'estimate');
    }

    const { data: snapshot, error: snapshotError } = await supabase
      .from('cif_calculation_snapshots')
      .insert(snapshotData)
      .select()
      .single();

    if (snapshotError) {
      console.error('[CIF Auto-Estimate] Error saving snapshot:', snapshotError);
      return new Response(
        JSON.stringify({ error: 'Failed to save estimate snapshot' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CIF Auto-Estimate] Estimate saved successfully:', snapshot.id);

    return new Response(
      JSON.stringify({
        success: true,
        snapshotId: snapshot.id,
        summary: {
          totalFreightUSD,
          totalChargeableWeightKg,
          totalActualWeightKg,
          totalVolumetricWeightKg,
          limitingFactor,
          productsCount: productResults.length,
          aiAdjustmentsApplied: aiAdjustments.filter(a => a.source === 'auto_applied').length,
          aiAdjustmentsSuggested: aiAdjustments.filter(a => a.source === 'suggested').length,
        },
        products: productResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[CIF Auto-Estimate] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
