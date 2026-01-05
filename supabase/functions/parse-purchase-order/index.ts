import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

SPECIAL HANDLING FOR SPREADSHEETS/WEEKLY ORDER TEMPLATES:
- Some files are weekly order templates with columns for each day of the week (Monday-Friday)
- Each day column may contain quantities in natural language like "3 tros", "2 kg", "250 gram", "1 stuk"
- Parse natural language quantities: "3 tros" = 3, "2 kg" = 2, "250 gram" = 0.25, "1 kilo" = 1
- If the file has day-of-week columns, combine ALL items that have any quantity across all days
- Set quantity to the sum of quantities across all days, or just extract non-zero quantities
- The unit should be normalized: "tros" = "bunch", "stuk" = "pcs", "gram" = "gram", "kg" = "kg"

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
