import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TemplateVariable {
  name: string;
  position: number;
}

interface Template {
  id: string;
  template_name: string;
  meta_template_name: string;
  category: string;
  purpose: string;
  language: string;
  variables: TemplateVariable[];
  usage_count: number;
  last_used_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      phone_number, 
      purpose, 
      variables = {},
      preferred_language = 'en',
      customer_id = null
    } = await req.json();

    if (!phone_number || !purpose) {
      return new Response(
        JSON.stringify({ error: 'phone_number and purpose are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!accessToken || phoneNumberId) {
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

    // Find eligible templates for this purpose, preferring the customer's language
    const { data: templates, error: templatesError } = await supabase
      .from('whatsapp_message_templates')
      .select('*')
      .eq('purpose', purpose)
      .eq('is_active', true)
      .eq('is_approved', true)
      .order('usage_count', { ascending: true }); // Prefer less-used templates for variety

    if (templatesError || !templates || templates.length === 0) {
      console.error('No approved templates found for purpose:', purpose);
      return new Response(
        JSON.stringify({ 
          error: 'No approved templates available', 
          details: `No templates found for purpose: ${purpose}. Please create and approve templates in Meta Business Manager.`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Smart template selection:
    // 1. Prefer customer's language if available
    // 2. Use weighted random selection favoring less-used templates
    let selectedTemplate: Template;
    
    const languageTemplates = templates.filter((t: Template) => t.language === preferred_language);
    const candidateTemplates = languageTemplates.length > 0 ? languageTemplates : templates;

    // Check what templates were recently sent to this customer to avoid repetition
    const { data: recentSends } = await supabase
      .from('whatsapp_template_sends')
      .select('template_id')
      .eq('phone_number', phone_number.replace(/\D/g, ''))
      .gte('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .order('sent_at', { ascending: false })
      .limit(3);

    const recentTemplateIds = recentSends?.map(s => s.template_id) || [];
    
    // Filter out recently used templates if we have alternatives
    const freshTemplates = candidateTemplates.filter((t: Template) => !recentTemplateIds.includes(t.id));
    const finalCandidates = freshTemplates.length > 0 ? freshTemplates : candidateTemplates;

    // Weighted random selection - lower usage count = higher probability
    const totalUsage = finalCandidates.reduce((sum: number, t: Template) => sum + (t.usage_count + 1), 0);
    const weights = finalCandidates.map((t: Template) => totalUsage - t.usage_count);
    const totalWeight = weights.reduce((sum: number, w: number) => sum + w, 0);
    
    let random = Math.random() * totalWeight;
    let selectedIndex = 0;
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        selectedIndex = i;
        break;
      }
    }
    
    selectedTemplate = finalCandidates[selectedIndex];
    console.log(`Selected template: ${selectedTemplate.template_name} (usage: ${selectedTemplate.usage_count})`);

    // Build template parameters
    const templateVariables = selectedTemplate.variables as TemplateVariable[];
    const components: any[] = [];
    
    if (templateVariables && templateVariables.length > 0) {
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

    // Send template message via Meta API
    const messagePayload: any = {
      messaging_product: 'whatsapp',
      to: phone_number.replace(/\D/g, ''),
      type: 'template',
      template: {
        name: selectedTemplate.meta_template_name,
        language: {
          code: selectedTemplate.language === 'pap' ? 'en' : selectedTemplate.language // Papiamento uses English template with translated content
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
      console.error('WhatsApp API error:', result);
      
      // Log failed send
      await supabase.from('whatsapp_template_sends').insert({
        template_id: selectedTemplate.id,
        phone_number: phone_number.replace(/\D/g, ''),
        customer_id,
        variables_used: variables,
        status: 'failed',
        error_message: JSON.stringify(result.error || result)
      });

      return new Response(
        JSON.stringify({ 
          error: 'Failed to send template message', 
          details: result.error?.message || 'Unknown error',
          error_code: result.error?.code
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Template message sent successfully:', result);

    // Update template usage stats
    await supabase
      .from('whatsapp_message_templates')
      .update({ 
        usage_count: selectedTemplate.usage_count + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', selectedTemplate.id);

    // Log successful send
    await supabase.from('whatsapp_template_sends').insert({
      template_id: selectedTemplate.id,
      phone_number: phone_number.replace(/\D/g, ''),
      customer_id,
      variables_used: variables,
      status: 'sent',
      message_id: result.messages?.[0]?.id
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: result.messages?.[0]?.id,
        template_used: selectedTemplate.template_name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending template message:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
