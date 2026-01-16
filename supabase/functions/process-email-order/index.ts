import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { emailId } = await req.json();

    if (!emailId) {
      throw new Error("emailId is required");
    }

    console.log(`Processing email order: ${emailId}`);

    // Update status to processing
    await supabase
      .from("email_inbox")
      .update({ status: "processing", processing_started_at: new Date().toISOString() })
      .eq("id", emailId);

    // Get email details
    const { data: email, error: emailError } = await supabase
      .from("email_inbox")
      .select("*")
      .eq("id", emailId)
      .single();

    if (emailError || !email) {
      throw new Error(`Email not found: ${emailId}`);
    }

    console.log(`Email from: ${email.sender_email}, Subject: ${email.subject}`);

    // Get products for matching
    const { data: products } = await supabase
      .from("distribution_products")
      .select("id, name, sku, aliases, unit, case_size, is_sold_by_weight")
      .eq("is_active", true);

    const productList = products?.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      aliases: p.aliases || [],
      unit: p.unit,
      caseSize: p.case_size,
      isByWeight: p.is_sold_by_weight,
    })) || [];

    // Get customer mappings if we have a matched customer
    let customerMappings: any[] = [];
    if (email.matched_customer_id) {
      const { data: mappings } = await supabase
        .from("distribution_customer_product_mappings")
        .select("customer_sku, customer_product_name, product_id")
        .eq("customer_id", email.matched_customer_id);
      customerMappings = mappings || [];
    }

    // Prepare content for AI extraction
    let contentToAnalyze = `Subject: ${email.subject}\n\nBody:\n${email.body_text}`;

    // Process attachments if any
    const attachmentContents: string[] = [];
    if (email.attachments_metadata && email.attachments_metadata.length > 0) {
      for (const attachment of email.attachments_metadata) {
        console.log(`Processing attachment: ${attachment.name}`);
        
        // Download attachment from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("email-attachments")
          .download(attachment.storagePath);

        if (downloadError) {
          console.error(`Failed to download attachment: ${downloadError.message}`);
          continue;
        }

        // Convert to base64 for AI processing
        const arrayBuffer = await fileData.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        // For PDFs and spreadsheets, try to parse
        if (attachment.mimeType.includes("pdf") || 
            attachment.mimeType.includes("spreadsheet") ||
            attachment.mimeType.includes("excel") ||
            attachment.name.endsWith(".xlsx") ||
            attachment.name.endsWith(".xls") ||
            attachment.name.endsWith(".csv")) {
          
          try {
            const parseResponse = await supabase.functions.invoke("parse-purchase-order", {
              body: {
                file_base64: base64,
                file_type: attachment.mimeType,
                file_name: attachment.name,
              },
            });

            if (parseResponse.data) {
              attachmentContents.push(`\n--- Attachment: ${attachment.name} ---\n${JSON.stringify(parseResponse.data, null, 2)}`);
            }
          } catch (parseError) {
            console.error(`Failed to parse attachment: ${parseError}`);
          }
        }
      }
    }

    if (attachmentContents.length > 0) {
      contentToAnalyze += "\n\n--- ATTACHMENT CONTENTS ---" + attachmentContents.join("\n");
    }

    // AI extraction using Lovable AI
    const systemPrompt = `You are an order extraction assistant for ProducePal, a produce distribution company.
Extract order information from emails and attachments.

Available products (use these IDs for matching):
${JSON.stringify(productList.slice(0, 100), null, 2)}

${customerMappings.length > 0 ? `Customer-specific product mappings (SKU -> Product):
${JSON.stringify(customerMappings, null, 2)}` : ''}

Extract:
1. Customer name (if mentioned)
2. Delivery date (parse natural language like "tomorrow", "next Tuesday", "Jan 15")
3. PO number (if present)
4. List of items with:
   - Product ID (from the product list above, match by name/sku/alias)
   - Product name (as mentioned in the order)
   - Quantity (number)
   - Unit (cs/case/lb/kg/each/etc)
   - Confidence (high/medium/low)

Today's date: ${new Date().toISOString().split('T')[0]}

Return JSON only:
{
  "customer_name": "string or null",
  "delivery_date": "YYYY-MM-DD or null",
  "po_number": "string or null",
  "notes": "any special instructions",
  "items": [
    {
      "product_id": "uuid or null",
      "product_name": "string",
      "matched_product_name": "string or null",
      "quantity": number,
      "unit": "string",
      "confidence": "high|medium|low"
    }
  ],
  "extraction_confidence": "high|medium|low",
  "needs_review": boolean,
  "review_reasons": ["reason1", "reason2"]
}`;

    console.log("Calling AI for extraction...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contentToAnalyze },
        ],
        max_tokens: 4096,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI extraction failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices?.[0]?.message?.content || "";

    console.log("AI response:", extractedText);

    // Parse AI response
    let extractedData: any;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = extractedText.match(/```json\n?([\s\S]*?)\n?```/) || 
                        extractedText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : extractedText;
      extractedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      extractedData = {
        customer_name: null,
        delivery_date: null,
        items: [],
        needs_review: true,
        review_reasons: ["Failed to parse AI response"],
        extraction_confidence: "low",
      };
    }

    // Calculate totals and prepare order items
    const orderItems: any[] = [];
    for (const item of extractedData.items || []) {
      if (!item.product_id) continue;

      // Get product details for pricing
      const product = productList.find(p => p.id === item.product_id);
      if (!product) continue;

      // Get pricing (would need tier-based pricing in real scenario)
      const { data: pricing } = await supabase
        .from("distribution_tier_prices")
        .select("price_xcg")
        .eq("product_id", item.product_id)
        .limit(1)
        .single();

      const unitPrice = pricing?.price_xcg || 0;

      orderItems.push({
        product_id: item.product_id,
        product_name: item.matched_product_name || item.product_name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price_xcg: unitPrice,
        total_xcg: unitPrice * item.quantity,
        confidence: item.confidence,
        raw_text: item.product_name,
      });
    }

    // Store extracted data
    const { error: updateError } = await supabase
      .from("email_inbox")
      .update({
        status: extractedData.needs_review ? "pending_review" : "pending_review",
        extracted_data: extractedData,
        extracted_customer_name: extractedData.customer_name,
        extracted_delivery_date: extractedData.delivery_date,
        extracted_po_number: extractedData.po_number,
        extraction_confidence: extractedData.extraction_confidence,
        extraction_notes: extractedData.review_reasons?.join("; "),
        processing_completed_at: new Date().toISOString(),
      })
      .eq("id", emailId);

    if (updateError) {
      console.error("Failed to update email:", updateError);
      throw updateError;
    }

    // Create draft order if we have items and a customer
    if (orderItems.length > 0 && email.matched_customer_id) {
      // Generate order number
      const orderNumber = `EM-${Date.now().toString(36).toUpperCase()}`;

      const { data: order, error: orderError } = await supabase
        .from("distribution_orders")
        .insert({
          order_number: orderNumber,
          customer_id: email.matched_customer_id,
          order_date: new Date().toISOString().split("T")[0],
          delivery_date: extractedData.delivery_date,
          po_number: extractedData.po_number,
          status: "pending",
          source_email_id: emailId,
          notes: `Auto-extracted from email: ${email.subject}`,
          total_xcg: orderItems.reduce((sum, item) => sum + item.total_xcg, 0),
        })
        .select()
        .single();

      if (orderError) {
        console.error("Failed to create order:", orderError);
      } else {
        console.log(`Created draft order: ${order.id}`);

        // Insert order items
        const { error: itemsError } = await supabase
          .from("distribution_order_items")
          .insert(
            orderItems.map(item => ({
              order_id: order.id,
              product_id: item.product_id,
              quantity: item.quantity,
              order_unit: item.unit,
              unit_price_xcg: item.unit_price_xcg,
              total_xcg: item.total_xcg,
            }))
          );

        if (itemsError) {
          console.error("Failed to insert order items:", itemsError);
        }

        // Link order to email
        await supabase
          .from("email_inbox")
          .update({ linked_order_id: order.id })
          .eq("id", emailId);
      }
    }

    console.log(`Email processing completed: ${emailId}`);

    return new Response(
      JSON.stringify({
        success: true,
        emailId,
        extractedData,
        itemCount: orderItems.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in process-email-order:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update email status to error
    if (errorMessage !== "emailId is required") {
      try {
        const body = await req.clone().json();
        if (body?.emailId) {
          await supabase
            .from("email_inbox")
            .update({
              status: "error",
              processing_error: errorMessage,
            })
            .eq("id", body.emailId);
        }
      } catch {
        // Ignore parse errors
      }
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
