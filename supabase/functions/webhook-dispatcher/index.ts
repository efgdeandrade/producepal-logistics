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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { event_type, payload } = await req.json();
    console.log('Dispatching webhook for event:', event_type);

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
