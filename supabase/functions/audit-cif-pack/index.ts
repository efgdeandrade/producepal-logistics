import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a CIF calculation auditor for FUIK COMPANY B.V., IMPORT department.

Your job: validate the audit_pack JSON strictly and detect calculation/formula errors.

You must:
1) Validate formulas match formulas_used constants (FX 1.82, divisor 6000, chargeable=max(actual, volumetric), pricing formulas wholesale cost/0.80 and retail cost/0.56).
2) Verify allocations: for each cost component, sum of allocated amounts across products equals component total within tolerance.
3) Verify unit conversions: per piece, per case, per kg consistency.
4) Verify pricing math.

Rules:
- Never invent missing numbers. If required fields are missing, output FAIL with CRITICAL issues.
- Output MUST be valid JSON and MUST follow the required response schema exactly.
- If FAIL, include a minimal, surgical Lovable fix prompt that only changes what is necessary.

Return only JSON, no markdown, no extra text.

Required response schema:
{
  "audit_status": "PASS|FAIL|ERROR",
  "engine_version": "<string from input>",
  "input_hash": "<string from input>",
  "summary": "<string>",
  "issues": [
    {
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "code": "<string>",
      "where": { "cif_version_id":"", "type":"", "method":"", "component_type":"", "product_id":"", "field":"" },
      "problem": "<string>",
      "expected": "<string>",
      "found": "<string>",
      "impact": "<string>",
      "how_to_verify": "<string>",
      "fix": "<string>"
    }
  ],
  "fix_prompt": "<string>"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { audit_pack, options, context } = body;

    // Support both naming conventions
    const auditPack = audit_pack || body.auditPack;

    if (!auditPack) {
      return new Response(
        JSON.stringify({ error: "Missing audit_pack in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (!auditPack.export_meta || !auditPack.cif_versions || !auditPack.products_full_detail) {
      return new Response(
        JSON.stringify({ error: "audit_pack missing required sections: export_meta, cif_versions, products_full_detail" }),
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

    const engineVersion = context?.engine_version || auditPack.export_meta?.engine_version || "unknown";
    const inputHash = body.input_hash || "";

    const userPrompt = `Audit this CIF calculation pack strictly. Recompute every formula and verify all totals for every method.

Engine version: ${engineVersion}
Input hash: ${inputHash}
Rounding tolerance USD: ${options?.rounding_tolerance_usd || 0.02}
Rounding tolerance XCG: ${options?.rounding_tolerance_xcg || 0.05}
Max issues to report: ${options?.max_issues || 50}

Full audit pack:
${JSON.stringify(auditPack)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
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
        JSON.stringify({
          audit_status: "ERROR",
          engine_version: engineVersion,
          input_hash: inputHash,
          summary: "Empty response from AI model",
          issues: [{
            severity: "CRITICAL",
            code: "EMPTY_AI_RESPONSE",
            where: {},
            problem: "AI model returned empty content",
            expected: "Structured audit JSON",
            found: "Empty response",
            impact: "Cannot perform audit",
            how_to_verify: "Retry the audit",
            fix: "Retry the audit request",
          }],
          fix_prompt: "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON response
    let auditResult;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      auditResult = JSON.parse(cleaned);
    } catch (_parseErr) {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({
          audit_status: "ERROR",
          engine_version: engineVersion,
          input_hash: inputHash,
          summary: "AI returned invalid JSON",
          issues: [{
            severity: "CRITICAL",
            code: "INVALID_AI_RESPONSE",
            where: {},
            problem: "AI response could not be parsed as JSON",
            expected: "Valid JSON matching response schema",
            found: content.substring(0, 200),
            impact: "Cannot determine audit result",
            how_to_verify: "Check raw AI response",
            fix: "Retry the audit",
          }],
          fix_prompt: "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure required fields exist
    auditResult.engine_version = auditResult.engine_version || engineVersion;
    auditResult.input_hash = auditResult.input_hash || inputHash;
    auditResult.audit_status = auditResult.audit_status || "ERROR";
    auditResult.issues = auditResult.issues || [];
    auditResult.summary = auditResult.summary || "";
    auditResult.fix_prompt = auditResult.fix_prompt || "";

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
