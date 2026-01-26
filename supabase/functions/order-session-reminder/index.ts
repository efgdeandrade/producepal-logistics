import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Multi-language reminder templates
const REMINDER_TEMPLATES = {
  en: {
    greeting: "Hi",
    reminder: "Just checking in! 📋 You were placing an order earlier:",
    summary_header: "Your order so far:",
    confirm_prompt: "Would you still like to proceed with this order?",
    confirm_instruction: "Reply **Yes** to confirm or **No** to cancel.",
    expire_warning: "This order will expire soon if we don't hear back.",
  },
  es: {
    greeting: "Hola",
    reminder: "¡Solo verificando! 📋 Estabas haciendo un pedido antes:",
    summary_header: "Tu pedido hasta ahora:",
    confirm_prompt: "¿Todavía quieres continuar con este pedido?",
    confirm_instruction: "Responde **Sí** para confirmar o **No** para cancelar.",
    expire_warning: "Este pedido expirará pronto si no recibimos respuesta.",
  },
  nl: {
    greeting: "Hallo",
    reminder: "Even checken! 📋 Je was eerder een bestelling aan het plaatsen:",
    summary_header: "Je bestelling tot nu toe:",
    confirm_prompt: "Wil je nog steeds doorgaan met deze bestelling?",
    confirm_instruction: "Antwoord **Ja** om te bevestigen of **Nee** om te annuleren.",
    expire_warning: "Deze bestelling verloopt binnenkort als we niets horen.",
  },
  pap: {
    greeting: "Bon dia",
    reminder: "Ta check! 📋 Bo tabata hasiendo un order mas trempan:",
    summary_header: "Bo order te awor:",
    confirm_prompt: "Bo ke sigui ku e order aki ainda?",
    confirm_instruction: "Kontesta **Si** pa konfirmá òf **No** pa kanselá.",
    expire_warning: "E order aki lo expirá pronto si nos no tende bèk.",
  },
};

interface OrderSession {
  id: string;
  customer_id: string | null;
  customer_phone: string;
  customer_name: string | null;
  parsed_items: Array<{ product_name: string; quantity: number; unit?: string }>;
  detected_language: string;
  reminder_count: number;
}

function formatOrderSummary(items: OrderSession['parsed_items'], lang: string): string {
  if (!items || items.length === 0) return '';
  
  return items.map((item, i) => {
    const unit = item.unit || 'pcs';
    return `${i + 1}. ${item.product_name} - ${item.quantity} ${unit}`;
  }).join('\n');
}

function buildReminderMessage(session: OrderSession): string {
  const lang = session.detected_language || 'en';
  const templates = REMINDER_TEMPLATES[lang as keyof typeof REMINDER_TEMPLATES] || REMINDER_TEMPLATES.en;
  
  const customerName = session.customer_name || '';
  const greeting = customerName ? `${templates.greeting} ${customerName}!` : `${templates.greeting}!`;
  
  const orderSummary = formatOrderSummary(session.parsed_items, lang);
  
  return `${greeting}

${templates.reminder}

${templates.summary_header}
${orderSummary}

${templates.confirm_prompt}
${templates.confirm_instruction}

⏰ ${templates.expire_warning}`;
}

async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<boolean> {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  
  if (!accessToken || !phoneNumberId) {
    console.error('WhatsApp credentials not configured');
    return false;
  }
  
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber.replace(/\D/g, ''),
          type: 'text',
          text: { body: message },
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('WhatsApp API error:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find expired sessions that need reminders (status = pending_confirmation, expires_at < now)
    const { data: expiredSessions, error: fetchError } = await supabase
      .from('distribution_order_sessions')
      .select('*')
      .eq('status', 'pending_confirmation')
      .lt('expires_at', new Date().toISOString())
      .lt('reminder_count', 2); // Max 2 reminders

    if (fetchError) {
      console.error('Error fetching expired sessions:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredSessions?.length || 0} sessions needing reminders`);

    const results = {
      processed: 0,
      reminded: 0,
      abandoned: 0,
      errors: 0,
    };

    for (const session of expiredSessions || []) {
      results.processed++;
      
      // If already sent 1 reminder, mark as abandoned
      if (session.reminder_count >= 1) {
        const { error: updateError } = await supabase
          .from('distribution_order_sessions')
          .update({ 
            status: 'abandoned',
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id);
        
        if (updateError) {
          console.error(`Error marking session ${session.id} as abandoned:`, updateError);
          results.errors++;
        } else {
          console.log(`Session ${session.id} marked as abandoned after no response`);
          results.abandoned++;
        }
        continue;
      }

      // Send reminder
      const reminderMessage = buildReminderMessage(session as OrderSession);
      const sent = await sendWhatsAppMessage(session.customer_phone, reminderMessage);
      
      if (sent) {
        // Update session: increment reminder_count, extend expires_at by 30 more minutes
        const { error: updateError } = await supabase
          .from('distribution_order_sessions')
          .update({
            reminder_count: session.reminder_count + 1,
            reminder_sent_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // +30 min
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id);
        
        if (updateError) {
          console.error(`Error updating session ${session.id}:`, updateError);
          results.errors++;
        } else {
          console.log(`Reminder sent for session ${session.id}`);
          results.reminded++;
        }
        
        // Store outbound message
        await supabase.from('whatsapp_messages').insert({
          direction: 'outbound',
          phone_number: session.customer_phone,
          message_text: reminderMessage,
          message_type: 'text',
          customer_id: session.customer_id,
          status: 'sent',
        });
      } else {
        results.errors++;
      }
    }

    console.log('Session reminder results:', results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Order session reminder error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
