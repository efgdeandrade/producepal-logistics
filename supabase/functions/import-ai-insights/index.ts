import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Fetching import data for AI analysis...");

    // Fetch data from multiple tables in parallel
    const [cifResult, billsResult, suppliersResult, ordersResult] = await Promise.all([
      supabase
        .from("cif_calculations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("bills")
        .select("*")
        .order("bill_date", { ascending: false })
        .limit(100),
      supabase
        .from("suppliers")
        .select("*"),
      supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const cifData = cifResult.data || [];
    const billsData = billsResult.data || [];
    const suppliersData = suppliersResult.data || [];
    const ordersData = ordersResult.data || [];

    // Calculate summary metrics
    const totalCIFCalculations = cifData.length;
    const totalBillsAmount = billsData.reduce((sum, b) => sum + (b.amount || 0), 0);
    const avgExchangeRate = cifData.length > 0
      ? cifData.reduce((sum, c) => sum + (c.exchange_rate || 0), 0) / cifData.length
      : 0;
    
    // Calculate bill aging
    const now = new Date();
    const overdueBills = billsData.filter(b => {
      if (!b.due_date || b.payment_status === 'paid') return false;
      return new Date(b.due_date) < now;
    });
    const overdueAmount = overdueBills.reduce((sum, b) => sum + (b.amount || 0), 0);

    // Calculate supplier spending
    const supplierSpending: Record<string, number> = {};
    billsData.forEach(bill => {
      const vendor = bill.vendor_name || 'Unknown';
      supplierSpending[vendor] = (supplierSpending[vendor] || 0) + (bill.amount || 0);
    });
    const topSuppliers = Object.entries(supplierSpending)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Calculate freight efficiency from CIF data
    let totalFreightCost = 0;
    let totalChargeableWeight = 0;
    cifData.forEach(calc => {
      totalChargeableWeight += calc.total_chargeable_weight || 0;
      const results = calc.results as any;
      if (results?.byCost) {
        results.byCost.forEach((r: any) => {
          totalFreightCost += r.freightCost || 0;
        });
      }
    });
    const avgFreightPerKg = totalChargeableWeight > 0 ? totalFreightCost / totalChargeableWeight : 0;

    // Distribution method analysis
    const methodUsage: Record<string, number> = {};
    cifData.forEach(calc => {
      const method = calc.selected_distribution_method || 'not_selected';
      methodUsage[method] = (methodUsage[method] || 0) + 1;
    });

    // Build AI prompt
    const prompt = `You are an expert import operations analyst for a produce distribution business in Curacao. Analyze the following data and provide actionable insights.

## Data Summary

**CIF Calculations (last 100):**
- Total calculations: ${totalCIFCalculations}
- Average exchange rate: ${avgExchangeRate.toFixed(2)} XCG per USD
- Total chargeable weight: ${totalChargeableWeight.toFixed(1)} kg
- Total freight cost analyzed: $${totalFreightCost.toFixed(2)}
- Average freight per kg: $${avgFreightPerKg.toFixed(2)}/kg

**Distribution Methods Used:**
${Object.entries(methodUsage).map(([method, count]) => `- ${method}: ${count} times`).join('\n')}

**Bills & Expenses (last 100):**
- Total tracked: $${totalBillsAmount.toLocaleString()}
- Overdue bills: ${overdueBills.length} totaling $${overdueAmount.toLocaleString()}
- ${billsData.filter(b => b.payment_status === 'pending').length} bills pending payment

**Top Suppliers by Spending:**
${topSuppliers.map(([name, amount]) => `- ${name}: $${(amount as number).toLocaleString()}`).join('\n')}

**Suppliers in Database:** ${suppliersData.length}
**Recent Orders:** ${ordersData.length}

## Task
Analyze this data and provide insights in the following JSON format:
{
  "opportunities": [
    {"title": "string", "description": "string", "impact": "high|medium|low", "savings_potential": "string (optional)"}
  ],
  "warnings": [
    {"title": "string", "description": "string", "severity": "critical|warning|info"}
  ],
  "improvements": [
    {"title": "string", "description": "string", "category": "freight|supplier|process|cost"}
  ],
  "summary": "A brief 2-3 sentence executive summary of the import operations health",
  "key_metrics": {
    "freight_efficiency_score": number (0-100),
    "supplier_diversification_score": number (0-100),
    "cost_management_score": number (0-100)
  }
}

Focus on:
1. Cost optimization opportunities (freight consolidation, supplier negotiation)
2. Cash flow warnings (overdue bills, payment patterns)
3. Operational efficiency improvements
4. Supplier concentration risks
5. Exchange rate impact on landed costs`;

    console.log("Calling Lovable AI for import insights analysis...");

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
            content: "You are an expert import operations analyst. Provide data-driven, actionable insights in valid JSON format only. No markdown, no code blocks, just raw JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    console.log("AI response received, parsing...");

    // Parse AI response
    let insights;
    try {
      // Clean potential markdown code blocks
      const cleanedContent = aiContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      insights = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return a structured fallback
      insights = {
        opportunities: [
          {
            title: "Review Freight Costs",
            description: `Average freight cost is $${avgFreightPerKg.toFixed(2)}/kg. Consider consolidating shipments to reduce per-kg costs.`,
            impact: "medium",
          },
        ],
        warnings: overdueBills.length > 0 ? [
          {
            title: "Overdue Bills",
            description: `${overdueBills.length} bills totaling $${overdueAmount.toLocaleString()} are past due.`,
            severity: "warning",
          },
        ] : [],
        improvements: [
          {
            title: "Supplier Analysis",
            description: `Top supplier accounts for significant spend. Consider negotiating volume discounts.`,
            category: "supplier",
          },
        ],
        summary: `Import operations show ${totalCIFCalculations} CIF calculations with $${totalBillsAmount.toLocaleString()} in tracked expenses. ${overdueBills.length > 0 ? `Attention needed on ${overdueBills.length} overdue bills.` : 'Payment status healthy.'}`,
        key_metrics: {
          freight_efficiency_score: Math.min(100, Math.max(0, 100 - avgFreightPerKg * 10)),
          supplier_diversification_score: Math.min(100, suppliersData.length * 10),
          cost_management_score: overdueBills.length === 0 ? 90 : Math.max(50, 90 - overdueBills.length * 10),
        },
      };
    }

    console.log("Import AI insights generated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        insights,
        data_summary: {
          cif_calculations: totalCIFCalculations,
          total_bills: totalBillsAmount,
          overdue_bills: overdueBills.length,
          suppliers: suppliersData.length,
          avg_freight_per_kg: avgFreightPerKg,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in import-ai-insights:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
