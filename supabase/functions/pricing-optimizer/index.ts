import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
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
const InputSchema = z.object({
  products: z.array(z.string()).optional(),
  analysisType: z.enum(['full', 'quick', 'targeted']).default('full'),
  includeMarketData: z.boolean().default(true),
});

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user has admin or management role
    await verifyUserRole(req, supabase, ['admin', 'management']);

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

    const { products, analysisType, includeMarketData } = validationResult.data;

    // Fetch all products or specific ones
    let productsQuery = supabase.from('products').select('*');
    if (products && products.length > 0) {
      productsQuery = productsQuery.in('code', products);
    }
    const { data: productsData, error: productsError } = await productsQuery;

    if (productsError) throw productsError;
    if (!productsData || productsData.length === 0) {
      throw new Error('No products found');
    }

    console.log(`Analyzing ${productsData.length} products...`);

    const recommendations = [];

    for (const product of productsData) {
      try {
        // 1. Calculate historical order patterns
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('quantity, customer_name, created_at')
          .eq('product_code', product.code)
          .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false });

        // 2. Calculate waste patterns
        const { data: deliveryItems } = await supabase
          .from('delivery_items')
          .select('planned_quantity, delivered_quantity, waste_quantity, unit_price')
          .eq('product_code', product.code)
          .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

        // 3. Get market intelligence if requested
        let marketData = null;
        if (includeMarketData) {
          const { data: marketSnapshot } = await supabase
            .from('market_price_snapshots')
            .select('*')
            .eq('product_code', product.code)
            .order('snapshot_date', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          marketData = marketSnapshot;
        }

        // Calculate metrics
        const orderCount = orderItems?.length || 0;
        const totalOrdered = orderItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
        const avgOrderQty = orderCount > 0 ? totalOrdered / orderCount : 0;

        const totalWaste = deliveryItems?.reduce((sum, item) => sum + (item.waste_quantity || 0), 0) || 0;
        const totalDelivered = deliveryItems?.reduce((sum, item) => sum + (item.delivered_quantity || item.planned_quantity || 0), 0) || 0;
        const wasteRate = totalDelivered > 0 ? (totalWaste / totalDelivered) * 100 : 0;
        const wasteCost = totalWaste * (product.price_xcg_per_unit || 0);

        // Get top customers
        const customerStats = orderItems?.reduce((acc: any, item) => {
          if (!acc[item.customer_name]) {
            acc[item.customer_name] = 0;
          }
          acc[item.customer_name] += item.quantity || 0;
          return acc;
        }, {});

        const topCustomers = Object.entries(customerStats || {})
          .sort((a: any, b: any) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, qty]) => `${name}: ${qty} units`);

        // Skip if insufficient data
        if (orderCount < 3) {
          console.log(`Skipping ${product.code} - insufficient data (${orderCount} orders)`);
          continue;
        }

        // Build AI prompt
        const prompt = `Analyze pricing strategy for this wholesale produce product in Curaçao:

PRODUCT: ${product.name} (${product.code})

CURRENT PRICING:
- Wholesale Price: Cg ${product.wholesale_price_xcg_per_unit?.toFixed(2) || 'N/A'}
- Retail Price: Cg ${product.retail_price_xcg_per_unit?.toFixed(2) || 'N/A'}
- CIF Cost: Cg ${product.price_xcg_per_unit?.toFixed(2) || 'N/A'}
- Current Margin: ${product.wholesale_price_xcg_per_unit && product.price_xcg_per_unit ? 
  (((product.wholesale_price_xcg_per_unit - product.price_xcg_per_unit) / product.wholesale_price_xcg_per_unit) * 100).toFixed(1) : 'N/A'}%

HISTORICAL DATA (Past 90 days):
- Total Orders: ${orderCount}
- Total Quantity Ordered: ${totalOrdered} units
- Average Order Quantity: ${avgOrderQty.toFixed(1)} units
- Waste Rate: ${wasteRate.toFixed(1)}%
- Waste Cost Impact: Cg ${wasteCost.toFixed(2)}

TOP CUSTOMERS:
${topCustomers.length > 0 ? topCustomers.join('\n') : 'No customer data available'}

${marketData ? `MARKET INTELLIGENCE:
- Market Average: Cg ${marketData.market_avg?.toFixed(2)}
- Market Range: Cg ${marketData.market_low?.toFixed(2)} - Cg ${marketData.market_high?.toFixed(2)}
- Position: ${marketData.market_avg && product.wholesale_price_xcg_per_unit ? 
  (product.wholesale_price_xcg_per_unit < marketData.market_avg ? 'UNDERPRICED' : 
   product.wholesale_price_xcg_per_unit > marketData.market_high ? 'OVERPRICED' : 'COMPETITIVE') : 'UNKNOWN'}
` : ''}

ANALYSIS REQUIRED:
1. Should we adjust wholesale and retail prices?
2. What is the expected weekly profit impact?
3. What are the risks?
4. Any tiered pricing suggestions for high-volume customers?

Return ONLY valid JSON (no other text):
{
  "recommendedWholesalePrice": number,
  "recommendedRetailPrice": number,
  "expectedWeeklyProfitIncrease": number,
  "marginChange": number,
  "reasoning": "string",
  "risks": "string",
  "customerTieringSuggestion": "string",
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are a pricing strategist for Caribbean wholesale produce. Provide data-driven pricing recommendations based on historical patterns, waste costs, and market positioning. Always return valid JSON only.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
          }),
        });

        if (!aiResponse.ok) {
          if (aiResponse.status === 429) {
            throw new Error('Rate limit exceeded - too many pricing analyses');
          }
          if (aiResponse.status === 402) {
            throw new Error('AI quota exceeded - please add credits');
          }
          throw new Error(`AI service error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const aiMessage = aiData.choices?.[0]?.message?.content;

        if (!aiMessage) {
          throw new Error('Empty AI response');
        }

        let analysis;
        try {
          let cleanedMessage = aiMessage.trim();
          cleanedMessage = cleanedMessage.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          analysis = JSON.parse(cleanedMessage);
        } catch (parseError) {
          console.error('Failed to parse AI response:', parseError);
          throw new Error('Invalid AI response format');
        }

        // Store recommendation in database
        const { data: savedRec, error: saveError } = await supabase
          .from('pricing_recommendations')
          .insert({
            product_code: product.code,
            product_name: product.name,
            current_wholesale_price: product.wholesale_price_xcg_per_unit || 0,
            current_retail_price: product.retail_price_xcg_per_unit || 0,
            recommended_wholesale_price: analysis.recommendedWholesalePrice,
            recommended_retail_price: analysis.recommendedRetailPrice,
            expected_profit_impact: analysis.expectedWeeklyProfitIncrease,
            expected_margin_change: analysis.marginChange,
            reasoning: analysis.reasoning,
            data_sources: {
              orderCount,
              totalOrdered,
              wasteRate: wasteRate.toFixed(1),
              hasMarketData: !!marketData
            },
            confidence_score: analysis.confidence,
            status: 'pending'
          })
          .select()
          .single();

        if (saveError) {
          console.error('Error saving recommendation:', saveError);
        } else {
          recommendations.push({
            ...savedRec,
            risks: analysis.risks,
            customerTieringSuggestion: analysis.customerTieringSuggestion
          });
        }

      } catch (productError) {
        console.error(`Error analyzing ${product.code}:`, productError);
        // Continue with next product
      }
    }

    // Sort by expected profit impact
    recommendations.sort((a, b) => (b.expected_profit_impact || 0) - (a.expected_profit_impact || 0));

    return new Response(
      JSON.stringify({
        success: true,
        recommendations,
        analyzed: productsData.length,
        message: `Generated ${recommendations.length} pricing recommendations`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Pricing optimizer error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const status = errorMessage.includes('Forbidden') ? 403 : 
                   errorMessage.includes('Invalid') || errorMessage.includes('Missing') ? 401 : 500;
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
