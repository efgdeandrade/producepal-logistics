import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Send WhatsApp message via Meta API
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
          text: { body: message }
        }),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('WhatsApp API error:', errorText);
      return false;
    }
    
    console.log(`WhatsApp notification sent to ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

interface OrderItem {
  product_name?: string;
  quantity: number;
  unit_price_xcg?: number;
}

interface NotificationPayload {
  order_id: string;
  order_number: string;
  customer_name: string | null;
  customer_phone: string;
  total_xcg: number;
  items: OrderItem[];
  requested_delivery_time?: string | null;
  has_special_requirements?: boolean;
  notification_type: 'new_order' | 'escalation' | 'complaint';
  escalation_reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();
    
    const {
      order_id,
      order_number,
      customer_name,
      customer_phone,
      total_xcg,
      items,
      requested_delivery_time,
      has_special_requirements,
      notification_type = 'new_order',
      escalation_reason
    } = payload;

    console.log(`Processing ${notification_type} notification for order ${order_number}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get team notification settings based on notification type
    const { data: teamSettings, error: settingsError } = await supabase
      .from('team_notification_settings')
      .select('*')
      .eq('is_active', true);

    if (settingsError) {
      console.error('Error fetching team settings:', settingsError);
      throw settingsError;
    }

    // Filter by notification type
    const recipients = (teamSettings || []).filter(setting => {
      switch (notification_type) {
        case 'new_order':
          return setting.notify_on_new_orders;
        case 'escalation':
          return setting.notify_on_escalations;
        case 'complaint':
          return setting.notify_on_complaints;
        default:
          return setting.notify_on_new_orders;
      }
    });

    if (recipients.length === 0) {
      console.log('No recipients configured for this notification type');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No recipients configured',
        sent: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build notification message
    let message = '';
    
    if (notification_type === 'new_order') {
      // Format items list
      const itemsList = items.slice(0, 5).map(item => 
        `• ${item.quantity}x ${item.product_name || 'Unknown'}`
      ).join('\n');
      
      const moreItems = items.length > 5 ? `\n... +${items.length - 5} more items` : '';
      
      message = `🛒 *NEW ORDER via Dre*

📋 Order: ${order_number}
👤 Customer: ${customer_name || 'New Customer'}
📱 Phone: ${customer_phone}
💰 Total: Nafl. ${total_xcg.toFixed(2)}

*Items:*
${itemsList}${moreItems}`;

      // Add special requirements alert
      if (has_special_requirements || requested_delivery_time) {
        message += `\n\n⚠️ *SPECIAL REQUEST*`;
        if (requested_delivery_time) {
          message += `\n🕐 Delivery: ${requested_delivery_time}`;
        }
      }
    } else if (notification_type === 'escalation') {
      message = `🚨 *ESCALATION NEEDED*

👤 Customer: ${customer_name || customer_phone}
📱 Phone: ${customer_phone}

*Reason:*
${escalation_reason || 'Customer requested human assistance'}

Please respond ASAP!`;
    } else if (notification_type === 'complaint') {
      message = `⚠️ *CUSTOMER COMPLAINT*

👤 Customer: ${customer_name || customer_phone}
📱 Phone: ${customer_phone}
📋 Order: ${order_number || 'N/A'}

*Issue:*
${escalation_reason || 'Customer expressed dissatisfaction'}

Immediate attention required!`;
    }

    // Send to all recipients
    const results = await Promise.all(
      recipients.map(async (recipient) => {
        const sent = await sendWhatsAppMessage(recipient.whatsapp_phone, message);
        
        // Log the notification
        if (sent) {
          await supabase.from('whatsapp_messages').insert({
            direction: 'outbound',
            phone_number: recipient.whatsapp_phone,
            message_text: message,
            message_type: 'text',
            status: 'sent',
            metadata: {
              notification_type,
              order_id,
              recipient_name: recipient.display_name
            }
          });
        }
        
        return { phone: recipient.whatsapp_phone, sent };
      })
    );

    // Also create in-app notifications for team members with user_id
    const userRecipients = recipients.filter(r => r.user_id);
    if (userRecipients.length > 0) {
      const inAppNotifications = userRecipients.map(r => ({
        user_id: r.user_id,
        type: notification_type,
        title: notification_type === 'new_order' 
          ? `🛒 New Order: ${order_number}`
          : notification_type === 'complaint'
          ? `⚠️ Complaint: ${customer_name || customer_phone}`
          : `🚨 Escalation: ${customer_name || customer_phone}`,
        message: notification_type === 'new_order'
          ? `${customer_name || 'New customer'} ordered ${items.length} items - Nafl. ${total_xcg.toFixed(2)}`
          : escalation_reason || 'Requires attention',
        is_read: false,
        metadata: { order_id, order_number, customer_phone }
      }));
      
      await supabase.from('notifications').insert(inAppNotifications);
    }

    const sentCount = results.filter(r => r.sent).length;
    console.log(`Sent ${sentCount}/${recipients.length} notifications`);

    return new Response(JSON.stringify({ 
      success: true, 
      sent: sentCount,
      total: recipients.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Team notification error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to send notifications',
      details: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
