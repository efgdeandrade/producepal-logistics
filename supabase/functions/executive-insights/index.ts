import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Gather business data for analysis
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch distribution orders
    const { data: weeklyOrders } = await supabase
      .from("distribution_orders")
      .select("status, total_xcg, created_at, delivered_at, customer_id")
      .gte("created_at", weekAgo);

    // Fetch Dre AI performance
    const { data: aiMatchLogs } = await supabase
      .from("distribution_ai_match_logs")
      .select("confidence, was_corrected, needs_review")
      .gte("created_at", weekAgo);

    // Fetch shortages
    const { data: shortages } = await supabase
      .from("distribution_order_items")
      .select("shortage_status, shortage_quantity")
      .eq("shortage_status", "pending");

    // Fetch customer order patterns
    const { data: customerPatterns } = await supabase
      .from("distribution_customer_schedules")
      .select("customer_id, expected_order_days, confidence_score");

    // Fetch anomalies
    const { data: anomalies } = await supabase
      .from("distribution_order_anomalies")
      .select("anomaly_type, severity, status")
      .eq("status", "pending");

    // Calculate metrics
    const totalRevenue = weeklyOrders?.reduce((sum, o) => sum + (o.total_xcg || 0), 0) || 0;
    const deliveredOrders = weeklyOrders?.filter(o => o.status === "delivered").length || 0;
    const pendingOrders = weeklyOrders?.filter(o => ["pending", "confirmed"].includes(o.status)).length || 0;
    
    const aiAccuracy = aiMatchLogs?.length 
      ? (aiMatchLogs.filter(l => !l.was_corrected && !l.needs_review).length / aiMatchLogs.length * 100).toFixed(1)
      : 0;
    
    const pendingShortages = shortages?.length || 0;
    const pendingAnomalies = anomalies?.length || 0;

    // Prepare business context for AI
    const businessContext = {
      weeklyRevenue: totalRevenue,
      deliveredOrders,
      pendingOrders,
      aiAccuracy: `${aiAccuracy}%`,
      pendingShortages,
      pendingAnomalies,
      totalCustomers: new Set(weeklyOrders?.map(o => o.customer_id)).size,
      averageOrderValue: deliveredOrders > 0 ? (totalRevenue / deliveredOrders).toFixed(2) : 0,
    };

    // Call Lovable AI for insights
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a business intelligence analyst for FUIK, a food distribution company in Curaçao. Analyze the provided metrics and generate actionable insights. Focus on:
1. Revenue opportunities - where can we make more money?
2. Loss prevention - where are we losing money or missing chances?
3. Operational improvements - what processes need attention?
4. Customer retention - which customers need attention?

Be specific with numbers and percentages. Keep insights brief and actionable. Format as JSON array of insights.`
          },
          {
            role: "user",
            content: `Analyze this week's business data and provide 4-6 insights:

${JSON.stringify(businessContext, null, 2)}

Return a JSON array with this structure:
{
  "insights": [
    {
      "type": "opportunity" | "warning" | "improvement" | "success",
      "title": "Brief title",
      "description": "Detailed insight (1-2 sentences)",
      "impact": "high" | "medium" | "low",
      "metric": "Optional related metric value"
    }
  ],
  "summary": "One sentence executive summary"
}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    // Parse AI response
    let insights;
    try {
      // Extract JSON from response (might be wrapped in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Fallback insights based on rules
      insights = generateRuleBasedInsights(businessContext);
    }

    // Add rule-based critical alerts
    const criticalAlerts = [];
    
    if (pendingShortages > 5) {
      criticalAlerts.push({
        type: "warning",
        title: "High Shortage Backlog",
        description: `${pendingShortages} pending shortages need immediate attention to prevent customer complaints.`,
        impact: "high",
        metric: `${pendingShortages} items`,
      });
    }

    if (Number(aiAccuracy) < 85) {
      criticalAlerts.push({
        type: "improvement",
        title: "AI Training Needed",
        description: `Dre's match accuracy is at ${aiAccuracy}%, below the 85% target. Review training hub for corrections.`,
        impact: "medium",
        metric: aiAccuracy,
      });
    }

    if (pendingAnomalies > 0) {
      criticalAlerts.push({
        type: "warning",
        title: "Missing Orders Detected",
        description: `${pendingAnomalies} customers have anomalies in their ordering pattern that may indicate lost sales.`,
        impact: "high",
        metric: `${pendingAnomalies} anomalies`,
      });
    }

    return new Response(
      JSON.stringify({
        insights: [...criticalAlerts, ...(insights.insights || [])],
        summary: insights.summary || "Business operations running normally.",
        metrics: businessContext,
        generatedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Executive insights error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        insights: generateRuleBasedInsights({}),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateRuleBasedInsights(metrics: Record<string, any>) {
  const insights = [];
  
  if (metrics.pendingOrders > 10) {
    insights.push({
      type: "warning",
      title: "Order Backlog Building",
      description: `${metrics.pendingOrders} orders waiting to be processed. Consider prioritizing fulfillment.`,
      impact: "medium",
    });
  }

  if (metrics.weeklyRevenue > 0) {
    insights.push({
      type: "success",
      title: "Revenue Tracking",
      description: `Weekly revenue at ƒ${metrics.weeklyRevenue?.toLocaleString() || 0}. Monitor trends for growth opportunities.`,
      impact: "low",
    });
  }

  return { insights, summary: "Rule-based analysis (AI unavailable)" };
}
