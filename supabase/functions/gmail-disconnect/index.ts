import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    console.log(`Disconnecting Gmail for user: ${user.id}`);

    // Use service role to manage gmail_credentials
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch existing credentials to get the access token
    const { data: credentials, error: fetchError } = await serviceSupabase
      .from('gmail_credentials')
      .select('id, access_token')
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching credentials:', fetchError);
    }

    // Try to stop Gmail watch if we have an access token
    if (credentials?.access_token) {
      try {
        const stopWatchResponse = await fetch(
          'https://www.googleapis.com/gmail/v1/users/me/stop',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${credentials.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (!stopWatchResponse.ok) {
          console.log('Watch stop failed (may already be stopped):', await stopWatchResponse.text());
        } else {
          console.log('Gmail watch stopped successfully');
        }
      } catch (watchError) {
        console.log('Error stopping watch (non-fatal):', watchError);
      }
    }

    // Delete the credentials from database
    if (credentials?.id) {
      const { error: deleteError } = await serviceSupabase
        .from('gmail_credentials')
        .delete()
        .eq('id', credentials.id);

      if (deleteError) {
        console.error('Error deleting credentials:', deleteError);
        throw new Error('Failed to delete Gmail credentials');
      }
    }

    console.log('Gmail credentials deleted successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in gmail-disconnect:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
