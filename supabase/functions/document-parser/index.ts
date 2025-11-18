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

    // Validate file size (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File too large. Maximum size is 10MB');
    }

    console.log(`Processing ${documentType} document: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    const mimeType = file.type || 'application/octet-stream';
    const isPDF = mimeType === 'application/pdf';
    
    // Convert file to base64 (works for both PDFs and images)
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

    // Determine the prompt based on document type
    let systemPrompt = '';
    let toolDefinition: any = null;

    if (documentType === 'warehouse') {
      systemPrompt = `You are an expert at extracting data from warehouse receipts and shipping documents.

This is a CONSOLIDATED warehouse receipt showing MULTIPLE suppliers/growers in one document.

Extract the following for EACH supplier/grower listed:
- Supplier name (look in "Growers", "Cultivos", "Shipper", or similar column)
- Total actual weight in kilograms for that supplier (from "Weight" or "Peso" column)
- Total volumetric weight in kilograms for that supplier (calculate from dimensions: L×W×H/6000, or use provided volumetric weight)
- Number of pallets/boxes for that supplier (from "Number of Boxes", "Full Equivalent", or "Pallets" column)
- Which weight type was charged (actual or volumetric - typically whichever is HIGHER)

IMPORTANT: Look for table rows where each row represents a different supplier/grower.
Sum up totals for each unique supplier if they appear in multiple rows.
Return one entry per supplier with their aggregated data.`;

      toolDefinition = {
        type: "function",
        function: {
          name: "extract_warehouse_data",
          description: "Extract weight and pallet data for all suppliers from consolidated warehouse receipt",
          parameters: {
            type: "object",
            properties: {
              suppliers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    supplierName: { type: "string", description: "Supplier/grower name from the document" },
                    actualWeightKg: { type: "number", description: "Total actual weight in kilograms for this supplier" },
                    volumetricWeightKg: { type: "number", description: "Total volumetric weight in kilograms for this supplier" },
                    palletsUsed: { type: "number", description: "Total number of pallets/boxes for this supplier" },
                    weightTypeUsed: { type: "string", enum: ["actual", "volumetric"], description: "Which weight was charged (usually the higher one)" }
                  },
                  required: ["supplierName", "actualWeightKg", "volumetricWeightKg", "palletsUsed", "weightTypeUsed"],
                  additionalProperties: false
                }
              }
            },
            required: ["suppliers"],
            additionalProperties: false
          }
        }
      };
    } else if (documentType === 'exterior_agent' || documentType === 'local_agent') {
      const agentType = documentType === 'exterior_agent' ? 'exterior freight' : 'local freight';
      systemPrompt = `You are an expert at extracting invoice data from ${agentType} agent invoices.
Extract the TOTAL amount charged from the invoice. Look for:
- Total amount / Total invoice amount
- Final charge / Amount due
- Grand total / Invoice total
- Net amount / Balance due

IMPORTANT: Extract the FINAL TOTAL amount that needs to be paid.
Ignore line items - we need the bottom-line total.

Return the amount as a number with the currency code.`;

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
                description: "Total invoice amount to be paid" 
              },
              currency: {
                type: "string",
                description: "Currency code (e.g., USD, EUR)",
                default: "USD"
              }
            },
            required: ["totalAmount"],
            additionalProperties: false
          }
        }
      };
    }

    // Validate file type
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedTypes = [...allowedImageTypes, 'application/pdf'];

    if (!allowedTypes.includes(mimeType)) {
      console.log('Unsupported file type:', mimeType);
      throw new Error(`Unsupported file type: ${mimeType}. Please upload JPG, PNG, WEBP, or PDF files.`);
    }

    console.log('Sending to AI - type:', documentType, 'mime:', mimeType, 'size:', base64.length);

    // Build the content - PDFs use inline_data, images use image_url
    const userContent: any[] = [
      {
        type: 'text',
        text: 'Please analyze this document and extract the requested information accurately.'
      }
    ];

    if (isPDF) {
      // PDFs must use inline_data format
      userContent.push({
        type: 'inline_data',
        inline_data: {
          mime_type: 'application/pdf',
          data: base64
        }
      });
    } else {
      // Images use image_url format
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64}`
        }
      });
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
            content: userContent
          }
        ],
        tools: [toolDefinition],
        tool_choice: { type: "function", function: { name: toolDefinition.function.name } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error details:', {
        status: aiResponse.status,
        statusText: aiResponse.statusText,
        error: errorText,
        documentType,
        mimeType,
        fileSize: file.size
      });
      throw new Error(`AI processing failed: ${aiResponse.status} - ${errorText}`);
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