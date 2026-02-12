import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const importOrderId = formData.get("import_order_id") as string | null;
    const documentType = formData.get("document_type") as string || "invoice";

    if (!file) throw new Error("No file provided");

    // Upload to storage
    const filename = `${Date.now()}_${file.name}`;
    const storagePath = `cif-documents/${importOrderId || 'calculator'}/${filename}`;
    
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("import-documents")
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    // Convert file to base64 for AI extraction
    const base64 = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
    const mimeType = file.type || "application/pdf";

    // Call Lovable AI to extract structured fields
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a document extraction assistant for an import/logistics company. 
Extract structured data from the uploaded invoice or customs document. 
Return the extracted fields using the provided tool.`;

    const userPrompt = `Extract all relevant financial and logistics information from this ${documentType} document. 
Look for: vendor name, invoice number, invoice date, currency, total amount, line items with descriptions and amounts.
For freight invoices: look for weight-based charges, per-kg rates, handling fees.
For customs documents: look for declaration number, duties, taxes, broker fees.
For insurance documents: look for premium amount, coverage.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_document_fields",
              description: "Extract structured fields from an invoice or customs document",
              parameters: {
                type: "object",
                properties: {
                  vendor_name: { type: "string", description: "Name of the vendor/supplier" },
                  invoice_number: { type: "string", description: "Invoice or document number" },
                  invoice_date: { type: "string", description: "Date in YYYY-MM-DD format" },
                  currency: { type: "string", enum: ["USD", "XCG", "EUR", "ANG"], description: "Currency of amounts" },
                  total_amount: { type: "number", description: "Total invoice amount" },
                  document_type: {
                    type: "string",
                    enum: ["air_freight", "champion", "swissport", "insurance", "duties_taxes", "broker_fees", "handling_terminal", "bank_charges", "other"],
                    description: "Type of cost component this document represents"
                  },
                  weight_kg: { type: "number", description: "Total weight in kg if mentioned" },
                  rate_per_kg: { type: "number", description: "Rate per kg if applicable" },
                  declaration_no: { type: "string", description: "Customs declaration number if applicable" },
                  duties_amount: { type: "number", description: "Import duties amount if applicable" },
                  taxes_amount: { type: "number", description: "Tax amount if applicable" },
                  line_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        amount: { type: "number" },
                        quantity: { type: "number" },
                        unit_price: { type: "number" }
                      },
                      required: ["description", "amount"]
                    },
                    description: "Individual line items from the document"
                  },
                  confidence: { type: "string", enum: ["high", "medium", "low"], description: "Confidence in extraction accuracy" },
                  notes: { type: "string", description: "Any additional notes or warnings about the extraction" }
                },
                required: ["vendor_name", "total_amount", "currency", "document_type", "confidence"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_document_fields" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI extraction error:", aiResponse.status, errText);
      
      // Save document record without extraction
      const { data: docRecord } = await supabase
        .from("cif_documents")
        .insert({
          import_order_id: importOrderId || null,
          document_type: documentType,
          storage_path: storagePath,
          original_filename: file.name,
          extraction_status: "failed",
        })
        .select()
        .single();

      return new Response(JSON.stringify({
        success: true,
        document_id: docRecord?.id,
        extracted: false,
        error: "AI extraction failed, document saved for manual review"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResult = await aiResponse.json();
    let extractedFields = null;

    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        extractedFields = JSON.parse(toolCall.function.arguments);
      } catch {
        extractedFields = null;
      }
    }

    // Save document record with extraction
    const { data: docRecord, error: docError } = await supabase
      .from("cif_documents")
      .insert({
        import_order_id: importOrderId || null,
        document_type: extractedFields?.document_type || documentType,
        storage_path: storagePath,
        original_filename: file.name,
        extracted_fields_json: extractedFields,
        extraction_status: extractedFields ? "extracted" : "failed",
      })
      .select()
      .single();

    if (docError) console.error("Doc save error:", docError);

    return new Response(JSON.stringify({
      success: true,
      document_id: docRecord?.id,
      extracted: !!extractedFields,
      fields: extractedFields,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("cif-document-extract error:", e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
