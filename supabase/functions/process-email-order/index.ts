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

// High confidence threshold for auto-creation without review
const HIGH_CONFIDENCE_THRESHOLD = 0.85;
const AUTO_CREATE_MIN_ITEMS = 1;

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
          max_tokens: 8192,
          temperature: 0.1,
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

// Compress product list for AI context - send essential info only
function compressProductsForAI(products: any[], aliases: any[]) {
  // Create a map of product_id to aliases
  const aliasMap = new Map<string, string[]>();
  for (const alias of aliases) {
    const existing = aliasMap.get(alias.product_id) || [];
    existing.push(alias.alias);
    aliasMap.set(alias.product_id, existing);
  }

  return products.map(p => {
    const productAliases = aliasMap.get(p.id) || [];
    // Include multilingual names as aliases too
    const allAliases = [
      ...productAliases,
      p.name_pap,
      p.name_nl,
      p.name_es,
    ].filter(Boolean);

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      aliases: allAliases.length > 0 ? allAliases : undefined,
      unit: p.unit,
      isWeight: p.is_weight_based,
    };
  });
}

// Fuzzy match fallback for items the AI couldn't match - ENHANCED
function fuzzyMatchProduct(searchText: string, products: any[], aliases: any[]): { productId: string | null; confidence: string; matchedName: string | null; matchReason: string } {
  const normalizedSearch = searchText.toLowerCase().trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');

  console.log(`Fuzzy matching: "${searchText}" -> normalized: "${normalizedSearch}"`);

  // Check aliases first (highest priority - trained by staff)
  for (const alias of aliases) {
    const normalizedAlias = alias.alias.toLowerCase().trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ');
    
    if (normalizedSearch === normalizedAlias || 
        normalizedSearch.includes(normalizedAlias) || 
        normalizedAlias.includes(normalizedSearch)) {
      const product = products.find(p => p.id === alias.product_id);
      console.log(`  ✓ Alias match: "${alias.alias}" -> ${product?.name}`);
      return { 
        productId: alias.product_id, 
        confidence: 'high', 
        matchedName: product?.name || null,
        matchReason: `alias_match: ${alias.alias}`
      };
    }
  }

  // Check product names (including multilingual)
  let bestMatch: { productId: string; score: number; name: string; reason: string } | null = null;
  
  for (const product of products) {
    const namesToCheck = [
      { name: product.name, source: 'name' },
      { name: product.code, source: 'code' },
      { name: product.name_pap, source: 'name_pap' },
      { name: product.name_nl, source: 'name_nl' },
      { name: product.name_es, source: 'name_es' },
    ].filter(n => n.name);

    for (const { name, source } of namesToCheck) {
      const normalizedName = name.toLowerCase().trim()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ');

      // Exact match
      if (normalizedSearch === normalizedName) {
        console.log(`  ✓ Exact ${source} match: "${name}"`);
        return { productId: product.id, confidence: 'high', matchedName: product.name, matchReason: `exact_${source}_match` };
      }

      // Contains match - check both directions
      if (normalizedSearch.includes(normalizedName) || normalizedName.includes(normalizedSearch)) {
        const score = Math.max(normalizedSearch.length, normalizedName.length) / 
                      Math.min(normalizedSearch.length, normalizedName.length);
        if (!bestMatch || score < bestMatch.score) {
          bestMatch = { productId: product.id, score, name: product.name, reason: `contains_${source}_match` };
        }
      }

      // Word overlap scoring - more lenient
      const searchWords = normalizedSearch.split(' ').filter((w: string) => w.length > 1);
      const nameWords = normalizedName.split(' ').filter((w: string) => w.length > 1);
      
      // Check for significant word matches
      for (const sw of searchWords) {
        for (const nw of nameWords) {
          // Check if words are similar (one contains the other or Levenshtein-like similarity)
          if (sw.length >= 3 && nw.length >= 3) {
            if (nw.includes(sw) || sw.includes(nw)) {
              const score = Math.abs(sw.length - nw.length) + 0.5;
              if (!bestMatch || score < bestMatch.score) {
                bestMatch = { productId: product.id, score, name: product.name, reason: `word_match: ${sw}≈${nw}` };
              }
            }
          }
        }
      }
    }
  }

  if (bestMatch && bestMatch.score < 4) {
    console.log(`  ✓ Best fuzzy match: "${bestMatch.name}" (score: ${bestMatch.score.toFixed(2)}, reason: ${bestMatch.reason})`);
    return { 
      productId: bestMatch.productId, 
      confidence: bestMatch.score < 1.5 ? 'medium' : 'low', 
      matchedName: bestMatch.name,
      matchReason: bestMatch.reason
    };
  }

  console.log(`  ✗ No match found for: "${searchText}"`);
  return { productId: null, confidence: 'low', matchedName: null, matchReason: 'no_match' };
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
        error_message: null
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

    // Get ALL products with correct column names
    const { data: products, error: productsError } = await supabase
      .from("distribution_products")
      .select("id, code, name, name_pap, name_nl, name_es, unit, is_weight_based, weight_unit, items_per_case, price_xcg")
      .eq("is_active", true);

    if (productsError) {
      console.error("Failed to fetch products:", productsError);
      throw new Error("Failed to load product catalog");
    }

    console.log(`Loaded ${products?.length || 0} products from catalog`);

    // Get ALL trained product aliases
    const { data: aliases } = await supabase
      .from("distribution_product_aliases")
      .select("id, product_id, alias, language, confidence_score");

    console.log(`Loaded ${aliases?.length || 0} trained product aliases`);

    // Get customer mappings if we have a matched customer
    let customerMappings: any[] = [];
    if (email.matched_customer_id) {
      const { data: mappings } = await supabase
        .from("distribution_customer_product_mappings")
        .select("customer_sku, customer_product_name, product_id")
        .eq("customer_id", email.matched_customer_id);
      customerMappings = mappings || [];
      console.log(`Loaded ${customerMappings.length} customer-specific mappings`);
    }

    // Compress products for AI context
    const compressedProducts = compressProductsForAI(products || [], aliases || []);

    // Prepare content for AI extraction
    let contentToAnalyze = `Subject: ${email.subject}\n\nBody:\n${email.body_text}`;

    // Process attachments if any
    const attachmentContents: string[] = [];
    const { data: attachments } = await supabase
      .from("email_inbox_attachments")
      .select("*")
      .eq("email_id", emailId);

    console.log(`Found ${attachments?.length || 0} attachments for email ${emailId}`);
    
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        console.log(`Processing attachment: ${attachment.filename} (${attachment.mime_type})`);
        
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("email-attachments")
          .download(attachment.storage_path);

        if (downloadError) {
          console.error(`Failed to download attachment ${attachment.filename}: ${downloadError.message}`);
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        console.log(`Attachment ${attachment.filename} downloaded, size: ${arrayBuffer.byteLength} bytes`);

        if (attachment.mime_type.includes("pdf") || 
            attachment.mime_type.includes("spreadsheet") ||
            attachment.mime_type.includes("excel") ||
            attachment.filename.endsWith(".xlsx") ||
            attachment.filename.endsWith(".xls") ||
            attachment.filename.endsWith(".csv")) {
          
          try {
            console.log(`Invoking parse-purchase-order for ${attachment.filename}`);
            const parseResponse = await supabase.functions.invoke("parse-purchase-order", {
              body: {
                file_base64: base64,
                file_type: attachment.mime_type,
                file_name: attachment.filename,
              },
            });

            if (parseResponse.data) {
              console.log(`Successfully parsed attachment ${attachment.filename}`);
              attachmentContents.push(`\n--- Attachment: ${attachment.filename} ---\n${JSON.stringify(parseResponse.data, null, 2)}`);
            } else if (parseResponse.error) {
              console.error(`Parse error for ${attachment.filename}:`, parseResponse.error);
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

    // Enhanced AI extraction prompt with FULL product list
    const systemPrompt = `You are an expert order extraction assistant for ProducePal/FUIK, a produce distribution company in Curacao.
Your job is to accurately extract order information from customer emails and attachments.

## CRITICAL INSTRUCTIONS
1. Match products EXACTLY to the product list below - use the "id" field for product_id
2. Use the "code" field as reference (e.g., "LETTUCE-ROM" for Lettuce Romaine)
3. If a product has aliases listed, those are KNOWN NAMES for that product
4. If you can't find a matching product, set product_id to null and include the raw text
5. Parse quantities carefully - "2 cases" = 2, "half case" = 0.5, "1/2" = 0.5
6. Understand multiple languages: English, Dutch, Spanish, and Papiamento
7. Look for delivery dates in various formats (tomorrow, next Monday, 15/01, etc.)
8. Common unit abbreviations: cs/case/caja/doos, lb/lbs, kg, ea/each/stuks/pcs

## PRODUCT MATCHING PRIORITY
1. First check if text matches any product "aliases" (trained by staff - highest accuracy)
2. Then check multilingual names in the product list
3. Use fuzzy matching for similar-sounding names

## FULL PRODUCT CATALOG (${compressedProducts.length} products):
${JSON.stringify(compressedProducts, null, 1)}

${customerMappings.length > 0 ? `## THIS CUSTOMER'S SPECIFIC PRODUCT CODES (HIGHEST PRIORITY):
When you see these codes/names, use the corresponding product_id:
${JSON.stringify(customerMappings, null, 2)}` : ''}

## COMMON NAME VARIATIONS (for fuzzy matching)
- "Tomaat" / "Tomate" / "Tomato" = Look for products with "Tomato" in name
- "Komkommer" / "Pepino" / "Cucumber" = Look for products with "Cucumber" in name
- "Paprika" / "Pimento" / "Bell Pepper" = Look for products with "Pepper" in name
- "Sla" / "Lechuga" / "Lettuce" = Look for products with "Lettuce" in name
- "Romain" / "Romaine" / "Romana" = Same product (spelling variations)
- "Ui" / "Cebolla" / "Onion" = Look for products with "Onion" in name
- "Wortel" / "Zanahoria" / "Carrot" = Look for products with "Carrot" in name
- "Aardappel" / "Papa" / "Potato" = Look for products with "Potato" in name
- "FRESH" prefix = ignore this, focus on the actual product name

## TODAY'S DATE: ${new Date().toISOString().split('T')[0]}

## OUTPUT FORMAT (JSON only, no markdown code blocks):
{
  "customer_name": "string or null",
  "delivery_date": "YYYY-MM-DD or null",
  "po_number": "string or null - look for PO#, Order#, Reference#, etc.",
  "notes": "any special instructions or comments",
  "items": [
    {
      "product_id": "uuid from product list or null if no match",
      "product_name": "exact text as written in email/PO",
      "matched_product_name": "matched product name from catalog or null",
      "matched_product_code": "product code if matched or null",
      "quantity": number,
      "unit": "cs|lb|kg|ea|pc|tros",
      "confidence": "high|medium|low",
      "match_reason": "why you matched this (alias, exact name, fuzzy match, etc.)"
    }
  ],
  "extraction_confidence": "high|medium|low",
  "needs_review": boolean,
  "review_reasons": ["reason1", "reason2"]
}

## CONFIDENCE LEVELS
- high: Exact match found via alias or product name, quantity clear
- medium: Similar match found via fuzzy matching, or quantity interpretation needed
- low: No good match, ambiguous text, or uncertain quantity

## IMPORTANT
- For EVERY item in the order, try to find a match - don't skip items
- If you can't match, still include the item with product_id=null
- Include the raw text so staff can manually match it later`;

    console.log("Calling AI for extraction with retry...");
    console.log(`Sending ${compressedProducts.length} products to AI`);

    const aiData = await callAIWithRetry(systemPrompt, contentToAnalyze);
    const extractedText = aiData.choices?.[0]?.message?.content || "";

    console.log("AI response received:", extractedText.substring(0, 500));

    // Parse AI response
    let extractedData: any;
    let rawAiResponse = extractedText;
    
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = extractedText.match(/```json\n?([\s\S]*?)\n?```/) || 
                        extractedText.match(/```\n?([\s\S]*?)\n?```/) ||
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

    // AI-based customer matching: If no customer was matched by email, try fuzzy matching by extracted name
    if (!email.matched_customer_id && extractedData.customer_name) {
      console.log(`No email-matched customer, searching by AI-extracted name: "${extractedData.customer_name}"`);
      
      const searchName = extractedData.customer_name.toLowerCase();
      const searchWords = searchName.split(/\s+/).filter((w: string) => w.length > 3);
      
      let matchedCustomer: { id: string; name: string } | null = null;
      
      // 1. Try exact match first
      const { data: exactMatch } = await supabase
        .from("distribution_customers")
        .select("id, name")
        .ilike("name", extractedData.customer_name)
        .limit(1)
        .maybeSingle();
        
      if (exactMatch) {
        matchedCustomer = exactMatch;
        console.log(`Exact name match found: "${exactMatch.name}"`);
      } else {
        // 2. Try partial matches with key words (e.g., "Dreams", "Curacao", "Resort")
        for (const word of searchWords) {
          const { data: partialMatch } = await supabase
            .from("distribution_customers")
            .select("id, name")
            .ilike("name", `%${word}%`)
            .limit(1)
            .maybeSingle();
            
          if (partialMatch) {
            matchedCustomer = partialMatch;
            console.log(`Partial name match on "${word}": "${partialMatch.name}"`);
            break;
          }
        }
      }
      
      if (matchedCustomer) {
        console.log(`AI name matched to customer: ${matchedCustomer.name} (${matchedCustomer.id})`);
        
        // Update email record with matched customer
        await supabase
          .from("email_inbox")
          .update({ matched_customer_id: matchedCustomer.id })
          .eq("id", emailId);
          
        // Use for order creation
        email.matched_customer_id = matchedCustomer.id;
        
        // Also load customer mappings for this newly matched customer
        const { data: mappings } = await supabase
          .from("distribution_customer_product_mappings")
          .select("customer_sku, customer_product_name, product_id")
          .eq("customer_id", matchedCustomer.id);
        customerMappings = mappings || [];
        console.log(`Loaded ${customerMappings.length} customer-specific mappings for matched customer`);
      } else {
        console.log(`Could not match customer by AI name: "${extractedData.customer_name}"`);
      }
    }

    // Post-process items: Apply fuzzy matching fallback for unmatched items
    console.log(`AI extracted ${extractedData.items?.length || 0} items`);
    
    for (const item of extractedData.items || []) {
      if (!item.product_id && item.product_name) {
        console.log(`Attempting fuzzy match for unmatched item: "${item.product_name}"`);
        const fuzzyResult = fuzzyMatchProduct(item.product_name, products || [], aliases || []);
        if (fuzzyResult.productId) {
          console.log(`Fuzzy matched "${item.product_name}" to "${fuzzyResult.matchedName}" with ${fuzzyResult.confidence} confidence (${fuzzyResult.matchReason})`);
          item.product_id = fuzzyResult.productId;
          item.matched_product_name = fuzzyResult.matchedName;
          item.confidence = fuzzyResult.confidence;
          item.match_reason = fuzzyResult.matchReason;
        }
      } else if (item.product_id) {
        console.log(`AI matched: "${item.product_name}" -> ${item.matched_product_name || item.product_id}`);
      }
    }

    // Calculate totals and prepare order items
    const orderItems: any[] = [];
    const unmatchedItems: any[] = [];
    let hasLowConfidenceItems = false;
    let hasMissingProducts = false;
    let highConfidenceCount = 0;

    for (const item of extractedData.items || []) {
      if (item.confidence === "low") hasLowConfidenceItems = true;
      if (item.confidence === "high") highConfidenceCount++;
      
      if (!item.product_id) {
        hasMissingProducts = true;
        unmatchedItems.push({
          raw_text: item.product_name,
          quantity: item.quantity,
          unit: item.unit,
        });
        continue;
      }

      const product = (products || []).find(p => p.id === item.product_id);
      if (!product) {
        console.warn(`Product ID ${item.product_id} not found in catalog`);
        continue;
      }

      // Get pricing
      const { data: pricing } = await supabase
        .from("distribution_tier_prices")
        .select("price_xcg")
        .eq("product_id", item.product_id)
        .limit(1)
        .maybeSingle();

      const unitPrice = pricing?.price_xcg || product.price_xcg || 0;

      orderItems.push({
        product_id: item.product_id,
        product_name: item.matched_product_name || product.name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price_xcg: unitPrice,
        total_xcg: unitPrice * item.quantity,
        confidence: item.confidence,
        raw_text: item.product_name,
        match_reason: item.match_reason,
      });
    }

    // Calculate overall confidence score
    const totalItems = extractedData.items?.length || 0;
    const confidenceScore = totalItems > 0 
      ? (highConfidenceCount / totalItems) * (orderItems.length / totalItems)
      : 0;

    // Determine if review is needed
    const needsReview = extractedData.needs_review || 
                        hasLowConfidenceItems || 
                        hasMissingProducts ||
                        orderItems.length === 0 ||
                        confidenceScore < HIGH_CONFIDENCE_THRESHOLD;

    // Update review reasons
    const reviewReasons = [...(extractedData.review_reasons || [])];
    if (hasLowConfidenceItems && !reviewReasons.some(r => r.includes("confidence"))) {
      reviewReasons.push("Some items have low confidence matches");
    }
    if (hasMissingProducts && !reviewReasons.some(r => r.includes("matched"))) {
      reviewReasons.push(`${unmatchedItems.length} items could not be matched to products`);
    }
    if (orderItems.length === 0 && !reviewReasons.some(r => r.includes("items"))) {
      reviewReasons.push("No order items could be extracted");
    }

    console.log(`Processing complete: ${orderItems.length} matched, ${unmatchedItems.length} unmatched, confidence: ${(confidenceScore * 100).toFixed(0)}%`);

    // Store extracted data with raw AI response for debugging
    const finalStatus = needsReview ? "pending_review" : "confirmed";
    
    const { error: updateError } = await supabase
      .from("email_inbox")
      .update({
        status: finalStatus,
        extracted_data: {
          ...extractedData,
          matched_items: orderItems,
          unmatched_items: unmatchedItems,
          raw_ai_response: rawAiResponse,
          processing_timestamp: new Date().toISOString(),
          products_sent_to_ai: compressedProducts.length,
          aliases_loaded: aliases?.length || 0,
        },
        extracted_customer_name: extractedData.customer_name,
        extracted_delivery_date: extractedData.delivery_date,
        extracted_po_number: extractedData.po_number,
        extraction_confidence: confidenceScore,
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
    let createdOrderId: string | null = null;
    
    if (orderItems.length >= AUTO_CREATE_MIN_ITEMS && email.matched_customer_id) {
      const orderNumber = `EM-${Date.now().toString(36).toUpperCase()}`;

      const { data: order, error: orderError } = await supabase
        .from("distribution_orders")
        .insert({
          order_number: orderNumber,
          customer_id: email.matched_customer_id,
          order_date: new Date().toISOString().split("T")[0],
          delivery_date: extractedData.delivery_date,
          po_number: extractedData.po_number,
          status: needsReview ? "pending" : "pending",
          source_email_id: emailId,
          notes: needsReview 
            ? `Auto-extracted from email (needs review): ${email.subject}`
            : `Auto-extracted from email: ${email.subject}`,
          total_xcg: orderItems.reduce((sum, item) => sum + item.total_xcg, 0),
        })
        .select()
        .single();

      if (orderError) {
        console.error("Failed to create order:", orderError);
      } else {
        createdOrderId = order.id;
        console.log(`Created draft order: ${order.id} (${orderNumber})`);

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

        // Log unmatched items for training
        if (unmatchedItems.length > 0) {
          for (const unmatched of unmatchedItems) {
            await supabase
              .from("distribution_ai_match_logs")
              .insert({
                raw_text: unmatched.raw_text,
                detected_quantity: unmatched.quantity,
                detected_unit: unmatched.unit,
                order_id: order.id,
                customer_id: email.matched_customer_id,
                needs_review: true,
                confidence: 'low',
                match_source: 'email_extraction',
              });
          }
          console.log(`Logged ${unmatchedItems.length} unmatched items for training`);
        }
      }
    }

    console.log(`Email processing completed: ${emailId}, items: ${orderItems.length}, needs_review: ${needsReview}`);

    return new Response(
      JSON.stringify({
        success: true,
        emailId,
        extractedData: {
          ...extractedData,
          raw_ai_response: undefined,
        },
        itemCount: orderItems.length,
        unmatchedCount: unmatchedItems.length,
        confidenceScore: Math.round(confidenceScore * 100),
        needsReview,
        reviewReasons,
        createdOrderId,
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
    } else if (errorMessage.includes("product catalog")) {
      userFriendlyError = "Failed to load product catalog. Please try again.";
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
