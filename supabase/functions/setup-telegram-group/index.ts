import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendTelegramMessage(chatId: string, text: string, token: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

  try {
    const { customer_id, eduardo_chat_id } = await req.json();

    // Load customer
    const { data: customer } = await supabase
      .from('distribution_customers')
      .select('id, name, preferred_language, telegram_chat_id')
      .eq('id', customer_id)
      .single();

    if (!customer) {
      return new Response(JSON.stringify({ error: 'Customer not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if already has active group
    const { data: existing } = await supabase
      .from('customer_telegram_groups')
      .select('*')
      .eq('customer_id', customer_id)
      .eq('status', 'activated')
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({
        error: 'Customer already has an active Telegram group',
        group_chat_id: existing.group_chat_id,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate unique activation code
    const code = `FUIK-${customer.name.replace(/\s+/g, '').toUpperCase().slice(0, 8)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Delete any existing pending codes for this customer
    await supabase
      .from('customer_telegram_groups')
      .delete()
      .eq('customer_id', customer_id)
      .eq('status', 'pending');

    // Create new activation record
    await supabase.from('customer_telegram_groups').insert({
      customer_id,
      activation_code: code,
      status: 'pending',
    });

    // Get Eduardo's chat ID from app_settings if not provided
    let eduardoChatId = eduardo_chat_id;
    if (!eduardoChatId) {
      const { data: setting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'manager_telegram_chat_id')
        .maybeSingle();
      eduardoChatId = setting?.value;
    }

    if (!eduardoChatId) {
      return new Response(JSON.stringify({
        success: true,
        activation_code: code,
        message: 'Activation code generated. Set manager_telegram_chat_id in Settings → General to receive instructions via Telegram.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send instructions to Eduardo via Telegram
    const instructions = `🌿 <b>Telegram Group Setup — ${customer.name}</b>

Follow these steps:

1️⃣ Open Telegram and create a new group
2️⃣ Name it: <b>FUIK | ${customer.name}</b>
3️⃣ Add <b>@FuikOrdersBot</b> to the group
4️⃣ Add yourself and any team members
5️⃣ Send this exact code in the group:

<code>${code}</code>

Dre will activate automatically and send the welcome message to the group. ✅

Code expires in 24 hours.`;

    await sendTelegramMessage(eduardoChatId, instructions, telegramToken);

    return new Response(JSON.stringify({
      success: true,
      activation_code: code,
      message: 'Instructions sent to your Telegram',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('setup-telegram-group error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
