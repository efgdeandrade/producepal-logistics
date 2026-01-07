import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS - production and staging domains
const allowedOrigins = [
  'https://fuik.io',
  'https://www.fuik.io',
  'https://dnxzpkbobzwjcuyfgdnh.lovable.app'
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// Default CORS headers for preflight
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Create client with user's auth token to verify identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });
    
    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Authenticated user: ${user.id}`);
    
    // Service role client for privileged operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { receiptPath, orderId } = await req.json();

    if (!receiptPath || !orderId) {
      throw new Error("Missing receiptPath or orderId");
    }

    // Verify user has permission to access this order
    // Check if user is admin/management or the assigned driver
    const { data: order, error: orderError } = await supabaseAuth
      .from("fnb_orders")
      .select("id, driver_id")
      .eq("id", orderId)
      .single();
    
    if (orderError || !order) {
      console.error("Order access error:", orderError);
      return new Response(
        JSON.stringify({ error: "Order not found or access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing receipt for order ${orderId}, path: ${receiptPath}, by user: ${user.id}`);

    // Download the original receipt image from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("delivery-receipts")
      .download(receiptPath);

    if (downloadError) {
      console.error("Error downloading receipt:", downloadError);
      throw new Error(`Failed to download receipt: ${downloadError.message}`);
    }

    // Convert to base64 for AI processing
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = fileData.type || "image/jpeg";
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

    console.log("Sending image to AI for processing...");

    // Call Lovable AI with the image for processing
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a receipt image processor. Analyze this delivery receipt image and perform these tasks:

1. CROP: Identify the receipt boundaries and describe where to crop (top, left, right, bottom margins to remove)
2. ENHANCE: The receipt should be readable - note if image needs contrast/brightness adjustments
3. EXTRACT DATA: Extract the following information if visible:
   - Total amount (number only, e.g., "125.50")
   - Is there a signature present? (true/false)
   - Date on receipt (if visible, format as YYYY-MM-DD)
   - Any visible business name
   - Receipt number or invoice number if present

Return a JSON object with this structure:
{
  "crop_suggestion": {
    "should_crop": true/false,
    "description": "brief description of what to crop"
  },
  "enhancement_needed": true/false,
  "extracted_data": {
    "total_amount": null or number,
    "has_signature": true/false,
    "date": null or "YYYY-MM-DD",
    "business_name": null or string,
    "receipt_number": null or string
  },
  "quality_score": 1-10,
  "notes": "any relevant observations"
}

IMPORTANT: Return ONLY the JSON object, no markdown formatting or explanation.`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl
                }
              }
            ]
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (aiResponse.status === 402) {
        throw new Error("AI credits exhausted. Please add credits to continue.");
      }
      throw new Error(`AI processing failed: ${errorText}`);
    }

    const aiResult = await aiResponse.json();
    console.log("AI response received");

    // Parse the AI response
    let extractedData = null;
    let processedImageUrl = null;
    
    const aiContent = aiResult.choices?.[0]?.message?.content;
    const aiImages = aiResult.choices?.[0]?.message?.images;
    
    if (aiContent) {
      try {
        // Try to parse the JSON from the response
        const cleanedContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        extractedData = JSON.parse(cleanedContent);
        console.log("Extracted data:", extractedData);
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        extractedData = { 
          raw_response: aiContent,
          parse_error: true 
        };
      }
    }

    // If AI returned an enhanced image, save it
    if (aiImages && aiImages.length > 0 && aiImages[0]?.image_url?.url) {
      const enhancedImageBase64 = aiImages[0].image_url.url;
      
      // Extract base64 data
      const base64Match = enhancedImageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (base64Match) {
        const imageType = base64Match[1];
        const imageData = base64Match[2];
        
        // Convert base64 to Uint8Array
        const binaryString = atob(imageData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Upload processed image
        const processedFileName = `processed-${orderId}-${Date.now()}.${imageType}`;
        const { error: uploadError } = await supabase.storage
          .from("delivery-receipts")
          .upload(processedFileName, bytes, {
            contentType: `image/${imageType}`
          });
        
        if (uploadError) {
          console.error("Error uploading processed image:", uploadError);
        } else {
          processedImageUrl = processedFileName;
          console.log("Processed image saved:", processedFileName);
        }
      }
    }

    // Update the order with processed data
    const updateData: any = {
      receipt_extracted_data: extractedData
    };
    
    if (processedImageUrl) {
      updateData.receipt_photo_processed_url = processedImageUrl;
    }

    const { error: updateError } = await supabase
      .from("fnb_orders")
      .update(updateData)
      .eq("id", orderId);

    if (updateError) {
      console.error("Error updating order:", updateError);
      throw new Error(`Failed to update order: ${updateError.message}`);
    }

    console.log("Order updated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        processed_image_url: processedImageUrl,
        extracted_data: extractedData
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in receipt-processor:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
