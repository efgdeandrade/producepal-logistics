import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderData {
  id: string;
  customer_id: string;
  order_date: string;
  delivery_date: string;
  status: string;
  total_xcg: number;
  distribution_customers: { name: string; whatsapp_phone: string; preferred_language: string } | null;
}

interface OrderItem {
  product_id: string;
  quantity: number;
  distribution_products: { name: string };
}

interface CustomerSchedule {
  customer_id: string;
  expected_order_days: number[];
  typical_order_time: string | null;
  typical_order_hour: number | null;
  typical_delivery_type: string | null;
  order_time_consistency: number | null;
  confidence_score: number;
  total_orders_analyzed: number;
}

interface CustomerPattern {
  customer_id: string;
  product_id: string;
  avg_quantity: number;
  order_count: number;
  product_name?: string;
}

// Mahaai Distribution Center coordinates
const DC_LATITUDE = 12.126232;
const DC_LONGITUDE = -68.897127;
const CLOSE_PROXIMITY_METERS = 2000; // 2km radius

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Role check - requires admin or management role
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError || !roles?.some(r => ['admin', 'management'].includes(r.role))) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Insufficient permissions for pattern analysis' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Order pattern analysis initiated by user ${user.id}`);

    const body = await req.json().catch(() => ({}));
    const analyzeOnly = body.analyze_only || false;
    const forceReanalyze = body.force_reanalyze || false;

    console.log('Starting order pattern analysis...', { analyzeOnly, forceReanalyze });

    // Step 1: Analyze historical orders to learn patterns
    const { data: allOrders, error: ordersError } = await supabase
      .from('distribution_orders')
      .select('id, customer_id, order_date, delivery_date, status, total_xcg, distribution_customers(name, whatsapp_phone, preferred_language)')
      .not('customer_id', 'is', null)
      .order('order_date', { ascending: false });

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      throw ordersError;
    }

    console.log(`Found ${allOrders?.length || 0} orders to analyze`);

    // Group orders by customer
    const ordersByCustomer: Record<string, any[]> = {};
    for (const order of (allOrders || [])) {
      if (!order.customer_id) continue;
      if (!ordersByCustomer[order.customer_id]) {
        ordersByCustomer[order.customer_id] = [];
      }
      ordersByCustomer[order.customer_id].push(order);
    }

    // Step 2: Calculate schedule patterns for each customer
    const scheduleUpdates: CustomerSchedule[] = [];
    
    for (const [customerId, orders] of Object.entries(ordersByCustomer)) {
      if (orders.length < 2) continue; // Need at least 2 orders to detect patterns

      // Count orders by day of week
      const dayOfWeekCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      const orderHours: number[] = [];
      let sameDayCount = 0;
      let nextDayCount = 0;
      
      for (const order of orders) {
        const orderDate = new Date(order.order_date);
        const deliveryDate = new Date(order.delivery_date || order.order_date);
        const dayOfWeek = deliveryDate.getDay();
        dayOfWeekCounts[dayOfWeek]++;
        
        // Track order hour (in local time)
        const orderHour = orderDate.getHours();
        orderHours.push(orderHour);
        
        // Determine if order was for same-day or next-day delivery
        const orderDateStr = orderDate.toISOString().split('T')[0];
        const deliveryDateStr = deliveryDate.toISOString().split('T')[0];
        if (orderDateStr === deliveryDateStr) {
          sameDayCount++;
        } else {
          nextDayCount++;
        }
      }

      // Find days where customer orders at least 25% of the time
      const totalOrderDays = orders.length;
      const expectedDays: number[] = [];
      
      for (const [day, count] of Object.entries(dayOfWeekCounts)) {
        const frequency = count / totalOrderDays;
        if (frequency >= 0.25) { // 25% threshold
          expectedDays.push(parseInt(day));
        }
      }

      // Calculate typical order hour
      let typicalOrderHour: number | null = null;
      let orderTimeConsistency: number | null = null;
      if (orderHours.length > 0) {
        const avgHour = orderHours.reduce((a, b) => a + b, 0) / orderHours.length;
        typicalOrderHour = Math.round(avgHour);
        
        // Calculate consistency (standard deviation)
        const variance = orderHours.reduce((sum, h) => sum + Math.pow(h - avgHour, 2), 0) / orderHours.length;
        const stdDev = Math.sqrt(variance);
        orderTimeConsistency = Math.max(0, 1 - (stdDev / 12)); // Normalize to 0-1, where 12 hours = 0 consistency
      }

      // Determine typical delivery type
      const typicalDeliveryType = sameDayCount > nextDayCount ? 'same_day' : 'next_day';

      // Calculate confidence based on sample size and consistency
      const confidence = Math.min(1, orders.length / 20) * 
        (expectedDays.length > 0 ? 0.8 : 0.3);

      scheduleUpdates.push({
        customer_id: customerId,
        expected_order_days: expectedDays,
        typical_order_time: typicalOrderHour !== null ? `${typicalOrderHour.toString().padStart(2, '0')}:00` : null,
        typical_order_hour: typicalOrderHour,
        typical_delivery_type: typicalDeliveryType,
        order_time_consistency: orderTimeConsistency,
        confidence_score: confidence,
        total_orders_analyzed: orders.length,
      });
    }

    // Upsert schedule patterns
    for (const schedule of scheduleUpdates) {
      const { error: upsertError } = await supabase
        .from('distribution_customer_schedules')
        .upsert({
          customer_id: schedule.customer_id,
          expected_order_days: schedule.expected_order_days,
          typical_order_time: schedule.typical_order_time,
          typical_order_hour: schedule.typical_order_hour,
          typical_delivery_type: schedule.typical_delivery_type,
          order_time_consistency: schedule.order_time_consistency,
          confidence_score: schedule.confidence_score,
          total_orders_analyzed: schedule.total_orders_analyzed,
          last_analyzed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'customer_id' });

      if (upsertError) {
        console.error('Error upserting schedule:', upsertError);
      }
    }

    console.log(`Updated ${scheduleUpdates.length} customer schedules`);

    if (analyzeOnly) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Pattern analysis complete',
        schedulesUpdated: scheduleUpdates.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Detect anomalies for today
    const today = new Date();
    const todayDow = today.getDay();
    const todayStr = today.toISOString().split('T')[0];

    console.log(`Checking for anomalies on ${todayStr} (day of week: ${todayDow})`);

    // Get customers who should have ordered today
    const { data: schedules, error: schedulesError } = await supabase
      .from('distribution_customer_schedules')
      .select('*, distribution_customers(id, name, whatsapp_phone, preferred_language)')
      .contains('expected_order_days', [todayDow])
      .gte('confidence_score', 0.3);

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError);
      throw schedulesError;
    }

    console.log(`Found ${schedules?.length || 0} customers expected to order today`);

    // Get today's orders
    const { data: todayOrders, error: todayOrdersError } = await supabase
      .from('distribution_orders')
      .select('customer_id, id')
      .eq('delivery_date', todayStr);

    if (todayOrdersError) {
      console.error('Error fetching today orders:', todayOrdersError);
      throw todayOrdersError;
    }

    const todayCustomerIds = new Set((todayOrders || []).map(o => o.customer_id));

    // Detect missing orders
    const anomalies: any[] = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const schedule of (schedules || [])) {
      const customer = schedule.distribution_customers as any;
      if (!customer) continue;

      if (!todayCustomerIds.has(schedule.customer_id)) {
        // Customer expected to order but didn't
        const expectedDaysNames = (schedule.expected_order_days as number[])
          .map(d => dayNames[d])
          .join(', ');

        anomalies.push({
          customer_id: schedule.customer_id,
          anomaly_type: 'missing_order',
          severity: schedule.confidence_score >= 0.7 ? 'high' : 'medium',
          expected_date: todayStr,
          details: {
            customer_name: customer.name,
            expected_days: schedule.expected_order_days,
            expected_days_names: expectedDaysNames,
            confidence: schedule.confidence_score,
            total_orders: schedule.total_orders_analyzed,
          },
        });
      }
    }

    // Step 4: Check for missing items in today's orders
    for (const order of (todayOrders || [])) {
      // Get customer's typical products
      const { data: patterns } = await supabase
        .from('distribution_customer_patterns')
        .select('product_id, avg_quantity, order_count, distribution_products(name)')
        .eq('customer_id', order.customer_id)
        .gte('order_count', 3); // Only check products ordered at least 3 times

      if (!patterns || patterns.length === 0) continue;

      // Get items in this order
      const { data: orderItems } = await supabase
        .from('distribution_order_items')
        .select('product_id, quantity')
        .eq('order_id', order.id);

      const orderedProductIds = new Set((orderItems || []).map(i => i.product_id));

      // Check for missing products
      for (const pattern of patterns) {
        if (!orderedProductIds.has(pattern.product_id)) {
          const productName = (pattern.distribution_products as any)?.name || 'Unknown';
          
          // Get customer info
          const { data: customerData } = await supabase
            .from('distribution_customers')
            .select('name')
            .eq('id', order.customer_id)
            .single();

          anomalies.push({
            customer_id: order.customer_id,
            anomaly_type: 'missing_item',
            severity: pattern.order_count >= 5 ? 'medium' : 'low',
            expected_date: todayStr,
            details: {
              customer_name: customerData?.name,
              product_name: productName,
              product_id: pattern.product_id,
              usual_quantity: pattern.avg_quantity,
              times_ordered: pattern.order_count,
              order_id: order.id,
            },
          });
        }
      }
    }

    // Step 5: Check for inactive customers
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activeSchedules } = await supabase
      .from('distribution_customer_schedules')
      .select('customer_id, distribution_customers(id, name, whatsapp_phone)')
      .gte('total_orders_analyzed', 5);

    for (const schedule of (activeSchedules || [])) {
      const customer = schedule.distribution_customers as any;
      if (!customer) continue;

      // Get last order date
      const { data: lastOrder } = await supabase
        .from('distribution_orders')
        .select('delivery_date, order_date')
        .eq('customer_id', schedule.customer_id)
        .order('delivery_date', { ascending: false })
        .limit(1);

      if (lastOrder && lastOrder.length > 0) {
        const lastOrderDate = new Date(lastOrder[0].delivery_date || lastOrder[0].order_date);
        const daysSinceOrder = Math.floor((today.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceOrder >= 14) { // 2 weeks without order
          anomalies.push({
            customer_id: schedule.customer_id,
            anomaly_type: 'inactive_customer',
            severity: daysSinceOrder >= 30 ? 'high' : daysSinceOrder >= 21 ? 'medium' : 'low',
            expected_date: todayStr,
            details: {
              customer_name: customer.name,
              days_since_last_order: daysSinceOrder,
              last_order_date: lastOrder[0].delivery_date || lastOrder[0].order_date,
            },
          });
        }
      }
    }

    console.log(`Detected ${anomalies.length} anomalies`);

    // Step 6: Generate multilingual messages using Lovable AI
    for (const anomaly of anomalies) {
      if (!lovableApiKey) {
        // Generate template messages without AI
        anomaly.suggested_message_en = generateTemplateMessage(anomaly, 'en');
        anomaly.suggested_message_pap = generateTemplateMessage(anomaly, 'pap');
        anomaly.suggested_message_nl = generateTemplateMessage(anomaly, 'nl');
        anomaly.suggested_message_es = generateTemplateMessage(anomaly, 'es');
      } else {
        try {
          const messages = await generateAIMessages(anomaly, lovableApiKey);
          anomaly.suggested_message_en = messages.en;
          anomaly.suggested_message_pap = messages.pap;
          anomaly.suggested_message_nl = messages.nl;
          anomaly.suggested_message_es = messages.es;
        } catch (err) {
          console.error('Error generating AI messages:', err);
          anomaly.suggested_message_en = generateTemplateMessage(anomaly, 'en');
          anomaly.suggested_message_pap = generateTemplateMessage(anomaly, 'pap');
          anomaly.suggested_message_nl = generateTemplateMessage(anomaly, 'nl');
          anomaly.suggested_message_es = generateTemplateMessage(anomaly, 'es');
        }
      }
    }

    // Step 7: Insert anomalies (avoiding duplicates for today)
    let insertedCount = 0;
    for (const anomaly of anomalies) {
      // Check if similar anomaly already exists for today
      const { data: existing } = await supabase
        .from('distribution_order_anomalies')
        .select('id')
        .eq('customer_id', anomaly.customer_id)
        .eq('anomaly_type', anomaly.anomaly_type)
        .eq('expected_date', todayStr)
        .maybeSingle();

      if (!existing) {
        const { data: insertedAnomaly, error: insertError } = await supabase
          .from('distribution_order_anomalies')
          .insert(anomaly)
          .select()
          .single();

        if (insertError) {
          console.error('Error inserting anomaly:', insertError);
        } else {
          insertedCount++;
          
          // Trigger immediate Dre outreach for high-priority anomalies
          if (anomaly.severity === 'high' || anomaly.anomaly_type === 'missing_order') {
            try {
              const dreResponse = await fetch(`${supabaseUrl}/functions/v1/dre-proactive-outreach`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                  trigger: 'immediate',
                  anomaly_ids: [insertedAnomaly?.id]
                })
              });
              
              if (dreResponse.ok) {
                console.log(`Triggered immediate Dre outreach for anomaly ${insertedAnomaly?.id}`);
              }
            } catch (dreError) {
              console.error('Error triggering Dre outreach:', dreError);
            }
          }
        }
      }
    }

    console.log(`Inserted ${insertedCount} new anomalies`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Pattern analysis and anomaly detection complete',
      schedulesUpdated: scheduleUpdates.length,
      anomaliesDetected: anomalies.length,
      anomaliesInserted: insertedCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in order-pattern-analyzer:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateTemplateMessage(anomaly: any, language: string): string {
  const customerName = anomaly.details?.customer_name || 'Valued Customer';
  
  if (anomaly.anomaly_type === 'missing_order') {
    const templates: Record<string, string> = {
      en: `Hi ${customerName}! 👋 We noticed we haven't received your usual order today. Just checking in to make sure everything is okay. Would you like to place an order for delivery? Let us know if you need anything! 🍎🥬`,
      pap: `Bon dia ${customerName}! 👋 Nos a nota ku nos no a risibi bo órdu regular awe. Nos ta check pa wak si tur kos ta bon. Bo ke hasi un órdu pa entrega? Laga nos sa si bo mester algo! 🍎🥬`,
      nl: `Hallo ${customerName}! 👋 We merkten dat we uw gebruikelijke bestelling vandaag niet hebben ontvangen. Even checken of alles goed gaat. Wilt u een bestelling plaatsen voor bezorging? Laat het ons weten! 🍎🥬`,
      es: `¡Hola ${customerName}! 👋 Notamos que no hemos recibido tu pedido habitual hoy. Solo queríamos verificar que todo esté bien. ¿Te gustaría hacer un pedido para entrega? ¡Avísanos si necesitas algo! 🍎🥬`,
    };
    return templates[language] || templates.en;
  }
  
  if (anomaly.anomaly_type === 'missing_item') {
    const productName = anomaly.details?.product_name || 'product';
    const templates: Record<string, string> = {
      en: `Hi ${customerName}! 👋 We noticed your order today didn't include ${productName}, which you usually order. Would you like to add it? Just let us know! 🍎`,
      pap: `Bon dia ${customerName}! 👋 Nos a nota ku bo órdu di awe no tin ${productName}, ku bo ta ordena normalmente. Bo ke agregá? Laga nos sa! 🍎`,
      nl: `Hallo ${customerName}! 👋 We merkten dat uw bestelling vandaag geen ${productName} bevat, wat u normaal bestelt. Wilt u het toevoegen? Laat het ons weten! 🍎`,
      es: `¡Hola ${customerName}! 👋 Notamos que tu pedido de hoy no incluyó ${productName}, que normalmente ordenas. ¿Te gustaría agregarlo? ¡Avísanos! 🍎`,
    };
    return templates[language] || templates.en;
  }
  
  if (anomaly.anomaly_type === 'inactive_customer') {
    const days = anomaly.details?.days_since_last_order || 'a while';
    const templates: Record<string, string> = {
      en: `Hi ${customerName}! 👋 We miss you! It's been ${days} days since your last order. Everything okay? We're here whenever you're ready to order again. Hope to hear from you soon! 🍎🥬`,
      pap: `Bon dia ${customerName}! 👋 Nos ta stima bo! Ta ${days} dia pasa nos no a tende di bo. Tur kos ta bon? Nos ta aki ora bo ta kla pa ordena atrobe. Spera di tende di bo pronto! 🍎🥬`,
      nl: `Hallo ${customerName}! 👋 We missen u! Het is ${days} dagen geleden sinds uw laatste bestelling. Gaat alles goed? We zijn er wanneer u weer klaar bent om te bestellen. Hopen snel van u te horen! 🍎🥬`,
      es: `¡Hola ${customerName}! 👋 ¡Te extrañamos! Han pasado ${days} días desde tu último pedido. ¿Todo bien? Estamos aquí cuando estés listo para ordenar de nuevo. ¡Esperamos saber de ti pronto! 🍎🥬`,
    };
    return templates[language] || templates.en;
  }

  return `Hi ${customerName}, we wanted to check in with you. Let us know if you need anything!`;
}

async function generateAIMessages(anomaly: any, apiKey: string): Promise<{ en: string; pap: string; nl: string; es: string }> {
  const customerName = anomaly.details?.customer_name || 'Valued Customer';
  
  let context = '';
  if (anomaly.anomaly_type === 'missing_order') {
    context = `Customer "${customerName}" usually orders on ${anomaly.details?.expected_days_names}, but hasn't placed an order today.`;
  } else if (anomaly.anomaly_type === 'missing_item') {
    context = `Customer "${customerName}" placed an order but didn't include ${anomaly.details?.product_name} which they usually order (${anomaly.details?.usual_quantity} units, ordered ${anomaly.details?.times_ordered} times before).`;
  } else if (anomaly.anomaly_type === 'inactive_customer') {
    context = `Customer "${customerName}" hasn't ordered in ${anomaly.details?.days_since_last_order} days, last order was on ${anomaly.details?.last_order_date}.`;
  }

  const prompt = `Generate a friendly WhatsApp message for a produce/fruit distribution company to send to a customer. 

Context: ${context}

The message should:
- Be warm and friendly, not pushy
- Include relevant emojis
- Be concise (2-3 sentences max)
- Offer to help

Generate the message in FOUR languages as a JSON object with keys "en" (English), "pap" (Papiamentu), "nl" (Dutch), and "es" (Spanish).
ONLY return the JSON object, nothing else.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that generates friendly customer outreach messages for a produce distribution company. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  throw new Error('Failed to parse AI response');
}
