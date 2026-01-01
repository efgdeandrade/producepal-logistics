import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Allowed origins for CORS - production and staging domains
const allowedOrigins = [
  'https://fuik.io',
  'https://www.fuik.io',
  'https://dnxzpkbobzwjcuyfgdnh.lovable.app'
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// Default CORS headers for preflight
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const ProductInfoSchema = z.object({
  code: z.string(),
  name: z.string(),
  quantity: z.number().min(0),
  packSize: z.number().min(1),
  nettoWeightPerUnit: z.number().min(0),
  grossWeightPerUnit: z.number().min(0),
  emptyCaseWeight: z.number().min(0),
  lengthCm: z.number().min(0),
  widthCm: z.number().min(0),
  heightCm: z.number().min(0),
  costUSD: z.number().min(0),
  wholesalePriceXCG: z.number().min(0),
  retailPriceXCG: z.number().min(0),
  supplierId: z.string(),
  supplierName: z.string(),
});

const InputSchema = z.object({
  products: z.array(ProductInfoSchema).min(1, 'At least one product is required'),
  orderId: z.string().uuid().optional(),
  freightCostPerKg: z.number().min(0),
  exchangeRate: z.number().min(0),
});

interface ProductInfo {
  code: string;
  name: string;
  quantity: number;
  packSize: number;
  nettoWeightPerUnit: number;
  grossWeightPerUnit: number;
  emptyCaseWeight: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  costUSD: number;
  wholesalePriceXCG: number;
  retailPriceXCG: number;
  supplierId: string;
  supplierName: string;
}

// Helper function to verify user role
async function verifyUserRole(req: Request, supabase: any, allowedRoles: string[]): Promise<{ userId: string; role: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing authorization header');
  }

  // Get user from JWT
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    throw new Error('Invalid or expired token');
  }

  // Get user roles
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  if (rolesError) {
    console.error('Error fetching user roles:', rolesError);
    throw new Error('Failed to verify user permissions');
  }

  const userRoles = roles?.map((r: any) => r.role) || [];
  const hasRequiredRole = userRoles.some((role: string) => allowedRoles.includes(role));

  if (!hasRequiredRole) {
    throw new Error('Forbidden: Insufficient permissions. Required roles: ' + allowedRoles.join(', '));
  }

  return { userId: user.id, role: userRoles[0] };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Verify user has admin, management, or logistics role
    await verifyUserRole(req, supabase, ['admin', 'management', 'logistics']);

    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = InputSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      console.error('Input validation failed:', validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid input format',
          details: validationResult.error.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { products, orderId, freightCostPerKg, exchangeRate } = validationResult.data;

    // Calculate weights for each product
    const productAnalysis = products.map((p: ProductInfo) => {
      const cases = Math.ceil(p.quantity / p.packSize);
      const grossWeight = p.grossWeightPerUnit > 0 ? p.grossWeightPerUnit : p.nettoWeightPerUnit;
      const actualWeightPerCase = (grossWeight * p.packSize) + p.emptyCaseWeight;
      const volumetricWeightPerCase = p.lengthCm && p.widthCm && p.heightCm
        ? (p.lengthCm * p.widthCm * p.heightCm) / 6000
        : 0;
      const chargeableWeightPerCase = Math.max(actualWeightPerCase, volumetricWeightPerCase);

      return {
        ...p,
        cases,
        actualWeightPerCase,
        volumetricWeightPerCase,
        chargeableWeightPerCase,
        totalActualWeight: actualWeightPerCase * cases,
        totalVolumetricWeight: volumetricWeightPerCase * cases,
        totalChargeableWeight: chargeableWeightPerCase * cases,
        weightType: chargeableWeightPerCase === volumetricWeightPerCase ? 'volumetric' : 'actual' as 'volumetric' | 'actual'
      };
    });

    // Group by supplier
    const supplierGroups = new Map<string, typeof productAnalysis>();
    productAnalysis.forEach(p => {
      if (!supplierGroups.has(p.supplierId)) {
        supplierGroups.set(p.supplierId, []);
      }
      supplierGroups.get(p.supplierId)!.push(p);
    });

    // Calculate totals
    const totalActualWeight = productAnalysis.reduce((sum, p) => sum + p.totalActualWeight, 0);
    const totalVolumetricWeight = productAnalysis.reduce((sum, p) => sum + p.totalVolumetricWeight, 0);
    const totalChargeableWeight = Math.max(totalActualWeight, totalVolumetricWeight);
    const estimatedPallets = Math.ceil(totalChargeableWeight / 500);
    const weightWithPallets = totalChargeableWeight + (estimatedPallets * 25); // Add 25kg per pallet

    // Determine limiting factor
    const weightGap = totalVolumetricWeight - totalActualWeight;
    const gapPercentage = totalActualWeight > 0 ? (weightGap / totalActualWeight) * 100 : 0;

    let limitingFactor: string;
    if (Math.abs(gapPercentage) < 10) {
      limitingFactor = 'balanced';
    } else if (weightGap > 0) {
      limitingFactor = 'volumetric_weight';
    } else {
      limitingFactor = 'actual_weight';
    }

    // Fetch all available products for recommendations
    const { data: allProducts } = await supabase
      .from('products')
      .select('code, name, price_usd_per_unit, gross_weight_per_unit, netto_weight_per_unit, length_cm, width_cm, height_cm, wholesale_price_xcg_per_unit, pack_size, empty_case_weight');

    // Create AI prompt
    const systemPrompt = `You are an expert AI freight optimization specialist for fresh produce airfreight operations. Your goal is to maximize profitability and pallet utilization.

CRITICAL RULES:
1. Products are grouped by supplier on pallets - NEVER mix suppliers on one pallet
2. Each pallet can hold ~500kg of chargeable weight (max of actual or volumetric)
3. Europallet constraints: 80cm × 120cm base, max 155cm total height (including 14.4cm pallet height = 140.6cm cargo)
4. Empty pallet weight: 25kg (must be included in calculations)
5. Volumetric weight formula: (L × W × H in cm) / 6000
6. Freight is charged on chargeable weight = MAX(actual weight, volumetric weight)

OPTIMIZATION GOALS:
- When volumetric weight is limiting: Recommend adding DENSE products (high weight, low volume)
- When actual weight is limiting: Recommend adding LIGHT products (low weight, high volume)
- When balanced: Optimize for maximum profit margin
- Always calculate exact profitability impact

CONTEXT:
- Freight cost: $${freightCostPerKg}/kg
- Exchange rate: ${exchangeRate} XCG/USD
- Limiting factor: ${limitingFactor}
- Weight gap: ${weightGap.toFixed(2)}kg (${gapPercentage.toFixed(1)}%)
- Estimated pallets: ${estimatedPallets}
- Total chargeable weight: ${totalChargeableWeight.toFixed(2)}kg`;

    const userPrompt = `CURRENT ORDER ANALYSIS:

SUPPLIER BREAKDOWN:
${Array.from(supplierGroups.entries()).map(([supplierId, products]) => {
  const supplierName = products[0].supplierName;
  const supplierActual = products.reduce((sum, p) => sum + p.totalActualWeight, 0);
  const supplierVolumetric = products.reduce((sum, p) => sum + p.totalVolumetricWeight, 0);
  const supplierChargeable = Math.max(supplierActual, supplierVolumetric);
  return `
Supplier: ${supplierName}
  • Actual weight: ${supplierActual.toFixed(2)}kg
  • Volumetric weight: ${supplierVolumetric.toFixed(2)}kg
  • Chargeable: ${supplierChargeable.toFixed(2)}kg
  • Products: ${products.length}
  ${products.map(p => `
    - ${p.name}: ${p.quantity} units (${p.cases} cases)
      Actual: ${p.totalActualWeight.toFixed(2)}kg | Volumetric: ${p.totalVolumetricWeight.toFixed(2)}kg
      Dimensions per case: ${p.lengthCm}×${p.widthCm}×${p.heightCm}cm
      Wholesale: ${p.wholesalePriceXCG} XCG | Retail: ${p.retailPriceXCG} XCG
  `).join('')}`;
}).join('\n')}

AVAILABLE PRODUCTS FOR RECOMMENDATIONS:
${allProducts?.slice(0, 20).map(p => {
  const gross = p.gross_weight_per_unit || p.netto_weight_per_unit;
  const volumetric = p.length_cm && p.width_cm && p.height_cm 
    ? (p.length_cm * p.width_cm * p.height_cm) / 6000 / p.pack_size
    : 0;
  return `- ${p.name}: $${p.price_usd_per_unit}/unit, ${gross}kg/unit (actual), ${volumetric.toFixed(3)}kg/unit (volumetric)`;
}).join('\n')}

PROVIDE:
1. **Pallet Stacking Optimization**: How to optimally stack cases on each pallet
2. **Product Recommendations**: Specific products to add/remove with exact quantities
3. **Profitability Impact**: Calculate exact savings/profits for each recommendation
4. **Utilization Improvement**: How recommendations improve pallet utilization

Return ONLY valid JSON with this structure:
{
  "stackingOptimization": {
    "casesPerLayer": number,
    "layersPerPallet": number,
    "recommendedConfiguration": "description"
  },
  "recommendations": [
    {
      "action": "add" | "remove",
      "productCode": "string",
      "productName": "string",
      "quantity": number,
      "reason": "string",
      "profitImpact": number,
      "freightImpact": number,
      "netBenefit": number,
      "confidence": "high" | "medium" | "low"
    }
  ],
  "summary": {
    "estimatedPallets": number,
    "utilizationImprovement": number,
    "totalProfitImpact": number,
    "totalFreightSavings": number
  },
  "insights": ["array of key insights and warnings"]
}`;

    console.log("Calling AI for pallet optimization...");

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI quota exceeded. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const recommendation = JSON.parse(aiData.choices[0].message.content);

    console.log("AI recommendation generated");

    // Store pallet configuration if orderId provided
    if (orderId) {
      for (const [supplierId, products] of supplierGroups.entries()) {
        const supplierActual = products.reduce((sum, p) => sum + p.totalActualWeight, 0);
        const supplierVolumetric = products.reduce((sum, p) => sum + p.totalVolumetricWeight, 0);
        const supplierChargeable = Math.max(supplierActual, supplierVolumetric);
        const supplierPallets = Math.ceil(supplierChargeable / 500);

        await supabase.from('pallet_configuration_history').insert({
          order_id: orderId,
          supplier_id: supplierId,
          estimated_pallets: supplierPallets,
          estimated_utilization_pct: (supplierChargeable / (supplierPallets * 500)) * 100,
          limiting_factor: limitingFactor,
          configuration_data: {
            products: products.map(p => ({
              code: p.code,
              cases: p.cases,
              actualWeight: p.totalActualWeight,
              volumetricWeight: p.totalVolumetricWeight
            }))
          },
          ai_recommendations: recommendation
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderAnalysis: {
          totalActualWeight,
          totalVolumetricWeight,
          totalChargeableWeight: weightWithPallets,
          estimatedPallets,
          limitingFactor,
          weightGap,
          gapPercentage
        },
        supplierBreakdown: Array.from(supplierGroups.entries()).map(([id, products]) => ({
          supplierId: id,
          supplierName: products[0].supplierName,
          products: products.length,
          actualWeight: products.reduce((sum, p) => sum + p.totalActualWeight, 0),
          volumetricWeight: products.reduce((sum, p) => sum + p.totalVolumetricWeight, 0)
        })),
        aiRecommendation: recommendation
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in pallet-optimizer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const status = errorMessage.includes('Forbidden') ? 403 : 
                   errorMessage.includes('Invalid') || errorMessage.includes('Missing') ? 401 : 500;
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error
      }),
      { 
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
