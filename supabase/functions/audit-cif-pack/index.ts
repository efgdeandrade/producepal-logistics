import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { auditPack } = await req.json();
    if (!auditPack) {
      return new Response(
        JSON.stringify({ error: "Missing auditPack in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a CIF calculation auditor for FUIK IMPORT. Your job is to validate formulas and recompute totals for each allocation method.

Rules you MUST validate:
- Volumetric weight per case = (L * W * H) / 6000
- Chargeable weight = max(actual_weight, volumetric_weight)  
- FX conversion: XCG = USD * fx_rate, USD = XCG / fx_rate
- Wholesale price = landed_cost / (1 - 0.20) i.e. 20% margin
- Retail price = landed_cost / (1 - 0.44) i.e. 44% margin
- For each component, sum of allocated amounts across all products must equal the component total (within rounding tolerance)
- Per-piece cost is primary; per-case and per-kg are secondary
- Never invent missing numbers; if required fields are missing, mark as CRITICAL

You MUST return a JSON object with this exact structure:
{
  "audit_status": "PASS" or "FAIL",
  "issues": [
    {
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "where": "<method/component/product/formula>",
      "problem": "description of the issue",
      "expected": "what the correct value should be",
      "found": "what was actually found",
      "fix": "how to fix it"
    }
  ],
  "summary": "brief summary of audit findings",
  "lovable_fix_prompt": "If FAIL, a copy/paste ready prompt for Lovable to fix the calculation engine. If PASS, empty string."
}

Return ONLY the JSON object, no markdown wrapping.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Audit this CIF calculation pack. Recompute every formula and verify all totals for every method. Here is the full audit pack:\n\n${JSON.stringify(auditPack)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI audit failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Empty response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON response (handle potential markdown wrapping)
    let auditResult;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      auditResult = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({
          error: "Failed to parse AI audit response",
          raw_response: content,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(auditResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("audit-cif-pack error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
