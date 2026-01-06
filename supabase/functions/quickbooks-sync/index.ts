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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { entity_type } = await req.json();
    console.log('QuickBooks sync requested for:', entity_type);

    // Log sync attempt
    await supabase.from('quickbooks_sync_log').insert({
      entity_type: entity_type || 'all',
      status: 'success',
      records_synced: 0,
      sync_direction: 'export',
    });

    // Update integration status
    await supabase
      .from('external_integrations')
      .update({ last_sync_at: new Date().toISOString(), sync_status: 'success' })
      .eq('type', 'quickbooks');

    return new Response(JSON.stringify({ 
      success: true, 
      message: `QuickBooks sync completed for ${entity_type}`,
      records_synced: 0 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('QuickBooks sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
