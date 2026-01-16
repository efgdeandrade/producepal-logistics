import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

interface RefreshResult {
  accessToken: string;
  expiresAt: string;
}

async function refreshGmailToken(refreshToken: string): Promise<RefreshResult> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  }

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, credentialId } = await req.json();

    if (!userId && !credentialId) {
      throw new Error("Either userId or credentialId required");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get credentials
    let query = supabase.from("gmail_credentials").select("*");
    if (credentialId) {
      query = query.eq("id", credentialId);
    } else {
      query = query.eq("user_id", userId);
    }

    const { data: credentials, error: fetchError } = await query.single();

    if (fetchError || !credentials) {
      throw new Error("Credentials not found");
    }

    console.log(`Refreshing token for: ${credentials.email_address}`);

    // Check if token needs refresh (expires in less than 5 minutes)
    const expiresAt = new Date(credentials.token_expires_at);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresAt.getTime() - now.getTime() > fiveMinutes) {
      console.log("Token still valid, no refresh needed");
      return new Response(
        JSON.stringify({
          accessToken: credentials.access_token,
          expiresAt: credentials.token_expires_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh the token
    const result = await refreshGmailToken(credentials.refresh_token);

    // Update in database
    const { error: updateError } = await supabase
      .from("gmail_credentials")
      .update({
        access_token: result.accessToken,
        token_expires_at: result.expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", credentials.id);

    if (updateError) {
      console.error("Failed to update token in database:", updateError);
    }

    console.log("Token refreshed successfully");

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in gmail-refresh-token:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
