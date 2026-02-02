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
    const { 
      phone_number, 
      message_text, 
      sent_by_user_id,
      use_template_if_needed = true,
      template_purpose = 'order_reminder',
      template_variables = {}
    } = await req.json();

    if (!phone_number || !message_text) {
      return new Response(
        JSON.stringify({ error: 'phone_number and message_text are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!accessToken || !phoneNumberId) {
      console.error('WhatsApp credentials not configured');
      return new Response(
        JSON.stringify({ error: 'WhatsApp not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cleanPhone = phone_number.replace(/\D/g, '');

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

    console.log(`Customer ${cleanPhone} - Last message: ${lastIncoming?.created_at}, Within 24h window: ${withinWindow}`);

    // If outside window and templates are enabled, use template instead
    if (!withinWindow && use_template_if_needed) {
      console.log('Outside 24-hour window, attempting to use template message...');
      
      // Get customer info for personalization
      const { data: customer } = await supabase
        .from('distribution_customers')
        .select('id, name, preferred_language')
        .eq('whatsapp_phone', cleanPhone)
        .single();

      // Find an approved template
      const { data: templates } = await supabase
        .from('whatsapp_message_templates')
        .select('*')
        .eq('purpose', template_purpose)
        .eq('is_active', true)
        .eq('is_approved', true)
        .order('usage_count', { ascending: true });

      if (templates && templates.length > 0) {
        // Filter by customer's language preference if available
        const preferredLang = customer?.preferred_language || 'en';
        let langTemplates = templates.filter(t => t.language === preferredLang);
        if (langTemplates.length === 0) langTemplates = templates;

        // Pick least-used template for variety
        const template = langTemplates[0];
        
        // Build variables - merge provided variables with customer name
        const variables = {
          customer_name: customer?.name || 'there',
          ...template_variables
        };

        // Build template parameters
        const templateVariables = (template.variables || []) as Array<{name: string, position: number}>;
        const components: any[] = [];
        
        if (templateVariables.length > 0) {
          const parameters = templateVariables
            .sort((a, b) => a.position - b.position)
            .map(v => ({
              type: 'text',
              text: variables[v.name as keyof typeof variables] || `{{${v.position}}}`
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
            customer_id: customer?.id,
            variables_used: variables,
            status: 'failed',
            error_message: JSON.stringify(result.error || result)
          });

          return new Response(
            JSON.stringify({ 
              error: 'Failed to send template message',
              details: result.error?.message || 'Template not approved or invalid',
              suggestion: 'Please create and approve this template in Meta Business Manager first.',
              template_name: template.meta_template_name
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Template message sent successfully:', result);

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
          customer_id: customer?.id,
          variables_used: variables,
          status: 'sent',
          message_id: result.messages?.[0]?.id
        });

        // Update conversation record
        await supabase
          .from('whatsapp_conversations')
          .update({
            last_message_text: `[Template: ${template.template_name}]`,
            last_message_direction: 'outbound',
            last_activity_at: new Date().toISOString(),
          })
          .eq('phone_number', cleanPhone);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message_id: result.messages?.[0]?.id,
            used_template: true,
            template_name: template.template_name,
            note: 'Customer is outside 24-hour window. Template message was sent instead.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ 
            error: 'Cannot send message - outside 24-hour window',
            details: 'No approved templates available for this purpose. Please create templates in Meta Business Manager.',
            template_purpose,
            suggestion: 'Create and approve message templates in Meta Business Manager to enable proactive outreach.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Within 24-hour window - send regular message
    console.log('Within 24-hour window, sending regular message...');
    
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
          text: { body: message_text }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WhatsApp API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send WhatsApp message', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    console.log('WhatsApp message sent successfully:', result);

    // Update conversation to reflect human message was sent
    await supabase
      .from('whatsapp_conversations')
      .update({
        last_message_text: message_text,
        last_message_direction: 'outbound',
        last_activity_at: new Date().toISOString(),
      })
      .eq('phone_number', cleanPhone);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: result.messages?.[0]?.id,
        used_template: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending team WhatsApp:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
