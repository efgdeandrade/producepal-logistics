import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Get the credential ID if provided, otherwise use the first one
    const { credentialId } = await req.json().catch(() => ({}));

    // Fetch the Gmail credential
    let query = supabase
      .from("gmail_credentials")
      .select("*")
      .eq("is_active", true);
    
    if (credentialId) {
      query = query.eq("id", credentialId);
    }

    const { data: credential, error: credError } = await query.single();

    if (credError || !credential) {
      throw new Error("No active Gmail credential found");
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const pubsubTopic = Deno.env.get("GOOGLE_PUBSUB_TOPIC")!;

    // Refresh the access token if needed
    let accessToken = credential.access_token;
    
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: credential.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("Token refresh failed:", error);
      throw new Error("Failed to refresh access token");
    }

    const tokenData = await tokenResponse.json();
    accessToken = tokenData.access_token;

    // Update the access token in the database
    await supabase
      .from("gmail_credentials")
      .update({
        access_token: accessToken,
        token_expiry: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
      })
      .eq("id", credential.id);

    // Set up the Gmail watch
    const watchResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/watch",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topicName: pubsubTopic,
          labelIds: ["INBOX"],
        }),
      }
    );

    if (!watchResponse.ok) {
      const error = await watchResponse.text();
      console.error("Watch setup failed:", error);
      throw new Error(`Failed to set up Gmail watch: ${error}`);
    }

    const watchData = await watchResponse.json();
    console.log("Watch setup successful:", watchData);

    // Update the watch expiration in the database
    const watchExpiration = new Date(parseInt(watchData.expiration));
    
    const { error: updateError } = await supabase
      .from("gmail_credentials")
      .update({
        watch_expiration: watchExpiration.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", credential.id);

    if (updateError) {
      console.error("Failed to update watch expiration:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Gmail watch renewed successfully",
        watchExpiration: watchExpiration.toISOString(),
        historyId: watchData.historyId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in gmail-renew-watch:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
