import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('type') as string;

    if (!file) {
      throw new Error('No file provided');
    }

    console.log(`Processing ${documentType} document: ${file.name}`);

    // Convert file to base64 for AI processing (chunked to avoid stack overflow)
    const bytes = await file.arrayBuffer();
    const uint8Array = new Uint8Array(bytes);
    
    // Convert to base64 in chunks to avoid stack overflow
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binary);
    const mimeType = file.type || 'application/pdf';

    // Determine the prompt based on document type
    let systemPrompt = '';
    let toolDefinition: any = null;

    if (documentType === 'warehouse') {
      systemPrompt = `You are an expert at extracting data from warehouse receipts and shipping documents. 
Extract the following information for each product/item:
- Product code or SKU
- Actual weight in kilograms
- Volumetric weight in kilograms (or calculate it if dimensions are provided)
- Number of pallets used
- Which weight type was charged (actual or volumetric)

Return the data as a structured list.`;

      toolDefinition = {
        type: "function",
        function: {
          name: "extract_warehouse_data",
          description: "Extract weight and pallet data from warehouse receipt",
          parameters: {
            type: "object",
            properties: {
              products: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    productCode: { type: "string", description: "Product code or SKU" },
                    actualWeightKg: { type: "number", description: "Actual weight in kilograms" },
                    volumetricWeightKg: { type: "number", description: "Volumetric weight in kilograms" },
                    palletsUsed: { type: "number", description: "Number of pallets used" },
                    weightTypeUsed: { type: "string", enum: ["actual", "volumetric"], description: "Which weight was charged" }
                  },
                  required: ["productCode", "actualWeightKg", "volumetricWeightKg", "palletsUsed", "weightTypeUsed"],
                  additionalProperties: false
                }
              }
            },
            required: ["products"],
            additionalProperties: false
          }
        }
      };
    } else if (documentType === 'exterior_agent' || documentType === 'local_agent') {
      const agentType = documentType === 'exterior_agent' ? 'exterior freight' : 'local';
      systemPrompt = `You are an expert at extracting invoice data from ${agentType} agent invoices.
Extract the total amount charged from the invoice. Look for:
- Total amount
- Final charge
- Amount due
- Invoice total

Return the amount as a number in USD.`;

      toolDefinition = {
        type: "function",
        function: {
          name: "extract_freight_amount",
          description: `Extract total freight amount from ${agentType} agent invoice`,
          parameters: {
            type: "object",
            properties: {
              totalAmount: { 
                type: "number", 
                description: "Total amount charged in USD" 
              },
              currency: {
                type: "string",
                description: "Currency code (e.g., USD, EUR)"
              }
            },
            required: ["totalAmount", "currency"],
            additionalProperties: false
          }
        }
      };
    }

    // Call Lovable AI with vision capabilities
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this document and extract the requested information.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`
                }
              }
            ]
          }
        ],
        tools: [toolDefinition],
        tool_choice: { type: "function", function: { name: toolDefinition.function.name } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI processing failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData, null, 2));

    // Extract the tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No structured data returned from AI');
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log('Extracted data:', extractedData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData,
        documentType 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in document-parser function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
