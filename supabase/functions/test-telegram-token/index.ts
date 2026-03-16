const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!token) {
      return new Response(JSON.stringify({ ok: false, bot_username: '', error: 'TELEGRAM_BOT_TOKEN not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await resp.json();

    if (data.ok) {
      return new Response(JSON.stringify({ ok: true, bot_username: data.result.username }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ ok: false, bot_username: '', error: data.description || 'Unknown error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, bot_username: '', error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
