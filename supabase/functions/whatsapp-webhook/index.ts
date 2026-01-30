import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Message types that should be stored in the database
const STORABLE_MESSAGE_TYPES = [
  'text', 'image', 'audio', 'video', 'document', 
  'location', 'contact', 'order', 'template', 'interactive', 'button'
];

// Message types we acknowledge but don't store (reactions, stickers, etc.)
const ACKNOWLEDGE_ONLY_TYPES = ['reaction', 'sticker', 'ephemeral', 'unsupported'];

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

// Extract message text from various message types
function extractMessageContent(msg: Record<string, unknown>): { text: string; metadata: Record<string, unknown> | null } {
  const messageType = msg.type as string || 'text';
  let text = '';
  let metadata: Record<string, unknown> | null = null;
  
  switch (messageType) {
    case 'text':
      text = (msg.text as { body?: string })?.body || '';
      break;
    case 'image':
    case 'video':
    case 'document':
    case 'audio':
      text = (msg[messageType] as { caption?: string })?.caption || `[${messageType}]`;
      metadata = { 
        media_id: (msg[messageType] as { id?: string })?.id,
        mime_type: (msg[messageType] as { mime_type?: string })?.mime_type
      };
      break;
    case 'location':
      const loc = msg.location as { latitude?: number; longitude?: number; name?: string; address?: string } | undefined;
      text = loc ? `📍 Location: ${loc.name || loc.address || `${loc.latitude}, ${loc.longitude}`}` : '[location]';
      metadata = loc ? { latitude: loc.latitude, longitude: loc.longitude, name: loc.name } : null;
      break;
    case 'contact':
      const contacts = msg.contacts as Array<{ name?: { formatted_name?: string } }> | undefined;
      text = contacts?.[0]?.name?.formatted_name ? `📇 Contact: ${contacts[0].name.formatted_name}` : '[contact]';
      break;
    case 'interactive':
    case 'button':
      const interactive = msg.interactive as { button_reply?: { title?: string }; list_reply?: { title?: string } } | undefined;
      text = interactive?.button_reply?.title || interactive?.list_reply?.title || '[button response]';
      break;
    case 'order':
      text = '[order message]';
      metadata = msg.order as Record<string, unknown> | null;
      break;
    default:
      text = `[${messageType}]`;
  }
  
  return { text, metadata };
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
    
    // SECURITY: Require app secret to be configured - reject requests if not set
    if (!appSecret) {
      console.error('WHATSAPP_APP_SECRET not configured - webhook disabled for security');
      return new Response(
        JSON.stringify({ error: 'Webhook not configured' }), 
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Always verify signature when secret is configured
    if (!verifyWebhookSignature(signature, bodyText, appSecret)) {
      console.warn('WhatsApp webhook signature verification failed');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('WhatsApp webhook signature verified successfully');

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

    // Handle Meta's webhook format - extract message from nested structure
    if (body.object === 'whatsapp_business_account' && Array.isArray(body.entry)) {
      const entry = (body.entry as Array<{ changes?: Array<{ value?: { messages?: unknown[]; statuses?: unknown; contacts?: unknown[] } }> }>)[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      
      // Handle message status updates (delivery receipts)
      if (value?.statuses) {
        console.log('Received status update:', JSON.stringify(value.statuses));
        return new Response(JSON.stringify({ success: true, type: 'status_update' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Handle incoming messages
      const messages = value?.messages as Array<Record<string, unknown>> | undefined;
      if (!messages || messages.length === 0) {
        console.log('No messages in webhook payload');
        return new Response(JSON.stringify({ success: true, type: 'no_messages' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const msg = messages[0];
      const contacts = value?.contacts as Array<{ profile?: { name?: string } }> | undefined;
      const contact = contacts?.[0];
      
      // Extract message details from Meta format
      const phone_number = msg.from as string;
      const message_id = msg.id as string;
      const message_type = (msg.type as string) || 'text';
      const customer_name = contact?.profile?.name || null;
      
      console.log(`Processing ${message_type} message from ${phone_number}`);
      
      // Check if this is an acknowledge-only type (reactions, stickers)
      if (ACKNOWLEDGE_ONLY_TYPES.includes(message_type)) {
        console.log(`Acknowledging ${message_type} message without storing`);
        return new Response(JSON.stringify({ success: true, type: 'acknowledged', message_type }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Extract message content based on type
      const { text: message_text, metadata } = extractMessageContent(msg);
      
      console.log(`Message content: "${message_text.substring(0, 100)}..." (type: ${message_type})`);
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Find customer by phone (if exists)
      const { data: customer } = await supabase
        .from('distribution_customers')
        .select('id, name, preferred_language')
        .eq('whatsapp_phone', phone_number)
        .single();

      // Prepare message data - use null for message_type if not in storable list
      const messageData = {
        direction: 'inbound' as const,
        phone_number,
        message_id,
        message_text,
        message_type: STORABLE_MESSAGE_TYPES.includes(message_type) ? message_type : 'text',
        customer_id: customer?.id || null,
        status: 'delivered',
        metadata: metadata || null
      };

      // Store message
      const { data: message, error: msgError } = await supabase
        .from('whatsapp_messages')
        .insert(messageData)
        .select()
        .single();

      if (msgError) {
        console.error('Error storing message:', msgError);
        // Don't throw - acknowledge the webhook but log the error
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Message storage failed',
          details: msgError.message 
        }), {
          status: 200, // Return 200 to prevent WhatsApp from retrying
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Message stored with ID: ${message.id}`);

      // Invoke AI agent for text messages only
      if (message_type === 'text' && message_text.trim().length > 0) {
        try {
          console.log('Invoking AI agent for customer:', customer?.id || 'new/unknown');
          const { data: agentResult, error: agentError } = await supabase.functions.invoke('whatsapp-ai-agent', {
            body: { 
              customer_id: customer?.id || null,
              customer_name: customer?.name || customer_name || null,
              customer_phone: phone_number,
              message_text,
              message_id: message.id,
              preferred_language: customer?.preferred_language || null
            },
          });
          
          if (agentError) {
            console.error('AI agent error:', agentError);
          } else {
            console.log('AI agent result:', JSON.stringify(agentResult));
          }
        } catch (e) {
          console.error('AI agent invocation failed:', e);
        }
      } else if (message_type !== 'text') {
        // For non-text messages, send a friendly response
        console.log(`Non-text message (${message_type}) - not processing with AI`);
      }

      return new Response(JSON.stringify({ success: true, message_id: message.id, message_type }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback for unrecognized format
    console.log('Unrecognized webhook format, acknowledging');
    return new Response(JSON.stringify({ success: true, type: 'unrecognized_format' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('WhatsApp webhook error:', error);
    // Return 200 to prevent WhatsApp from retrying on errors
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
