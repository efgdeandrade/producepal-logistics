import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedItem {
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number | null;
}

interface ExtractedPOData {
  customer_name: string;
  customer_code: string;
  po_number: string;
  delivery_date: string | null;
  delivery_date_raw: string | null;
  delivery_station: string | null;
  currency: string;
  items: ExtractedItem[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check - accept either user JWT or service role key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For server-to-server calls (from process-email-order), we use service role
    // We don't require user claims - just verify the auth header is present
    console.log('parse-purchase-order: Authorization header present, proceeding with parsing');

    const { file_base64, file_type, file_name } = await req.json();

    if (!file_base64) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine media type
    let mediaType = 'application/pdf';
    const isSpreadsheet = file_type === 'spreadsheet';
    
    if (isSpreadsheet) {
      mediaType = 'text/plain';
    } else if (file_type === 'html' || file_name?.endsWith('.html')) {
      mediaType = 'text/html';
    } else if (file_type === 'pdf' || file_name?.endsWith('.pdf')) {
      mediaType = 'application/pdf';
    }

    // Construct message for AI
    const systemPrompt = `You are an expert purchase order parser. Extract structured data from purchase orders.

CRITICAL INSTRUCTIONS:
1. Extract ALL line items from the purchase order
2. For each item, extract: SKU/item code, description, quantity, unit of measure, and unit price
3. Identify the customer name and any customer/vendor code
4. Find the PO number
5. Find the requested delivery date if present
6. Identify the currency (NAf, XCG, USD, etc.)
7. Look for DELIVERY STATION/DEPARTMENT/LOCATION info - this could be:
   - "Ship To" section with department name (e.g., "Bar", "Main Kitchen", "Ballroom")
   - "Department" or "Dept" field
   - Building/wing/station identifiers
   - Location names that indicate a specific area within the customer's premises

SPECIAL HANDLING FOR WEEKLY ORDER TEMPLATES (Fuik/Osteria Rosso style):
When the content includes columns for weekdays (Monday through Friday):

1. This file has columns: Item Name | Unit | Price R | Price F | Status | Monday | Tuesday | Wednesday | Thursday | Friday

2. CRITICAL ALGORITHM - Find the RIGHTMOST day with data:
   - Check Friday column first - if ANY row has data in Friday, use FRIDAY ONLY
   - If Friday is empty, check Thursday column - if ANY row has data, use THURSDAY ONLY
   - If Thursday is empty, check Wednesday column - if ANY row has data, use WEDNESDAY ONLY
   - If Wednesday is empty, check Tuesday column - if ANY row has data, use TUESDAY ONLY
   - If Tuesday is empty, use Monday
   
   IMPORTANT: Once you identify the target day (e.g., Thursday), you must ONLY look at that single column!

3. Extract items ONLY from the identified TARGET DAY column:
   - Look at ONLY that one day's column
   - Do NOT include items from Monday, Tuesday, Wednesday if target is Thursday
   - Do NOT include items from ANY other day column
   - If an item has NO value in the target day column, do NOT include it

4. EXCLUDE items where Status column contains "HOLD"

5. Parse quantity strings carefully:
   - "3 tros" or "2 tros" → quantity: 3 or 2, unit: "bunch"
   - "2 kg" or "2 kilo" or "3 kilo" → quantity: 2 or 3, unit: "kg"
   - "250 gram" or "250gr" or "400 gram" or "100 gram" → quantity: 0.25 or 0.4 or 0.1, unit: "kg" (convert grams to kg!)
   - "1 stuk" or "2 stuks" or "4 st" or "6 stuk" → quantity: 1, 2, 4, 6, unit: "stuks"
   - "5 pack" → quantity: 5, unit: "pack"
   - "3 bos" → quantity: 3, unit: "bunch"
   - "1 tray" → quantity: 1, unit: "tray"
   - "1 hele" → quantity: 1, unit: "whole"
   - Plain numbers like "3" → quantity: 3, unit from the Unit column

6. Set detected_delivery_weekday to the TARGET DAY column that was used (e.g., "Thursday")

7. Set po_number to "Weekly-YYYY-MM-DD" using current date

8. Set customer_name to "Fuik" or "Osteria Rosso" if identifiable from filename/content

EXAMPLE: If Thursday has: Carrots 3kg, Limes 2kg, Pumpkin 1 hele
And Monday has: Banana 2 tros, Melon 1 stuk
→ You should ONLY return Carrots, Limes, Pumpkin (the 3 Thursday items)
→ Do NOT include Banana or Melon (they are Monday items)

UNIT NORMALIZATION (always apply):
- "tros" → "bunch", "bos" → "bunch"
- "stuk" → "stuks", "st" → "stuks", "pcs" → "stuks", "piece" → "stuks"
- "kilo" → "kg", "kilogram" → "kg"
- "pak" → "pack"
- "gr" → "gram"
- Convert grams to kg: divide by 1000

Be thorough and extract every single line item. Do not miss any products.`;

    const userPrompt = `Parse this purchase order and extract all data. The file is a ${file_type || 'document'}.

Extract:
- Customer name (the company placing the order)
- Customer code (like DRCUR, ZOCUR, etc.)
- PO number
- Delivery date (format as YYYY-MM-DD if found)
- Delivery station/department (e.g., "Bar", "Main Kitchen", "Ballroom" - look in Ship To section or Department field)
- Currency
- ALL line items with: SKU, description, quantity, unit, unit_price`;

    // Build content array based on file type
    let content: any[];
    if (isSpreadsheet) {
      // For spreadsheets, decode the text content
      const spreadsheetContent = decodeURIComponent(escape(atob(file_base64)));
      content = [
        { type: "text", text: userPrompt },
        { type: "text", text: `\n\nSPREADSHEET CONTENT (pipe-delimited rows):\n${spreadsheetContent}` }
      ];
    } else if (mediaType === 'text/html') {
      // For HTML, decode and send as text
      const htmlContent = atob(file_base64);
      content = [
        { type: "text", text: userPrompt },
        { type: "text", text: `\n\nHTML CONTENT:\n${htmlContent}` }
      ];
    } else {
      // For PDF, send as image/document
      content = [
        { type: "text", text: userPrompt },
        {
          type: "image_url",
          image_url: {
            url: `data:${mediaType};base64,${file_base64}`
          }
        }
      ];
    }

    const toolDefinition = {
      type: "function",
      function: {
        name: "extract_purchase_order",
        description: "Extract structured data from a purchase order document",
        parameters: {
          type: "object",
          properties: {
            customer_name: {
              type: "string",
              description: "Name of the customer/company placing the order"
            },
            customer_code: {
              type: "string",
              description: "Customer code or vendor code (e.g., DRCUR, ZOCUR)"
            },
            po_number: {
              type: "string",
              description: "Purchase order number"
            },
            delivery_date: {
              type: "string",
              description: "Requested delivery date in YYYY-MM-DD format, or null if not specified"
            },
            delivery_date_raw: {
              type: "string",
              description: "The original delivery date text EXACTLY as it appears in the document (e.g., '01/02/2026', '2 Jan 2026', '02-01-26'). Keep the original format without modification."
            },
            detected_delivery_weekday: {
              type: "string",
              description: "For weekly templates, the weekday column that was used (Monday, Tuesday, Wednesday, Thursday, Friday)"
            },
            delivery_station: {
              type: "string",
              description: "Delivery station, department, or location within the customer (e.g., Bar, Main Kitchen, Ballroom), or null if not specified"
            },
            currency: {
              type: "string",
              description: "Currency code (NAf, XCG, USD, etc.)"
            },
            items: {
              type: "array",
              description: "List of all line items in the purchase order",
              items: {
                type: "object",
                properties: {
                  sku: {
                    type: "string",
                    description: "Item code or SKU"
                  },
                  description: {
                    type: "string",
                    description: "Product description or name"
                  },
                  quantity: {
                    type: "number",
                    description: "Ordered quantity"
                  },
                  unit: {
                    type: "string",
                    description: "Unit of measure (pcs, kg, lb, case, etc.)"
                  },
                  unit_price: {
                    type: "number",
                    description: "Price per unit, or null if not shown"
                  }
                },
                required: ["sku", "description", "quantity", "unit"]
              }
            }
          },
          required: ["customer_name", "po_number", "items"]
        }
      }
    };

    console.log("Calling Lovable AI to parse PO...");

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
          { role: "user", content }
        ],
        tools: [toolDefinition],
        tool_choice: { type: "function", function: { name: "extract_purchase_order" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI usage limit reached. Please check your account.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to parse document' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    console.log("AI response received");

    // Extract tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_purchase_order') {
      console.error("No valid tool call in response");
      return new Response(
        JSON.stringify({ error: 'Failed to extract data from document' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extractedData: ExtractedPOData = JSON.parse(toolCall.function.arguments);
    console.log(`Extracted ${extractedData.items?.length || 0} items from PO ${extractedData.po_number}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error parsing purchase order:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
