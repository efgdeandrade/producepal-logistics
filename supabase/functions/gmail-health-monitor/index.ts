import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    console.log("Gmail health monitor check started");

    // Get all active Gmail credentials
    const { data: credentials, error: fetchError } = await supabase
      .from("gmail_credentials")
      .select("*")
      .eq("is_active", true);

    if (fetchError) {
      throw new Error(`Failed to fetch credentials: ${fetchError.message}`);
    }

    if (!credentials || credentials.length === 0) {
      console.log("No active Gmail credentials found");
      return new Response(
        JSON.stringify({ success: true, message: "No active credentials to check" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    for (const credential of credentials) {
      const healthCheck: {
        email: string;
        healthy: boolean;
        tokenValid: boolean;
        watchValid: boolean;
        needsReauth: boolean;
        issues: string[];
      } = {
        email: credential.email_address,
        healthy: true,
        tokenValid: true,
        watchValid: true,
        needsReauth: false,
        issues: [],
      };

      // Check watch expiration
      if (credential.watch_expiration) {
        const watchExpires = new Date(credential.watch_expiration);
        const hoursUntilExpiry = (watchExpires.getTime() - Date.now()) / (1000 * 60 * 60);
        
        if (hoursUntilExpiry < 0) {
          healthCheck.watchValid = false;
          healthCheck.healthy = false;
          healthCheck.issues.push("Watch has expired");
        } else if (hoursUntilExpiry < 48) {
          healthCheck.issues.push(`Watch expiring in ${Math.round(hoursUntilExpiry)} hours`);
        }
      } else {
        healthCheck.watchValid = false;
        healthCheck.healthy = false;
        healthCheck.issues.push("No watch configured");
      }

      // Test token refresh to detect invalid_grant errors proactively
      try {
        console.log(`Testing token refresh for ${credential.email_address}`);
        
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

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok || tokenData.error) {
          healthCheck.tokenValid = false;
          healthCheck.healthy = false;
          
          // Check for specific error types
          const errorType = tokenData.error || "unknown";
          const errorDesc = tokenData.error_description || "";
          
          if (errorType === "invalid_grant") {
            healthCheck.needsReauth = true;
            if (errorDesc.includes("invalid_rapt")) {
              healthCheck.issues.push("Workspace security policy requires re-authentication");
            } else if (errorDesc.includes("Token has been expired")) {
              healthCheck.issues.push("Refresh token has expired");
            } else {
              healthCheck.issues.push(`Token refresh failed: ${errorDesc || errorType}`);
            }
          } else {
            healthCheck.issues.push(`Token error: ${errorType} - ${errorDesc}`);
          }
        } else {
          // Token is valid - update it while we're at it
          await supabase
            .from("gmail_credentials")
            .update({
              access_token: tokenData.access_token,
              token_expiry: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
              last_error: null,
            })
            .eq("id", credential.id);
        }
      } catch (tokenError: any) {
        healthCheck.tokenValid = false;
        healthCheck.healthy = false;
        healthCheck.issues.push(`Token check failed: ${tokenError.message}`);
      }

      // Update credential status in database
      await supabase
        .from("gmail_credentials")
        .update({
          needs_reauth: healthCheck.needsReauth,
          last_error: healthCheck.issues.length > 0 ? healthCheck.issues.join("; ") : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", credential.id);

      results.push(healthCheck);
    }

    const healthyCount = results.filter(r => r.healthy).length;
    const needsReauthCount = results.filter(r => r.needsReauth).length;

    console.log(`Health check complete: ${healthyCount}/${results.length} healthy, ${needsReauthCount} need reauth`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: results.length,
          healthy: healthyCount,
          needsReauth: needsReauthCount,
        },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in gmail-health-monitor:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
