import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log('WhatsApp webhook received:', JSON.stringify(body));

    const { phone_number, message_text, message_id, message_type = 'text' } = body;

    if (!phone_number || !message_text) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
        message_id,
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
