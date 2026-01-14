import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('Webhook dispatcher called without authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a client with the user's token to verify authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Webhook dispatcher authentication failed:', authError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has admin or management role
    const { data: roles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError.message);
      return new Response(JSON.stringify({ error: 'Failed to verify permissions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hasPermission = roles?.some(r => 
      ['admin', 'management'].includes(r.role as string)
    );

    if (!hasPermission) {
      console.error('User does not have permission to dispatch webhooks:', user.id);
      return new Response(JSON.stringify({ error: 'Forbidden - insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { event_type, payload } = await req.json();
    console.log('Dispatching webhook for event:', event_type, 'by user:', user.id);

    // Get active webhooks subscribed to this event
    const { data: webhooks } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('is_active', true)
      .contains('events', [event_type]);

    if (!webhooks?.length) {
      return new Response(JSON.stringify({ message: 'No webhooks configured for this event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = await Promise.all(webhooks.map(async (webhook) => {
      const payloadStr = JSON.stringify(payload);
      const signature = await signPayload(payloadStr, webhook.secret);
      const startTime = Date.now();

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            ...webhook.headers,
          },
          body: payloadStr,
        });

        const duration = Date.now() - startTime;
        const responseBody = await response.text();

        await supabase.from('webhook_logs').insert({
          webhook_id: webhook.id,
          event_type,
          payload,
          response_status: response.status,
          response_body: responseBody.slice(0, 1000),
          duration_ms: duration,
          attempt_number: 1,
        });

        await supabase.from('webhook_configs').update({ last_triggered_at: new Date().toISOString() }).eq('id', webhook.id);

        return { webhook_id: webhook.id, success: response.ok, status: response.status };
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        await supabase.from('webhook_logs').insert({
          webhook_id: webhook.id,
          event_type,
          payload,
          error_message: errMsg,
          attempt_number: 1,
        });
        return { webhook_id: webhook.id, success: false, error: errMsg };
      }
    }));

    return new Response(JSON.stringify({ dispatched: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Webhook dispatcher error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
