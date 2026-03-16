import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mahaai Distribution Center coordinates
const DC_LATITUDE = 12.126232;
const DC_LONGITUDE = -68.897127;
const CLOSE_PROXIMITY_METERS = 2000; // 2km radius for extended same-day cutoff

// Fallback message templates (used if WhatsApp templates not approved yet)
const FALLBACK_TEMPLATES = {
  same_day_early: {
    pap: "Bon mainta {customer}! Dre aki 👋 Order promé ku 7am pa entrega awe! Bo ta kla pa ordena? 🐟🥬",
    en: "Good morning {customer}! Dre here 👋 Orders before 7am get same-day delivery! Ready to order? 🐟🥬",
    nl: "Goedemorgen {customer}! Dre hier 👋 Bestellingen voor 7 uur worden vandaag nog bezorgd! Klaar om te bestellen? 🐟🥬",
    es: "¡Buenos días {customer}! Dre aquí 👋 ¡Pedidos antes de las 7am tienen entrega hoy mismo! ¿Listo para ordenar? 🐟🥬"
  },
  next_day_planning: {
    pap: "Bon nochi {customer}! Dre aki 👋 Ta prepará entrega di mañan - ki kos bo mester? 🐟🥬",
    en: "Good evening {customer}! Dre here 👋 Planning tomorrow's deliveries - what do you need? 🐟🥬",
    nl: "Goedenavond {customer}! Dre hier 👋 Bezig met de bezorgingen van morgen - wat heb je nodig? 🐟🥬",
    es: "¡Buenas noches {customer}! Dre aquí 👋 Preparando las entregas de mañana - ¿qué necesitas? 🐟🥬"
  },
  mahaai_extended: {
    pap: "Bon dia {customer}! Dre aki 👋 Paso bo ta serka, mi por entrega ainda awe! Ki kos bo ke? 🐟🥬",
    en: "Good morning {customer}! Dre here 👋 Since you're close by, I can still deliver today! What do you need? 🐟🥬",
    nl: "Goedemorgen {customer}! Dre hier 👋 Omdat je dichtbij bent, kan ik vandaag nog bezorgen! Wat heb je nodig? 🐟🥬",
    es: "¡Buenos días {customer}! Dre aquí 👋 Como estás cerca, ¡todavía puedo entregar hoy! ¿Qué necesitas? 🐟🥬"
  },
  missing_order: {
    pap: "Kon ta {customer}! Dre aki 👋 Mi a nota ku bo ta hasi bo order normalmente riba {day}. Tur kos ta bon? Mi tin produkto fresku kla pa bo! 🐟🥬",
    en: "Hey {customer}! Dre here 👋 I noticed you usually order on {day}s. Everything good? I've got fresh produce ready for you! 🐟🥬",
    nl: "Hoi {customer}! Dre hier 👋 Ik merkte dat je normaal op {day} bestelt. Alles goed? Ik heb verse producten voor je klaar! 🐟🥬",
    es: "¡Hola {customer}! Dre aquí 👋 Noté que normalmente haces tu pedido los {day}. ¿Todo bien? ¡Tengo productos frescos listos para ti! 🐟🥬"
  },
  missing_item: {
    pap: "Hé {customer}! Dre aki 👋 Mi a ripará ku bo orden di awe no tin {product} aden - bo ta pidi esaki tur ora! Bo ke mi agregá {quantity} pa bo? 🐟",
    en: "Hey {customer}! Dre here 👋 I noticed your order today doesn't have {product} - you usually get this! Want me to add {quantity} for you? 🐟",
    nl: "Hoi {customer}! Dre hier 👋 Ik zag dat je bestelling vandaag geen {product} heeft - dit bestel je normaal altijd! Zal ik {quantity} voor je toevoegen? 🐟",
    es: "¡Oye {customer}! Dre aquí 👋 Vi que tu pedido de hoy no tiene {product} - ¡normalmente lo pides! ¿Quieres que agregue {quantity} para ti? 🐟"
  },
  inactive_customer: {
    pap: "Kon ta {customer}! Dre aki 👋 Ta {days} dia kaba nos no a tende di bo! Nos ta stima bo! Tur kos ta bon? 🐟🥬",
    en: "Hey {customer}! Dre here 👋 It's been {days} days - we miss you! Everything okay? 🐟🥬",
    nl: "Hoi {customer}! Dre hier 👋 Het is al {days} dagen - we missen je! Alles goed? 🐟🥬",
    es: "¡Hola {customer}! Dre aquí 👋 Han pasado {days} días - ¡te extrañamos! ¿Todo bien? 🐟🥬"
  }
};

const DAY_NAMES: Record<string, Record<number, string>> = {
  pap: { 0: 'Diadomingo', 1: 'Dialuna', 2: 'Diamars', 3: 'Diarazon', 4: 'Diahuebs', 5: 'Diabierna', 6: 'Diasabra' },
  en: { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' },
  nl: { 0: 'Zondag', 1: 'Maandag', 2: 'Dinsdag', 3: 'Woensdag', 4: 'Donderdag', 5: 'Vrijdag', 6: 'Zaterdag' },
  es: { 0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' }
};

// Map template keys to database purpose values
const TEMPLATE_PURPOSE_MAP: Record<string, string> = {
  'same_day_early': 'order_reminder',
  'next_day_planning': 'order_reminder',
  'mahaai_extended': 'order_reminder',
  'missing_order': 'order_reminder',
  'missing_item': 'order_reminder',
  'inactive_customer': 'reengagement'
};

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Get current time in Curaçao (AST, UTC-4)
function getCuracaoTime(): Date {
  const now = new Date();
  const curacaoOffset = -4 * 60; // UTC-4 in minutes
  const localOffset = now.getTimezoneOffset();
  return new Date(now.getTime() + (localOffset - curacaoOffset) * 60000);
}

// Determine which outreach window we're in
function getOutreachWindow(curacaoTime: Date): 'same_day_early' | 'mahaai_extended' | 'next_day_planning' | null {
  const hour = curacaoTime.getHours();
  const minute = curacaoTime.getMinutes();
  const time = hour * 60 + minute;
  
  // 6:00-6:45 AM - Same-day early bird
  if (time >= 360 && time <= 405) return 'same_day_early';
  
  // 8:30-9:30 AM - Mahaai extended same-day
  if (time >= 510 && time <= 570) return 'mahaai_extended';
  
  // 7:45-8:30 PM - Next-day planning
  if (time >= 1185 && time <= 1230) return 'next_day_planning';
  
  return null;
}

interface SendResult {
  success: boolean;
  usedTemplate: boolean;
  templateName?: string;
  error?: string;
}

// Send WhatsApp message - try template first, fall back to regular message if within 24-hour window
async function sendWhatsAppMessage(
  supabase: SupabaseClient,
  phoneNumber: string, 
  message: string,
  customerId: string | null,
  templateKey: string,
  preferredLanguage: string,
  variables: Record<string, string>
): Promise<SendResult> {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  
  if (!accessToken || !phoneNumberId) {
    console.error('WhatsApp credentials not configured');
    return { success: false, usedTemplate: false, error: 'WhatsApp credentials not configured' };
  }
  
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  
  // Check if we're within the 24-hour messaging window
  const { data: lastIncoming } = await supabase
    .from('whatsapp_messages')
    .select('created_at')
    .eq('phone_number', cleanPhone)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const withinWindow = lastIncoming && new Date(lastIncoming.created_at) > twentyFourHoursAgo;

  console.log(`Customer ${cleanPhone} - Within 24h window: ${withinWindow}`);

  // If outside the 24-hour window, we MUST use templates
  if (!withinWindow) {
    const purpose = TEMPLATE_PURPOSE_MAP[templateKey] || 'order_reminder';
    
    // Find approved templates
    const { data: templates } = await supabase
      .from('whatsapp_message_templates')
      .select('*')
      .eq('purpose', purpose)
      .eq('is_active', true)
      .eq('is_approved', true)
      .order('usage_count', { ascending: true });

    if (!templates || templates.length === 0) {
      console.log(`No approved templates for purpose: ${purpose}. Cannot send outside 24-hour window.`);
      return { 
        success: false, 
        usedTemplate: false, 
        error: `No approved templates available. Please create and approve templates in Meta Business Manager for: ${purpose}` 
      };
    }

    // Find template matching customer's language
    let langTemplates = templates.filter(t => t.language === preferredLanguage);
    if (langTemplates.length === 0) langTemplates = templates;

    // Pick least-used for variety
    const template = langTemplates[0];

    // Build template parameters
    const templateVariables = (template.variables || []) as Array<{name: string, position: number}>;
    const components: any[] = [];
    
    if (templateVariables.length > 0) {
      const parameters = templateVariables
        .sort((a, b) => a.position - b.position)
        .map(v => ({
          type: 'text',
          text: variables[v.name] || `{{${v.position}}}`
        }));

      components.push({
        type: 'body',
        parameters
      });
    }

    const messagePayload: any = {
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'template',
      template: {
        name: template.meta_template_name,
        language: {
          code: template.language === 'pap' ? 'en' : template.language
        }
      }
    };

    if (components.length > 0) {
      messagePayload.template.components = components;
    }

    console.log('Sending template message:', JSON.stringify(messagePayload, null, 2));

    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messagePayload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Template message failed:', result);
        
        // Log the failed attempt
        await supabase.from('whatsapp_template_sends').insert({
          template_id: template.id,
          phone_number: cleanPhone,
          customer_id: customerId,
          variables_used: variables,
          status: 'failed',
          error_message: JSON.stringify(result.error || result)
        });

        return { 
          success: false, 
          usedTemplate: true, 
          templateName: template.template_name,
          error: result.error?.message || 'Template not approved'
        };
      }

      console.log('Template message sent:', result);

      // Update template usage
      await supabase
        .from('whatsapp_message_templates')
        .update({ 
          usage_count: template.usage_count + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', template.id);

      // Log successful send
      await supabase.from('whatsapp_template_sends').insert({
        template_id: template.id,
        phone_number: cleanPhone,
        customer_id: customerId,
        variables_used: variables,
        status: 'sent',
        message_id: result.messages?.[0]?.id
      });

      return { success: true, usedTemplate: true, templateName: template.template_name };
    } catch (error) {
      console.error('Error sending template message:', error);
      return { success: false, usedTemplate: true, error: String(error) };
    }
  }

  // Within 24-hour window - send regular text message
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
          to: cleanPhone,
          type: 'text',
          text: { body: message }
        }),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('WhatsApp API error:', errorText);
      return { success: false, usedTemplate: false, error: errorText };
    }
    
    return { success: true, usedTemplate: false };
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return { success: false, usedTemplate: false, error: String(error) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const curacaoTime = getCuracaoTime();
    const outreachWindow = getOutreachWindow(curacaoTime);
    const todayDow = curacaoTime.getDay();
    const todayStr = curacaoTime.toISOString().split('T')[0];

    // Parse request body for immediate trigger mode
    const body = await req.json().catch(() => ({}));
    const isImmediateTrigger = body.trigger === 'immediate';
    const specificAnomalyIds = body.anomaly_ids as string[] | undefined;

    console.log(`Dre Proactive Outreach - Curaçao time: ${curacaoTime.toISOString()}, Window: ${outreachWindow}, Immediate: ${isImmediateTrigger}`);

    const results = {
      window: isImmediateTrigger ? 'immediate' : outreachWindow,
      anomalies_processed: 0,
      messages_sent: 0,
      errors: 0,
      details: [] as Array<{ customer_id: string; type: string; status: string; message?: string }>
    };

    // Build query for anomalies
    let anomalyQuery = supabase
      .from('distribution_order_anomalies')
      .select(`
        *,
        distribution_customers(id, name, whatsapp_phone, preferred_language, latitude, longitude, is_close_proximity, distance_to_dc_meters)
      `)
      .eq('status', 'pending')
      .in('anomaly_type', ['missing_order', 'missing_item', 'inactive_customer']);

    // For immediate triggers, target specific anomalies
    if (isImmediateTrigger && specificAnomalyIds?.length) {
      anomalyQuery = anomalyQuery.in('id', specificAnomalyIds);
    } else {
      anomalyQuery = anomalyQuery.eq('expected_date', todayStr);
    }

    const { data: pendingAnomalies, error: anomaliesError } = await anomalyQuery;

    if (anomaliesError) {
      console.error('Error fetching anomalies:', anomaliesError);
      throw anomaliesError;
    }

    console.log(`Found ${pendingAnomalies?.length || 0} pending anomalies ${isImmediateTrigger ? '(immediate trigger)' : 'for today'}`);

    // Also check customer schedules for missing orders (if no anomaly was created yet)
    const { data: schedules } = await supabase
      .from('distribution_customer_schedules')
      .select(`
        *,
        distribution_customers(id, name, whatsapp_phone, preferred_language, latitude, longitude, is_close_proximity, distance_to_dc_meters, typical_delivery_type, typical_order_hour)
      `)
      .contains('expected_order_days', [todayDow])
      .gte('confidence_score', 0.4);

    // Check which scheduled customers haven't ordered today
    const { data: todayOrders } = await supabase
      .from('distribution_orders')
      .select('customer_id')
      .eq('delivery_date', todayStr);

    const todayCustomerIds = new Set((todayOrders || []).map(o => o.customer_id));

    // Filter for customers who should have ordered but haven't
    const missingScheduleCustomers = (schedules || []).filter(s => 
      s.distribution_customers && !todayCustomerIds.has(s.customer_id)
    );

    // Process based on outreach window
    for (const anomaly of (pendingAnomalies || [])) {
      const customer = anomaly.distribution_customers as any;
      if (!customer?.whatsapp_phone) continue;

      results.anomalies_processed++;

      // Determine if customer qualifies for this window
      const isCloseProximity = customer.is_close_proximity || 
        (customer.latitude && customer.longitude && 
         calculateDistance(DC_LATITUDE, DC_LONGITUDE, customer.latitude, customer.longitude) <= CLOSE_PROXIMITY_METERS);

      let shouldSend = false;
      let outreachTiming = '';
      let templateKey = '';

      // Immediate triggers bypass window checks - send right away
      if (isImmediateTrigger) {
        shouldSend = true;
        outreachTiming = 'immediate_order_intelligence';
        templateKey = anomaly.anomaly_type;
      } else if (outreachWindow === 'same_day_early') {
        // Only send to customers who typically order for same-day
        shouldSend = true;
        outreachTiming = 'same_day_reminder';
        templateKey = anomaly.anomaly_type === 'missing_order' ? 'same_day_early' : anomaly.anomaly_type;
      } else if (outreachWindow === 'mahaai_extended' && isCloseProximity) {
        // Only send to close proximity customers
        shouldSend = true;
        outreachTiming = 'extended_mahaai';
        templateKey = 'mahaai_extended';
      } else if (outreachWindow === 'next_day_planning') {
        // Send to customers who typically order at night
        shouldSend = true;
        outreachTiming = 'next_day_planning';
        templateKey = 'next_day_planning';
      }

      // If no specific window but anomaly exists, process it anyway (for cron triggers)
      if (!outreachWindow && anomaly.anomaly_type) {
        shouldSend = true;
        outreachTiming = anomaly.anomaly_type;
        templateKey = anomaly.anomaly_type;
      }

      if (!shouldSend) continue;

      // Check if we already sent outreach to this customer today
      const { data: existingOutreach } = await supabase
        .from('dre_outreach_log')
        .select('id')
        .eq('customer_id', customer.id)
        .gte('sent_at', `${todayStr}T00:00:00`)
        .limit(1);

      if (existingOutreach && existingOutreach.length > 0) {
        results.details.push({ 
          customer_id: customer.id, 
          type: anomaly.anomaly_type, 
          status: 'skipped_already_sent' 
        });
        continue;
      }

      // Build personalized message
      const language = customer.preferred_language || 'pap';
      const fallbackTemplates = FALLBACK_TEMPLATES[templateKey as keyof typeof FALLBACK_TEMPLATES] || FALLBACK_TEMPLATES.missing_order;
      let message = fallbackTemplates[language as keyof typeof fallbackTemplates] || fallbackTemplates.en;

      // Build template variables for API templates
      const templateVariables: Record<string, string> = {
        customer_name: customer.name || 'Customer'
      };

      // Replace placeholders in fallback message
      message = message.replace('{customer}', customer.name || 'Customer');
      
      if (anomaly.anomaly_type === 'missing_order') {
        const dayName = DAY_NAMES[language]?.[todayDow] || DAY_NAMES.en[todayDow];
        message = message.replace('{day}', dayName);
        templateVariables.day = dayName;
      } else if (anomaly.anomaly_type === 'missing_item') {
        const details = anomaly.details as any;
        const product = details?.product_name || 'product';
        const quantity = details?.usual_quantity?.toString() || '1';
        message = message.replace('{product}', product);
        message = message.replace('{quantity}', quantity);
        templateVariables.product = product;
        templateVariables.quantity = quantity;
      } else if (anomaly.anomaly_type === 'inactive_customer') {
        const details = anomaly.details as any;
        const days = details?.days_since_last_order?.toString() || '14';
        message = message.replace('{days}', days);
        templateVariables.days = days;
      }

      // Send WhatsApp message (will use template if outside 24h window)
      const sendResult = await sendWhatsAppMessage(
        supabase,
        customer.whatsapp_phone, 
        message,
        customer.id,
        templateKey,
        language,
        templateVariables
      );

      if (sendResult.success) {
        results.messages_sent++;
        
        // Log the outreach
        const { data: outreachLog, error: logError } = await supabase
          .from('dre_outreach_log')
          .insert({
            customer_id: customer.id,
            anomaly_id: anomaly.id,
            outreach_type: anomaly.anomaly_type,
            outreach_timing: outreachTiming,
            message_sent: message,
            language: language,
            status: 'sent'
          })
          .select()
          .single();

        if (logError) {
          console.error('Error logging outreach:', logError);
        }

        // Update anomaly status
        await supabase
          .from('distribution_order_anomalies')
          .update({ 
            status: 'outreach_sent',
            resolution_notes: `Dre sent proactive outreach at ${curacaoTime.toISOString()}`
          })
          .eq('id', anomaly.id);

        // Also log as WhatsApp message
        await supabase.from('whatsapp_messages').insert({
          direction: 'outbound',
          phone_number: customer.whatsapp_phone,
          message_text: message,
          customer_id: customer.id,
          status: 'sent'
        });

        // === ANOMALY_LOG + DRE_CONVERSATIONS SYNC ===
        try {
          // Insert into anomaly_log
          const anomalyType = anomaly.anomaly_type === 'missing_order' || anomaly.anomaly_type === 'missing_item' 
            ? 'time_based' : 'volume_based';
          const { data: anomalyLogRow } = await supabase.from('anomaly_log').insert({
            customer_id: customer.id,
            anomaly_type: anomalyType,
            triggered_at: new Date().toISOString(),
            resolved: false,
          }).select().single();

          // Find or create dre_conversations for proactive outreach
          const telegramChatId = customer.telegram_chat_id || customer.whatsapp_phone || 'unknown';
          const { data: dreConvo } = await supabase.from('dre_conversations').insert({
            customer_id: customer.id,
            channel: 'telegram',
            external_chat_id: telegramChatId,
            control_status: 'dre_active',
            is_proactive_outreach: true,
            anomaly_type: anomalyType,
          }).select().single();

          if (anomalyLogRow && dreConvo) {
            await supabase.from('anomaly_log').update({
              outreach_conversation_id: dreConvo.id,
            }).eq('id', anomalyLogRow.id);
          }

          // Store outreach message in dre_messages
          if (dreConvo) {
            await supabase.from('dre_messages').insert({
              conversation_id: dreConvo.id,
              role: 'dre',
              content: message,
              media_type: 'text',
              language_detected: language,
            });
          }
        } catch (dreErr) {
          console.error('Error syncing to anomaly_log/dre tables:', dreErr);
        }

        results.details.push({ 
          customer_id: customer.id, 
          type: anomaly.anomaly_type, 
          status: 'sent',
          message: message.substring(0, 100) + '...'
        });
      } else {
        results.errors++;
        results.details.push({ 
          customer_id: customer.id, 
          type: anomaly.anomaly_type, 
          status: 'send_failed' 
        });
      }
    }

    // Process missing schedule customers (customers expected to order but no anomaly created)
    for (const schedule of missingScheduleCustomers) {
      const customer = schedule.distribution_customers as any;
      if (!customer?.whatsapp_phone) continue;

      // Check if we already have an anomaly for this customer today
      const existingAnomaly = (pendingAnomalies || []).find(
        a => a.customer_id === schedule.customer_id
      );
      if (existingAnomaly) continue;

      // Check if we already sent outreach today
      const { data: existingOutreach } = await supabase
        .from('dre_outreach_log')
        .select('id')
        .eq('customer_id', customer.id)
        .gte('sent_at', `${todayStr}T00:00:00`)
        .limit(1);

      if (existingOutreach && existingOutreach.length > 0) continue;

      const isCloseProximity = customer.is_close_proximity || 
        (customer.latitude && customer.longitude && 
         calculateDistance(DC_LATITUDE, DC_LONGITUDE, customer.latitude, customer.longitude) <= CLOSE_PROXIMITY_METERS);

      let shouldSend = false;
      let outreachTiming = '';
      let templateKey = 'missing_order';

      if (outreachWindow === 'same_day_early') {
        shouldSend = true;
        outreachTiming = 'same_day_reminder';
        templateKey = 'same_day_early';
      } else if (outreachWindow === 'mahaai_extended' && isCloseProximity) {
        shouldSend = true;
        outreachTiming = 'extended_mahaai';
        templateKey = 'mahaai_extended';
      } else if (outreachWindow === 'next_day_planning') {
        shouldSend = true;
        outreachTiming = 'next_day_planning';
        templateKey = 'next_day_planning';
      }

      if (!shouldSend) continue;

      results.anomalies_processed++;

      const language = customer.preferred_language || 'pap';
      const fallbackTemplates = FALLBACK_TEMPLATES[templateKey as keyof typeof FALLBACK_TEMPLATES];
      let message = fallbackTemplates[language as keyof typeof fallbackTemplates] || fallbackTemplates.en;
      message = message.replace('{customer}', customer.name || 'Customer');
      const dayName = DAY_NAMES[language]?.[todayDow] || DAY_NAMES.en[todayDow];
      message = message.replace('{day}', dayName);

      // Build template variables
      const templateVariables: Record<string, string> = {
        customer_name: customer.name || 'Customer',
        day: dayName
      };

      const sendResult = await sendWhatsAppMessage(
        supabase,
        customer.whatsapp_phone,
        message,
        customer.id,
        templateKey,
        language,
        templateVariables
      );

      if (sendResult.success) {
        results.messages_sent++;
        
        // Create anomaly record for tracking
        const { data: newAnomaly } = await supabase
          .from('distribution_order_anomalies')
          .insert({
            customer_id: customer.id,
            anomaly_type: 'missing_order',
            severity: schedule.confidence_score >= 0.7 ? 'high' : 'medium',
            expected_date: todayStr,
            status: 'outreach_sent',
            details: {
              customer_name: customer.name,
              expected_days: schedule.expected_order_days,
              confidence: schedule.confidence_score,
              source: 'dre_proactive_outreach'
            },
            resolution_notes: `Dre sent proactive outreach at ${curacaoTime.toISOString()}`
          })
          .select()
          .single();

        // Log the outreach
        await supabase.from('dre_outreach_log').insert({
          customer_id: customer.id,
          anomaly_id: newAnomaly?.id || null,
          outreach_type: 'missing_order',
          outreach_timing: outreachTiming,
          message_sent: message,
          language: language,
          status: 'sent'
        });

        await supabase.from('whatsapp_messages').insert({
          direction: 'outbound',
          phone_number: customer.whatsapp_phone,
          message_text: message,
          customer_id: customer.id,
          status: 'sent'
        });

        results.details.push({ 
          customer_id: customer.id, 
          type: 'missing_order', 
          status: 'sent',
          message: message.substring(0, 100) + '...'
        });
      } else {
        results.errors++;
      }
    }

    console.log('Dre Proactive Outreach complete:', results);

    return new Response(JSON.stringify({
      success: true,
      ...results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in dre-proactive-outreach:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
