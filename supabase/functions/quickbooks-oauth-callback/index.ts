import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('QuickBooks OAuth callback received:', { 
      hasCode: !!code, 
      realmId, 
      error,
      errorDescription 
    });

    // Get the app URL for redirects
    const appUrl = Deno.env.get('APP_URL') || 'https://dnxzpkbobzwjcuyfgdnh.lovable.app';

    // Handle OAuth error
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return Response.redirect(
        `${appUrl}/settings/integrations/quickbooks?error=${encodeURIComponent(errorDescription || error)}`,
        302
      );
    }

    // Validate required parameters
    if (!code) {
      console.error('Missing authorization code');
      return Response.redirect(
        `${appUrl}/settings/integrations/quickbooks?error=${encodeURIComponent('Missing authorization code')}`,
        302
      );
    }

    // Get QuickBooks credentials
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    const configuredRealmId = Deno.env.get('QUICKBOOKS_REALM_ID');

    if (!clientId || !clientSecret) {
      console.error('QuickBooks credentials not configured');
      return Response.redirect(
        `${appUrl}/settings/integrations/quickbooks?error=${encodeURIComponent('QuickBooks credentials not configured')}`,
        302
      );
    }

    // Build redirect URI (must match exactly what was used in the authorization request)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const redirectUri = `${supabaseUrl}/functions/v1/quickbooks-oauth-callback`;

    console.log('Exchanging authorization code for tokens...');
    console.log('Redirect URI:', redirectUri);

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorText);
      return Response.redirect(
        `${appUrl}/settings/integrations/quickbooks?error=${encodeURIComponent(`Token exchange failed: ${errorText}`)}`,
        302
      );
    }

    const tokens = await tokenResponse.json();
    console.log('Token exchange successful, received tokens');

    // Calculate token expiry (access token typically expires in 1 hour)
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokens.expires_in || 3600));

    // Store tokens in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Use the realm ID from the callback, or fall back to configured one
    const finalRealmId = realmId || configuredRealmId;

    if (!finalRealmId) {
      console.error('No realm ID available');
      return Response.redirect(
        `${appUrl}/settings/integrations/quickbooks?error=${encodeURIComponent('No QuickBooks Company ID (Realm ID) available')}`,
        302
      );
    }

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
      console.error('Failed to store tokens:', dbError);
      return Response.redirect(
        `${appUrl}/settings/integrations/quickbooks?error=${encodeURIComponent('Failed to store tokens in database')}`,
        302
      );
    }

    console.log('Tokens stored successfully for realm:', finalRealmId);

    // Redirect back to the app with success
    return Response.redirect(
      `${appUrl}/settings/integrations/quickbooks?connected=true&realmId=${finalRealmId}`,
      302
    );

  } catch (error: unknown) {
    console.error('OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const appUrl = Deno.env.get('APP_URL') || 'https://dnxzpkbobzwjcuyfgdnh.lovable.app';
    
    return Response.redirect(
      `${appUrl}/settings/integrations/quickbooks?error=${encodeURIComponent(message)}`,
      302
    );
  }
});
