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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { folderId } = await req.json();
    if (!folderId) throw new Error("Missing folderId");

    // Get Gmail/Google credentials for this user
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: creds } = await adminClient
      .from("gmail_credentials")
      .select("access_token, token_expiry, refresh_token")
      .eq("id", user.id)
      .single();

    if (!creds) {
      return new Response(
        JSON.stringify({ files: [], error: "No Google credentials. Connect Google first." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh token if expired
    let accessToken = creds.access_token;
    if (creds.token_expiry && new Date(creds.token_expiry) < new Date()) {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
          client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
          refresh_token: creds.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        accessToken = tokenData.access_token;
        await adminClient
          .from("gmail_credentials")
          .update({
            access_token: accessToken,
            token_expiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          })
          .eq("id", user.id);
      }
    }

    // List files in folder
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,modifiedTime,size,webViewLink)&orderBy=modifiedTime+desc&pageSize=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const driveData = await driveRes.json();

    if (!driveRes.ok) {
      console.error("Drive API error:", driveData);
      return new Response(
        JSON.stringify({ files: [], error: driveData.error?.message || "Drive API error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ files: driveData.files || [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in list-drive-files:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
