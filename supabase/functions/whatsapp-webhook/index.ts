import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verify WhatsApp webhook signature (Meta/Facebook webhook security)
function verifyWebhookSignature(signature: string | null, body: string, appSecret: string): boolean {
  if (!signature || !appSecret) return false;
  
  try {
    const expectedSignature = 'sha256=' + createHmac('sha256', appSecret)
      .update(body)
      .digest('hex');
    
    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) return false;
    
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return result === 0;
  } catch (e) {
    console.error('Signature verification error:', e);
    return false;
  }
}

// Input validation for webhook payload
function validateWebhookPayload(body: Record<string, unknown>): { 
  valid: boolean; 
  error?: string;
  data?: { phone_number: string; message_text: string; message_id: string; message_type: string };
} {
  const { phone_number, message_text, message_id, message_type = 'text' } = body;
  
  // Validate phone number format (E.164 format: +[country code][number])
  if (!phone_number || typeof phone_number !== 'string') {
    return { valid: false, error: 'Missing phone_number' };
  }
  
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(phone_number.replace(/[\s\-()]/g, ''))) {
    return { valid: false, error: 'Invalid phone number format' };
  }
  
  // Validate message text
  if (!message_text || typeof message_text !== 'string') {
    return { valid: false, error: 'Missing message_text' };
  }
  
  // Limit message length to prevent abuse (WhatsApp max is 65536 but we limit to 4096 for orders)
  if (message_text.length > 4096) {
    return { valid: false, error: 'Message text too long (max 4096 characters)' };
  }
  
  // Validate message_id if provided
  if (message_id !== undefined && message_id !== null) {
    if (typeof message_id !== 'string' || message_id.length > 255) {
      return { valid: false, error: 'Invalid message_id format' };
    }
  }
  
  // Validate message_type
  const validTypes = ['text', 'image', 'audio', 'video', 'document', 'location', 'contact'];
  const type = typeof message_type === 'string' ? message_type : 'text';
  if (!validTypes.includes(type)) {
    return { valid: false, error: 'Invalid message_type' };
  }
  
  return { 
    valid: true, 
    data: { 
      phone_number: phone_number.replace(/[\s\-()]/g, ''),
      message_text: message_text.trim(),
      message_id: message_id ? String(message_id) : '',
      message_type: type
    }
  };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle WhatsApp webhook verification (GET request from Meta)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    
    if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
      console.log('WhatsApp webhook verification successful');
      return new Response(challenge || '', { 
        status: 200,
        headers: corsHeaders 
      });
    }
    
    console.warn('WhatsApp webhook verification failed - invalid token');
    return new Response('Forbidden', { 
      status: 403,
      headers: corsHeaders 
    });
  }

  // Only allow POST for webhook events
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get the raw body for signature verification
    const bodyText = await req.text();
    
    // Verify webhook signature from WhatsApp (Meta)
    const appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
    const signature = req.headers.get('x-hub-signature-256');
    
    // If app secret is configured, require valid signature
    if (appSecret) {
      if (!verifyWebhookSignature(signature, bodyText, appSecret)) {
        console.warn('WhatsApp webhook signature verification failed');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('WhatsApp webhook signature verified successfully');
    } else {
      // Log warning if no secret configured - this should be addressed in production
      console.warn('WHATSAPP_APP_SECRET not configured - skipping signature verification');
    }

    // Parse JSON after signature verification
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('WhatsApp webhook received:', JSON.stringify(body));

    // Validate input
    const validation = validateWebhookPayload(body);
    if (!validation.valid || !validation.data) {
      return new Response(JSON.stringify({ error: validation.error || 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { phone_number, message_text, message_id, message_type } = validation.data;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find customer by phone
    const { data: customer } = await supabase
      .from('distribution_customers')
      .select('id, name')
      .eq('whatsapp_phone', phone_number)
      .single();

    // Store message
    const { data: message, error: msgError } = await supabase
      .from('whatsapp_messages')
      .insert({
        direction: 'inbound',
        phone_number,
        message_id: message_id || null,
        message_text,
        message_type,
        customer_id: customer?.id || null,
        status: 'delivered',
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Try to parse as order
    if (message_type === 'text' && customer) {
      try {
        await supabase.functions.invoke('parse-whatsapp-order', {
          body: { message_text, customer_id: customer.id },
        });
      } catch (e) {
        console.log('Order parsing skipped:', e);
      }
    }

    return new Response(JSON.stringify({ success: true, message_id: message.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('WhatsApp webhook error:', error);
    // Return generic error message to avoid information leakage
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
