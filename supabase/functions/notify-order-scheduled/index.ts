import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DELIVERY_DAY_NAMES: Record<string, Record<string, string>> = {
  papiamentu: {
    '1': 'Dialuna', '2': 'Diamars', '3': 'Diaranson',
    '4': 'Diahuebs', '5': 'Diabierne', '6': 'Diasabra', '0': 'Diadomingo',
  },
  english: {
    '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday',
    '4': 'Thursday', '5': 'Friday', '6': 'Saturday', '0': 'Sunday',
  },
  dutch: {
    '1': 'Maandag', '2': 'Dinsdag', '3': 'Woensdag',
    '4': 'Donderdag', '5': 'Vrijdag', '6': 'Zaterdag', '0': 'Zondag',
  },
  spanish: {
    '1': 'Lunes', '2': 'Martes', '3': 'Miércoles',
    '4': 'Jueves', '5': 'Viernes', '6': 'Sábado', '0': 'Domingo',
  },
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
    const { order_id, delivery_date } = await req.json();

    const { data: order } = await supabase
      .from('distribution_orders')
      .select(`
        id, order_number, source_channel, total_xcg, items_count, notes,
        distribution_customers(
          id, name, preferred_language,
          telegram_chat_id, whatsapp_phone
        ),
        distribution_order_items(
          product_name_raw, quantity, order_unit,
          distribution_products(name)
        )
      `)
      .eq('id', order_id)
      .single();

    if (!order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const customer = order.distribution_customers as any;
    if (!customer) {
      return new Response(JSON.stringify({ error: 'Customer not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizeLanguage = (lang: string): string => {
      const map: Record<string, string> = {
        'pap': 'papiamentu', 'papiamentu': 'papiamentu',
        'en': 'english', 'english': 'english',
        'nl': 'dutch', 'dutch': 'dutch',
        'es': 'spanish', 'spanish': 'spanish',
      };
      return map[lang?.toLowerCase()] || 'papiamentu';
    };
    const language = normalizeLanguage(customer.preferred_language || 'papiamentu');

    const date = new Date(delivery_date);
    const dayOfWeek = date.getDay().toString();
    const dayName = DELIVERY_DAY_NAMES[language]?.[dayOfWeek] || DELIVERY_DAY_NAMES.english[dayOfWeek];
    const dateFormatted = date.toLocaleDateString('nl-AW', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    const items = (order.distribution_order_items as any[]) || [];
    const itemList = items.length > 0
      ? items.slice(0, 8)
          .map((i: any) => {
            const name = i.product_name_raw || i.distribution_products?.name || 'item';
            return `• ${i.quantity} ${i.order_unit || ''} ${name}`.trim();
          })
          .join('\n')
      : '• (items being prepared)';

    const messages: Record<string, string> = {
      papiamentu: `✅ Bo orde #${order.order_number} ta konfirmá!\n\n${itemList}\n\n📅 Entrega: <b>${dayName}, ${dateFormatted}</b>\n\nE team di FUIK lo kontakta bo. Danki! 🌿`,
      english: `✅ Your order #${order.order_number} is confirmed!\n\n${itemList}\n\n📅 Delivery: <b>${dayName}, ${dateFormatted}</b>\n\nThe FUIK team will be in touch. Thank you! 🌿`,
      dutch: `✅ Je bestelling #${order.order_number} is bevestigd!\n\n${itemList}\n\n📅 Bezorging: <b>${dayName}, ${dateFormatted}</b>\n\nHet FUIK team neemt contact op. Bedankt! 🌿`,
      spanish: `✅ ¡Tu pedido #${order.order_number} está confirmado!\n\n${itemList}\n\n📅 Entrega: <b>${dayName}, ${dateFormatted}</b>\n\nEl equipo de FUIK se pondrá en contacto. ¡Gracias! 🌿`,
    };

    const message = messages[language] || messages.english;
    let notified = false;

    if (customer.telegram_chat_id && telegramToken) {
      await sendTelegramMessage(customer.telegram_chat_id, message, telegramToken);

      const { data: convo } = await supabase
        .from('dre_conversations')
        .select('id')
        .eq('external_chat_id', customer.telegram_chat_id)
        .eq('channel', 'telegram')
        .maybeSingle();

      if (convo) {
        await supabase.from('dre_messages').insert({
          conversation_id: convo.id,
          role: 'dre',
          content: message,
          media_type: 'text',
          language_detected: language,
        });
      }
      notified = true;
    }

    await supabase.from('distribution_orders').update({
      notes: `Scheduled for ${delivery_date} by manager. ${(order as any).notes || ''}`.trim(),
    }).eq('id', order_id);

    return new Response(JSON.stringify({
      success: true,
      notified,
      channel: customer.telegram_chat_id ? 'telegram' : 'none',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('notify-order-scheduled error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
