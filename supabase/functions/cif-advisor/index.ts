import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CIFResult {
  productCode: string;
  productName: string;
  quantity: number; // Total units
  totalWeight?: number; // Total weight in kg
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cifResults, orderItems } = await req.json();
    
    console.log('Analyzing CIF methods with consolidated products...');

    // Analyze all three methods
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
        method: method === 'byWeight' ? 'By Weight' : method === 'byCost' ? 'By Cost' : 'Equal',
        totalProfit: totalProfit,
        averageMargin: averageMargin,
        minMargin: minMargin,
        maxMargin: maxMargin,
        marginVariance: marginVariance
      });
    }

    // Find product details for context
    const productDetails = {
      byWeight: cifResults.byWeight.map((r: CIFResult) => ({
        name: r.productName,
        marginPercent: ((r.wholesaleMargin / r.wholesalePrice) * 100).toFixed(1),
        profit: (r.wholesaleMargin * r.quantity).toFixed(2)
      })),
      byCost: cifResults.byCost.map((r: CIFResult) => ({
        name: r.productName,
        marginPercent: ((r.wholesaleMargin / r.wholesalePrice) * 100).toFixed(1),
        profit: (r.wholesaleMargin * r.quantity).toFixed(2)
      })),
      equally: cifResults.equally.map((r: CIFResult) => ({
        name: r.productName,
        marginPercent: ((r.wholesaleMargin / r.wholesalePrice) * 100).toFixed(1),
        profit: (r.wholesaleMargin * r.quantity).toFixed(2)
      }))
    };

    // Build prompt for AI
    const prompt = `You are Dito, a financial advisor specializing in CIF (Cost, Insurance, and Freight) calculations for international trade.

Analyze this order and recommend the optimal CIF freight distribution method.

ORDER ANALYSIS:
${analyses.map(a => `
${a.method}:
- Total Profit: Cg ${a.totalProfit.toFixed(2)}
- Average Margin: ${a.averageMargin.toFixed(1)}%
- Margin Range: ${a.minMargin.toFixed(1)}% - ${a.maxMargin.toFixed(1)}%
- Margin Variance (lower is more balanced): ${a.marginVariance.toFixed(2)}
`).join('\n')}

PRODUCT BREAKDOWN:
By Weight Method:
${productDetails.byWeight.map((p: any) => `- ${p.name}: ${p.marginPercent}% margin, Cg ${p.profit} profit`).join('\n')}

By Cost Method:
${productDetails.byCost.map((p: any) => `- ${p.name}: ${p.marginPercent}% margin, Cg ${p.profit} profit`).join('\n')}

Equal Distribution Method:
${productDetails.equally.map((p: any) => `- ${p.name}: ${p.marginPercent}% margin, Cg ${p.profit} profit`).join('\n')}

EVALUATION CRITERIA:
1. Which method maximizes total profit?
2. Which method provides the most balanced margins across products (fairness)?
3. Which products are winners/losers under each method?
4. Business considerations: customer satisfaction, pricing transparency, operational simplicity

Provide your recommendation in this EXACT JSON format (no markdown, just raw JSON):
{
  "recommendedMethod": "By Weight" | "By Cost" | "Equal",
  "confidence": "High" | "Medium" | "Low",
  "reasoning": [
    "First key point in one sentence",
    "Second key point in one sentence",
    "Third key point in one sentence"
  ],
  "profitComparison": {
    "byWeight": "Cg X.XX",
    "byCost": "Cg X.XX",
    "equal": "Cg X.XX"
  },
  "concerns": "Brief statement of any concerns or caveats (1 sentence)"
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
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: "You are Dito, a CIF calculation expert and financial advisor. Always respond with valid JSON only, no markdown formatting." 
          },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;
    
    console.log('AI Response:', aiContent);

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
        analyses // Include raw data for reference
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in cif-advisor:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
