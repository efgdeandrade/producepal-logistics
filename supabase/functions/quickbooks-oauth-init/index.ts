import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!clientId) {
      console.error('QUICKBOOKS_CLIENT_ID not configured');
      throw new Error('QuickBooks Client ID not configured. Please add it in the backend secrets.');
    }

    if (!supabaseUrl) {
      console.error('SUPABASE_URL not configured');
      throw new Error('Supabase URL not configured');
    }

    // Build the redirect URI using the Supabase URL
    const redirectUri = encodeURIComponent(`${supabaseUrl}/functions/v1/quickbooks-oauth-callback`);
    
    // QuickBooks OAuth 2.0 scopes for accounting
    const scopes = encodeURIComponent('com.intuit.quickbooks.accounting');
    
    // Generate a secure state parameter for CSRF protection
    const state = crypto.randomUUID();

    // Build QuickBooks OAuth authorization URL
    const authUrl = `https://appcenter.intuit.com/connect/oauth2?` +
      `client_id=${clientId}&` +
      `redirect_uri=${redirectUri}&` +
      `response_type=code&` +
      `scope=${scopes}&` +
      `state=${state}`;

    console.log('Generated OAuth authorization URL for QuickBooks');

    return new Response(JSON.stringify({ authUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error initiating QuickBooks OAuth:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
