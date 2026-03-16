import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) { console.error('TELEGRAM_BOT_TOKEN not set'); return false; }
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!resp.ok) { console.error('Telegram send error:', await resp.text()); return false; }
    return true;
  } catch (e) { console.error('Telegram send exception:', e); return false; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { conversation_id, message_text, agent_id } = await req.json();

    if (!conversation_id || !message_text || !agent_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Look up conversation
    const { data: convo, error: convoErr } = await supabase
      .from('dre_conversations')
      .select('id, control_status, assigned_agent_id, external_chat_id, channel')
      .eq('id', conversation_id)
      .single();

    if (convoErr || !convo) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify agent control
    if (convo.control_status !== 'human_in_control' || convo.assigned_agent_id !== agent_id) {
      return new Response(JSON.stringify({ error: 'Not authorized to reply to this conversation' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send via the appropriate channel
    let sent = false;
    if (convo.channel === 'telegram') {
      sent = await sendTelegramMessage(convo.external_chat_id, message_text);
    } else if (convo.channel === 'whatsapp') {
      // Send via WhatsApp
      const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
      const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
      if (accessToken && phoneNumberId) {
        const resp = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: convo.external_chat_id.replace(/\D/g, ''),
            type: 'text',
            text: { body: message_text },
          }),
        });
        sent = resp.ok;
      }
    }

    // Store the message
    await supabase.from('dre_messages').insert({
      conversation_id,
      role: 'agent',
      content: message_text,
      media_type: 'text',
    });

    // Update conversation timestamp
    await supabase.from('dre_conversations').update({
      updated_at: new Date().toISOString(),
    }).eq('id', conversation_id);

    return new Response(JSON.stringify({ success: true, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('send-agent-reply error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
