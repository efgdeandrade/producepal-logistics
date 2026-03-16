const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server configuration missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract project ref from SUPABASE_URL (e.g. https://abcdef.supabase.co -> abcdef)
    const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

    // Upsert the secret via the Supabase Management API
    const resp = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/secrets`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          { name: 'TELEGRAM_BOT_TOKEN', value: token.trim() },
        ]),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Management API error:', resp.status, errText);
      return new Response(JSON.stringify({ error: `Failed to save token: ${resp.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('save-telegram-token error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
