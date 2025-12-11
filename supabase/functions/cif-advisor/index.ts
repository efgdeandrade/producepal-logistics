import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const CIFResultSchema = z.object({
  productCode: z.string(),
  productName: z.string(),
  quantity: z.number(),
  totalWeight: z.number().optional(),
  costUSD: z.number(),
  freightCost: z.number(),
  cifUSD: z.number(),
  cifXCG: z.number(),
  cifPerUnit: z.number(),
  wholesalePrice: z.number(),
  retailPrice: z.number(),
  wholesaleMargin: z.number(),
  retailMargin: z.number(),
});

const InputSchema = z.object({
  cifResults: z.record(z.array(CIFResultSchema)),
  orderItems: z.array(z.any()).optional(),
  marketIntelligence: z.any().optional(),
  historicalPerformance: z.any().optional(),
});

interface CIFResult {
  productCode: string;
  productName: string;
  quantity: number;
  totalWeight?: number;
  costUSD: number;
  freightCost: number;
  cifUSD: number;
  cifXCG: number;
  cifPerUnit: number;
  wholesalePrice: number;
  retailPrice: number;
  wholesaleMargin: number;
  retailMargin: number;
}

interface CIFAnalysis {
  method: string;
  totalProfit: number;
  averageMargin: number;
  minMargin: number;
  maxMargin: number;
  marginVariance: number;
}

// Helper function to verify user role
async function verifyUserRole(req: Request, allowedRoles: string[]): Promise<{ userId: string; role: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing authorization header');
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

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

  const userRoles = roles?.map(r => r.role) || [];
  const hasRequiredRole = userRoles.some(role => allowedRoles.includes(role));

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
    // Verify user has admin or management role
    await verifyUserRole(req, ['admin', 'management']);

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

    const { cifResults, orderItems, marketIntelligence, historicalPerformance } = validationResult.data;
    
    console.log('Analyzing CIF methods with multi-dimensional intelligence...');

    // Analyze all methods (now including new ones)
    const analyses: CIFAnalysis[] = [];
    
    for (const [method, results] of Object.entries(cifResults) as [string, CIFResult[]][]) {
      const totalProfit = results.reduce((sum, r) => sum + (r.wholesaleMargin * r.quantity), 0);
      const margins = results.map(r => (r.wholesaleMargin / r.wholesalePrice) * 100);
      const averageMargin = margins.reduce((a, b) => a + b, 0) / margins.length;
      const minMargin = Math.min(...margins);
      const maxMargin = Math.max(...margins);
      const marginVariance = Math.sqrt(
        margins.reduce((sum, m) => sum + Math.pow(m - averageMargin, 2), 0) / margins.length
      );

      analyses.push({
        method: method,
        totalProfit: totalProfit,
        averageMargin: averageMargin,
        minMargin: minMargin,
        maxMargin: maxMargin,
        marginVariance: marginVariance
      });
    }

    // Find product details for all methods
    const productDetails: any = {};
    for (const [method, results] of Object.entries(cifResults) as [string, CIFResult[]][]) {
      productDetails[method] = results.map((r: CIFResult) => ({
        name: r.productName,
        marginPercent: ((r.wholesaleMargin / r.wholesalePrice) * 100).toFixed(1),
        profit: (r.wholesaleMargin * r.quantity).toFixed(2),
        cifPerUnit: r.cifPerUnit.toFixed(2),
        wholesalePrice: r.wholesalePrice.toFixed(2)
      }));
    }

    // Build comprehensive AI prompt with multi-dimensional intelligence
    const prompt = `You are Dito, FUIK's elite CIF allocation strategist for Curaçao fresh produce airfreight operations.

BUSINESS CONTEXT:
- Company: FUIK - Premium fresh produce airfreight (3x weekly from USA/NLD to Curaçao)
- Region: Curaçao (Caribbean island, 80%+ imported produce, tourism-driven economy)
- Target Margins: 44% retail, 20% wholesale (flexible based on market conditions)
- Core Strategy: Be price-competitive on wholesale to drive volume, maximize retail margins where market allows
- Volume Requirements: Must meet minimum KG for airfreight economics (bundling strategy critical)
- Competitive Edge: Use AI-driven pricing to outsmart traditional fixed-markup competitors

CURRENT ORDER - ALLOCATION METHOD ANALYSIS:
${analyses.map(a => `
${a.method}:
- Total Profit: Cg ${a.totalProfit.toFixed(2)}
- Average Margin: ${a.averageMargin.toFixed(1)}%
- Margin Range: ${a.minMargin.toFixed(1)}% - ${a.maxMargin.toFixed(1)}%
- Margin Balance (variance): ${a.marginVariance.toFixed(2)} (lower = more balanced)
`).join('\n')}

PRODUCT-LEVEL BREAKDOWN (All Methods):
${Object.entries(productDetails).map(([method, products]: [string, any]) => `
${method}:
${products.map((p: any) => `  - ${p.name}: CIF Cg ${p.cifPerUnit}/unit → Wholesale Cg ${p.wholesalePrice} (${p.marginPercent}% margin, Cg ${p.profit} total profit)`).join('\n')}
`).join('\n')}

${marketIntelligence ? `MARKET INTELLIGENCE (Real-time from Curaçao grocery stores):
${marketIntelligence.products?.map((p: any) => `
${p.productName}:
- Market Position: ${p.position || 'UNKNOWN'} ${p.competitiveGap ? `(${p.competitiveGap > 0 ? '+' : ''}${p.competitiveGap.toFixed(1)}% vs market)` : ''}
- Market Retail Found: Cg ${p.retailPriceFound?.toFixed(2) || 'N/A'} at ${p.source || 'various stores'}
- Calculated Wholesale: Cg ${p.calculatedWholesale?.toFixed(2) || 'N/A'} (retail ÷ 1.40)
- Your Wholesale Target: Varies by method (see breakdown above)
- Seasonal Factor: ${p.seasonalFactor || 'UNKNOWN'}
- Import Source: ${p.importSource || 'UNKNOWN'}
- Confidence: ${p.confidence || 'MEDIUM'}
${p.opportunity ? `- Market Opportunity: ${p.opportunity}` : ''}
`).join('\n')}` : 'Market intelligence data not provided for this analysis.'}

${historicalPerformance ? `HISTORICAL PERFORMANCE (Past 90 days):
${historicalPerformance.products?.map((p: any) => `
${p.productName}:
- Order Frequency: ${p.orderFrequency || 0} orders (${p.ordersPerWeek?.toFixed(1) || '0'} per week)
- Velocity: ${p.velocity || 'UNKNOWN'} mover
- Avg Order Size: ${p.avgOrderSize || 0} units
- Waste Rate: ${p.wasteRate?.toFixed(1) || '0'}%
- Customer Mix: ${p.wholesalePercentage || 0}% wholesale, ${p.retailPercentage || 0}% retail
`).join('\n')}` : 'Historical performance data not provided for this analysis.'}

STRATEGIC PRIORITIES (In Order of Importance):
1. **Maximize Total Profitability** - Primary goal: highest total profit in Cg
2. **Hit Margin Targets** - 44% retail, 20% wholesale (flexible if market conditions require)
3. **Market Competitiveness** - Don't lose wholesale customers to competitors with better pricing
4. **Volume Requirements** - Must ship all products (minimum KG for airfreight economics)
5. **Risk Mitigation** - Consider perishability, waste rates, customer retention
6. **Strategic Positioning** - Use premium/retail products to subsidize essential wholesale items if needed

MULTI-OBJECTIVE OPTIMIZATION FRAMEWORK:
Balance these factors (in priority order):
1. Total Profit (40% weight) - Direct revenue impact
2. Margin Target Adherence (25% weight) - Hit 20% wholesale, 44% retail where possible
3. Market Competitiveness (20% weight) - Avoid pricing out key wholesale accounts
4. Customer Satisfaction (10% weight) - Preserve relationships, volume buyers
5. Operational Risk (5% weight) - Waste, perishability, market volatility

DECISION FRAMEWORK - Answer These Questions:
1. Which method wins on pure profit? (most important)
2. Which method best maintains target margins across products?
3. Which products can afford higher freight allocation? (premium items, high retail mix)
4. Which products MUST have lower freight allocation? (price-sensitive, high wholesale volume)
5. Are there strategic trade-offs worth making? (subsidize one product to win volume on another)
6. What's the competitive risk if we price wrong? (lose wholesale accounts, inventory stuck)
7. Which method provides best margin balance vs profit maximization?

Provide your recommendation in this EXACT JSON format (no markdown, just raw JSON):
{
  "recommendedMethod": "byWeight" | "byCost" | "equally" | "hybrid" | "strategic" | "volumeOptimized" | "customerTier",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": [
    "Primary profit/competitiveness reason (one sentence)",
    "Secondary margin/customer consideration (one sentence)",
    "Risk mitigation or strategic trade-off point (one sentence)"
  ],
  "profitAnalysis": {
    "totalProfit": "Cg X.XX",
    "averageMargin": "X.X%",
    "targetMarginCompliance": "X% of products hit 20% wholesale target"
  },
  "marketCompetitiveness": {
    "productsOverpriced": 0,
    "productsUnderpriced": 0,
    "productsCompetitive": 0,
    "competitiveRisk": "LOW" | "MEDIUM" | "HIGH",
    "explanation": "Brief market position summary"
  },
  "strategicInsights": {
    "lossLeaders": ["product names that should absorb LESS freight to stay competitive"],
    "profitDrivers": ["product names that can carry MORE freight for higher margins"],
    "crossSubsidizationStrategy": "Explanation of how premium products support volume products"
  },
  "customerImpact": {
    "wholesaleCustomerRisk": "LOW" | "MEDIUM" | "HIGH",
    "explanation": "Why this method preserves/risks wholesale relationships"
  },
  "alternativeRecommendation": {
    "method": "Name of second-best method",
    "whenToUse": "Scenario when this would be better (e.g., 'Use if market prices drop')"
  },
  "profitComparison": {
    "byWeight": "Cg X.XX",
    "byCost": "Cg X.XX",
    "equally": "Cg X.XX",
    "hybrid": "Cg X.XX",
    "strategic": "Cg X.XX",
    "volumeOptimized": "Cg X.XX",
    "customerTier": "Cg X.XX"
  },
  "concerns": "Any red flags or risks with this recommendation (1-2 sentences)"
}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log('Calling Lovable AI...');

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { 
            role: "system", 
            content: "You are Dito, FUIK's elite CIF allocation strategist and financial advisor. You combine deep expertise in international trade, fresh produce logistics, and competitive pricing strategy. Always respond with valid JSON only, no markdown formatting. Your recommendations balance profit maximization with market competitiveness and customer relationships." 
          },
          { role: "user", content: prompt }
        ],
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
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;
    
    console.log('AI Response received');

    // Parse AI response (remove markdown code blocks if present)
    let cleanContent = aiContent.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/```\n?/g, '');
    }
    
    const recommendation = JSON.parse(cleanContent);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recommendation,
        analyses
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in cif-advisor:', error);
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
