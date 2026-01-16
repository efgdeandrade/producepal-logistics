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

    // Find credentials expiring within the next 24 hours
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: expiringCredentials, error: fetchError } = await supabase
      .from("gmail_credentials")
      .select("*")
      .eq("is_active", true)
      .lt("watch_expiration", tomorrow.toISOString());

    if (fetchError) {
      throw new Error(`Failed to fetch credentials: ${fetchError.message}`);
    }

    console.log(`Found ${expiringCredentials?.length || 0} credentials expiring soon`);

    const results = [];
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const pubsubTopic = Deno.env.get("GOOGLE_PUBSUB_TOPIC")!;

    for (const credential of expiringCredentials || []) {
      try {
        console.log(`Renewing watch for ${credential.email_address}`);

        // Refresh the access token
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
          console.error(`Token refresh failed for ${credential.email_address}:`, error);
          results.push({
            email: credential.email_address,
            success: false,
            error: "Token refresh failed",
          });
          continue;
        }

        const tokenData = await tokenResponse.json();

        // Update the access token
        await supabase
          .from("gmail_credentials")
          .update({
            access_token: tokenData.access_token,
            token_expiry: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
          })
          .eq("id", credential.id);

        // Set up the Gmail watch
        const watchResponse = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/watch",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
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
          console.error(`Watch setup failed for ${credential.email_address}:`, error);
          results.push({
            email: credential.email_address,
            success: false,
            error: "Watch setup failed",
          });
          continue;
        }

        const watchData = await watchResponse.json();
        const watchExpiration = new Date(parseInt(watchData.expiration));

        // Update the watch expiration
        await supabase
          .from("gmail_credentials")
          .update({
            watch_expiration: watchExpiration.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", credential.id);

        console.log(`Successfully renewed watch for ${credential.email_address}`);
        results.push({
          email: credential.email_address,
          success: true,
          watchExpiration: watchExpiration.toISOString(),
        });
      } catch (error: any) {
        console.error(`Error renewing watch for ${credential.email_address}:`, error);
        results.push({
          email: credential.email_address,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} credentials: ${successCount} renewed, ${failCount} failed`,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in gmail-watch-checker:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
