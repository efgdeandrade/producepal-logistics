import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callAIWithRetry(
  systemPrompt: string,
  contentToAnalyze: string,
  retries = MAX_RETRIES
): Promise<any> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`AI call attempt ${attempt + 1}/${retries + 1}`);
      
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
          temperature: 0.1, // Lower temperature for more consistent extraction
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`AI API error: ${errorText}`);
      }

      const aiData = await aiResponse.json();
      return aiData;
    } catch (error) {
      lastError = error as Error;
      console.error(`AI call attempt ${attempt + 1} failed:`, error);
      
      if (attempt < retries) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }
  
  throw lastError || new Error("AI call failed after retries");
}

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
      .update({ 
        status: "processing", 
        processing_started_at: new Date().toISOString(),
        error_message: null // Clear any previous error
      })
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

    console.log(`Email from: ${email.from_email}, Subject: ${email.subject}`);

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
    const { data: attachments } = await supabase
      .from("email_inbox_attachments")
      .select("*")
      .eq("email_id", emailId);

    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        console.log(`Processing attachment: ${attachment.file_name}`);
        
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("email-attachments")
          .download(attachment.storage_path);

        if (downloadError) {
          console.error(`Failed to download attachment: ${downloadError.message}`);
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        if (attachment.mime_type.includes("pdf") || 
            attachment.mime_type.includes("spreadsheet") ||
            attachment.mime_type.includes("excel") ||
            attachment.file_name.endsWith(".xlsx") ||
            attachment.file_name.endsWith(".xls") ||
            attachment.file_name.endsWith(".csv")) {
          
          try {
            const parseResponse = await supabase.functions.invoke("parse-purchase-order", {
              body: {
                file_base64: base64,
                file_type: attachment.mime_type,
                file_name: attachment.file_name,
              },
            });

            if (parseResponse.data) {
              attachmentContents.push(`\n--- Attachment: ${attachment.file_name} ---\n${JSON.stringify(parseResponse.data, null, 2)}`);
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

    // Enhanced AI extraction prompt with more examples and clearer instructions
    const systemPrompt = `You are an expert order extraction assistant for ProducePal, a produce distribution company in Curacao.
Your job is to accurately extract order information from customer emails and attachments.

## CRITICAL INSTRUCTIONS
1. Match products EXACTLY to the product list below - use the ID field
2. If you can't find a matching product, set product_id to null and mark confidence as "low"
3. Parse quantities carefully - "2 cases" = 2, "half case" = 0.5
4. Understand multiple languages: English, Dutch, Spanish, and Papiamento
5. Look for delivery dates in various formats (tomorrow, next Monday, 15/01, etc.)

## AVAILABLE PRODUCTS (match to these IDs):
${JSON.stringify(productList.slice(0, 100), null, 2)}

${customerMappings.length > 0 ? `## CUSTOMER-SPECIFIC PRODUCT MAPPINGS (prioritize these):
${JSON.stringify(customerMappings, null, 2)}` : ''}

## COMMON PRODUCT NAME VARIATIONS
- "Tomaat" / "Tomate" = Tomato
- "Komkommer" / "Pepino" = Cucumber  
- "Paprika" / "Pimento" = Bell Pepper
- "Sla" / "Lechuga" = Lettuce
- "Ui" / "Cebolla" = Onion
- "Wortel" / "Zanahoria" = Carrot
- "Aardappel" / "Papa" = Potato

## TODAY'S DATE: ${new Date().toISOString().split('T')[0]}

## OUTPUT FORMAT (JSON only, no markdown):
{
  "customer_name": "string or null",
  "delivery_date": "YYYY-MM-DD or null",
  "po_number": "string or null",
  "notes": "any special instructions or comments",
  "items": [
    {
      "product_id": "uuid from product list or null if no match",
      "product_name": "name as written in email",
      "matched_product_name": "matched product name or null",
      "quantity": number,
      "unit": "cs|lb|kg|ea|pc",
      "confidence": "high|medium|low"
    }
  ],
  "extraction_confidence": "high|medium|low",
  "needs_review": boolean,
  "review_reasons": ["reason1", "reason2"]
}

## CONFIDENCE LEVELS
- high: Exact match found, quantity clear
- medium: Similar match found, or quantity interpretation needed
- low: No good match, or ambiguous text

## EXAMPLES

Input: "Hi, please send 3 cases tomatoes and 2 boxes cucumber tomorrow"
Output:
{
  "customer_name": null,
  "delivery_date": "2024-01-16",
  "items": [
    {"product_id": "...", "product_name": "tomatoes", "quantity": 3, "unit": "cs", "confidence": "high"},
    {"product_id": "...", "product_name": "cucumber", "quantity": 2, "unit": "cs", "confidence": "high"}
  ],
  "extraction_confidence": "high",
  "needs_review": false,
  "review_reasons": []
}`;

    console.log("Calling AI for extraction with retry...");

    const aiData = await callAIWithRetry(systemPrompt, contentToAnalyze);
    const extractedText = aiData.choices?.[0]?.message?.content || "";

    console.log("AI response received:", extractedText.substring(0, 500));

    // Parse AI response
    let extractedData: any;
    let rawAiResponse = extractedText;
    
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
        review_reasons: ["Failed to parse AI response - please review manually"],
        extraction_confidence: "low",
      };
    }

    // Calculate totals and prepare order items
    const orderItems: any[] = [];
    let hasLowConfidenceItems = false;
    let hasMissingProducts = false;

    for (const item of extractedData.items || []) {
      if (item.confidence === "low") hasLowConfidenceItems = true;
      if (!item.product_id) {
        hasMissingProducts = true;
        continue;
      }

      const product = productList.find(p => p.id === item.product_id);
      if (!product) continue;

      // Get pricing
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

    // Determine if review is needed
    const needsReview = extractedData.needs_review || 
                        hasLowConfidenceItems || 
                        hasMissingProducts ||
                        orderItems.length === 0;

    // Update review reasons
    const reviewReasons = [...(extractedData.review_reasons || [])];
    if (hasLowConfidenceItems && !reviewReasons.includes("Low confidence matches")) {
      reviewReasons.push("Some items have low confidence matches");
    }
    if (hasMissingProducts && !reviewReasons.includes("Missing products")) {
      reviewReasons.push("Some items could not be matched to products");
    }
    if (orderItems.length === 0 && !reviewReasons.includes("No items")) {
      reviewReasons.push("No order items could be extracted");
    }

    // Store extracted data with raw AI response for debugging
    const { error: updateError } = await supabase
      .from("email_inbox")
      .update({
        status: needsReview ? "pending_review" : "pending_review",
        extracted_data: {
          ...extractedData,
          raw_ai_response: rawAiResponse,
          processing_timestamp: new Date().toISOString(),
        },
        extracted_customer_name: extractedData.customer_name,
        extracted_delivery_date: extractedData.delivery_date,
        extracted_po_number: extractedData.po_number,
        extraction_confidence: extractedData.extraction_confidence === "high" ? 0.9 :
                               extractedData.extraction_confidence === "medium" ? 0.7 : 0.4,
        extraction_notes: reviewReasons.join("; ") || null,
        processing_completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", emailId);

    if (updateError) {
      console.error("Failed to update email:", updateError);
      throw updateError;
    }

    // Create draft order if we have items and a customer
    if (orderItems.length > 0 && email.matched_customer_id) {
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

        await supabase
          .from("email_inbox")
          .update({ linked_order_id: order.id })
          .eq("id", emailId);
      }
    }

    console.log(`Email processing completed: ${emailId}, items: ${orderItems.length}, needs_review: ${needsReview}`);

    return new Response(
      JSON.stringify({
        success: true,
        emailId,
        extractedData: {
          ...extractedData,
          raw_ai_response: undefined, // Don't send back to client
        },
        itemCount: orderItems.length,
        needsReview,
        reviewReasons,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in process-email-order:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Generate helpful error message
    let userFriendlyError = errorMessage;
    if (errorMessage.includes("AI API")) {
      userFriendlyError = "AI service temporarily unavailable. Please try reprocessing in a few minutes.";
    } else if (errorMessage.includes("not found")) {
      userFriendlyError = "Email not found. It may have been deleted.";
    } else if (errorMessage.includes("parse")) {
      userFriendlyError = "Failed to understand email content. Please review and enter items manually.";
    }

    // Update email status to error with helpful message
    if (errorMessage !== "emailId is required") {
      try {
        const body = await req.clone().json();
        if (body?.emailId) {
          await supabase
            .from("email_inbox")
            .update({
              status: "error",
              error_message: userFriendlyError,
              processing_completed_at: new Date().toISOString(),
            })
            .eq("id", body.emailId);
        }
      } catch {
        // Ignore parse errors
      }
    }

    return new Response(
      JSON.stringify({ 
        error: userFriendlyError,
        technicalError: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
