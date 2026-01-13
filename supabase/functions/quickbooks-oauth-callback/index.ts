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

    console.log('=== QUICKBOOKS OAUTH CALLBACK START ===');
    console.log('Callback URL:', req.url);
    console.log('Has code:', !!code);
    console.log('RealmId from callback:', realmId);
    console.log('Error:', error);
    console.log('Error Description:', errorDescription);

    // Get the app URL for redirects
    const appUrl = Deno.env.get('APP_URL') || 'https://dnxzpkbobzwjcuyfgdnh.lovable.app';

    // Handle OAuth error
    if (error) {
      console.error('OAuth error from QuickBooks:', error, errorDescription);
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

    // === DIAGNOSTIC LOGGING (NO SECRETS EXPOSED) ===
    console.log('=== DIAGNOSTIC INFO ===');
    console.log('Client ID preview:', clientId ? `${clientId.substring(0, 6)}... (length: ${clientId.length})` : 'NOT SET');
    console.log('Client Secret length:', clientSecret ? `${clientSecret.length} chars` : 'NOT SET');
    console.log('SUPABASE_URL:', supabaseUrl || 'NOT SET');
    console.log('Redirect URI being sent:', redirectUri);
    console.log('Configured RealmId:', configuredRealmId || 'NOT SET');
    console.log('Auth code preview:', code ? `${code.substring(0, 10)}... (length: ${code.length})` : 'MISSING');
    console.log('=======================');

    if (!clientId || !clientSecret) {
      console.error('QuickBooks credentials not configured - Client ID:', !!clientId, 'Client Secret:', !!clientSecret);
      return Response.redirect(
        `${appUrl}/settings/integrations/quickbooks/connect?error=${encodeURIComponent('QuickBooks credentials not configured')}`,
        302
      );
    }

    // Build Authorization header using UTF-8 safe encoding
    const authString = `${clientId}:${clientSecret}`;
    const authHeader = `Basic ${base64Encode(authString)}`;
    console.log('Auth header format check - starts with "Basic ":', authHeader.startsWith('Basic '));
    console.log('Auth header total length:', authHeader.length);

    // Build token request body
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    });

    console.log('=== TOKEN REQUEST DETAILS ===');
    console.log('Token endpoint: https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer');
    console.log('Grant type: authorization_code');
    console.log('Redirect URI in request:', redirectUri);
    console.log('=============================');

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
      console.error('=== TOKEN EXCHANGE ERROR ===');
      console.error('HTTP Status:', tokenResponse.status);
      console.error('HTTP Status Text:', tokenResponse.statusText);
      console.error('Response Headers:', JSON.stringify(Object.fromEntries(tokenResponse.headers.entries()), null, 2));
      console.error('Response Body:', errorText);
      console.error('============================');
      
      return Response.redirect(
        `${appUrl}/settings/integrations/quickbooks/connect?error=${encodeURIComponent(`Token exchange failed: ${errorText}`)}`,
        302
      );
    }

    const tokens = await tokenResponse.json();
    console.log('Token exchange successful!');
    console.log('Access token received:', !!tokens.access_token);
    console.log('Refresh token received:', !!tokens.refresh_token);
    console.log('Expires in:', tokens.expires_in, 'seconds');

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
      console.error('No realm ID available - callback realmId:', realmId, 'configured:', configuredRealmId);
      return Response.redirect(
        `${appUrl}/settings/integrations/quickbooks/connect?error=${encodeURIComponent('No QuickBooks Company ID (Realm ID) available')}`,
        302
      );
    }

    console.log('Using Realm ID:', finalRealmId);

    // Upsert tokens (update if realm_id exists, otherwise insert)
    const { error: dbError } = await supabase
      .from('quickbooks_tokens')
      .upsert({
        realm_id: finalRealmId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'realm_id',
      });

    if (dbError) {
      console.error('Failed to store tokens in database:', dbError);
      return Response.redirect(
        `${appUrl}/settings/integrations/quickbooks/connect?error=${encodeURIComponent('Failed to store tokens in database')}`,
        302
      );
    }

    console.log('Tokens stored successfully for realm:', finalRealmId);
    console.log('=== QUICKBOOKS OAUTH CALLBACK SUCCESS ===');

    // Redirect back to the app with success
    return Response.redirect(
      `${appUrl}/settings/integrations/quickbooks/connect?connected=true&realmId=${finalRealmId}`,
      302
    );

  } catch (error: unknown) {
    console.error('=== UNHANDLED EXCEPTION ===');
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('===========================');
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    const appUrl = Deno.env.get('APP_URL') || 'https://dnxzpkbobzwjcuyfgdnh.lovable.app';
    
    return Response.redirect(
      `${appUrl}/settings/integrations/quickbooks/connect?error=${encodeURIComponent(message)}`,
      302
    );
  }
});
