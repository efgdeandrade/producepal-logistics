import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Mapbox public tokens are safe to expose - they have domain restrictions
    // No authentication required for this endpoint
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    
    if (!mapboxToken) {
      console.error('[get-mapbox-token] MAPBOX_PUBLIC_TOKEN environment variable not set');
      return new Response(
        JSON.stringify({ error: 'Mapbox token not configured' }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[get-mapbox-token] Token retrieved successfully');

    return new Response(
      JSON.stringify({ token: mapboxToken }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in get-mapbox-token:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});