import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UTF-8 safe base64 encoding to handle special characters in credentials
function base64Encode(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const realmId = url.searchParams.get('realmId');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // Security: Only log non-sensitive operational info
    console.log('QuickBooks OAuth callback received');

    // Get the app URL for redirects
    const appUrl = Deno.env.get('APP_URL') || 'https://dnxzpkbobzwjcuyfgdnh.lovable.app';

    // Handle OAuth error
    if (error) {
      console.error('OAuth error from QuickBooks');
      return Response.redirect(
        `${appUrl}/settings/integrations/quickbooks/connect?error=${encodeURIComponent(errorDescription || error)}`,
        302
      );
    }

    // Validate required parameters
    if (!code) {
      console.error('Missing authorization code in callback');
      return Response.redirect(
        `${appUrl}/settings/integrations/quickbooks/connect?error=${encodeURIComponent('Missing authorization code')}`,
        302
      );
    }

    // Get QuickBooks credentials
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    const configuredRealmId = Deno.env.get('QUICKBOOKS_REALM_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

    // Build redirect URI (must match exactly what was used in the authorization request)
    const redirectUri = `${supabaseUrl}/functions/v1/quickbooks-oauth-callback`;

    if (!clientId || !clientSecret) {
      console.error('QuickBooks credentials not configured');
      return Response.redirect(
        `${appUrl}/settings/integrations/quickbooks/connect?error=${encodeURIComponent('QuickBooks credentials not configured')}`,
        302
      );
    }

    // Build Authorization header using UTF-8 safe encoding
    const authString = `${clientId}:${clientSecret}`;
    const authHeader = `Basic ${base64Encode(authString)}`;

    // Build token request body
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    });

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenRequestBody.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed with status:', tokenResponse.status);
      
      return Response.redirect(
        `${appUrl}/settings/integrations/quickbooks/connect?error=${encodeURIComponent('Token exchange failed')}`,
        302
      );
    }

    const tokens = await tokenResponse.json();
    console.log('Token exchange successful');

    // Calculate token expiry (access token typically expires in 1 hour)
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokens.expires_in || 3600));

    // Store tokens in database
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Use the realm ID from the callback, or fall back to configured one
    const finalRealmId = realmId || configuredRealmId;

    if (!finalRealmId) {
      console.error('No realm ID available');
      return Response.redirect(
        `${appUrl}/settings/integrations/quickbooks/connect?error=${encodeURIComponent('No QuickBooks Company ID (Realm ID) available')}`,
        302
      );
    }

    // Detect sandbox vs production based on realm ID pattern or explicit flag
    // QuickBooks sandbox realm IDs are typically shorter and start with specific patterns
    // For safety, default to sandbox mode during development
    const isSandbox = true; // Set to false for production deployments

    // Upsert tokens (update if realm_id exists, otherwise insert)
    const { error: dbError } = await supabase
      .from('quickbooks_tokens')
      .upsert({
        realm_id: finalRealmId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        is_sandbox: isSandbox,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'realm_id',
      });

    if (dbError) {
      console.error('Failed to store tokens in database');
      return Response.redirect(
        `${appUrl}/settings/integrations/quickbooks/connect?error=${encodeURIComponent('Failed to store tokens in database')}`,
        302
      );
    }

    console.log('QuickBooks connection completed successfully');

    // Redirect back to the app with success
    return Response.redirect(
      `${appUrl}/settings/integrations/quickbooks/connect?connected=true&realmId=${finalRealmId}`,
      302
    );

  } catch (error: unknown) {
    console.error('QuickBooks OAuth callback error');
    
    const message = 'An unexpected error occurred';
    const appUrl = Deno.env.get('APP_URL') || 'https://dnxzpkbobzwjcuyfgdnh.lovable.app';
    
    return Response.redirect(
      `${appUrl}/settings/integrations/quickbooks/connect?error=${encodeURIComponent(message)}`,
      302
    );
  }
});
