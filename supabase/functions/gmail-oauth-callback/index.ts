import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_PUBSUB_TOPIC = Deno.env.get("GOOGLE_PUBSUB_TOPIC");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const APP_URL = Deno.env.get("APP_URL") || "https://producepal-logistics.lovable.app";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("OAuth error from Google:", error);
      return Response.redirect(`${APP_URL}/distribution/settings?gmail_error=${error}`);
    }

    if (!code || !state) {
      console.error("Missing code or state");
      return Response.redirect(`${APP_URL}/distribution/settings?gmail_error=missing_params`);
    }

    // Decode state to get user ID
    let userId: string;
    try {
      const stateData = JSON.parse(atob(state));
      userId = stateData.userId;
    } catch (e) {
      console.error("Failed to decode state:", e);
      return Response.redirect(`${APP_URL}/distribution/settings?gmail_error=invalid_state`);
    }

    console.log(`Processing OAuth callback for user: ${userId}`);

    // Exchange code for tokens
    const redirectUri = `${SUPABASE_URL}/functions/v1/gmail-oauth-callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", tokenData);
      return Response.redirect(`${APP_URL}/distribution/settings?gmail_error=token_exchange_failed`);
    }

    console.log("Token exchange successful");

    // Get user email from Gmail API
    const profileResponse = await fetch("https://www.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profileData = await profileResponse.json();
    const emailAddress = profileData.emailAddress;

    console.log(`Gmail account: ${emailAddress}`);

    // Store credentials in database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const { error: upsertError } = await supabase
      .from("gmail_credentials")
      .upsert({
        user_id: userId,
        email_address: emailAddress,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id",
      });

    if (upsertError) {
      console.error("Failed to store credentials:", upsertError);
      return Response.redirect(`${APP_URL}/distribution/settings?gmail_error=storage_failed`);
    }

    console.log("Credentials stored successfully");

    // Set up Gmail push notifications
    const watchResponse = await fetch("https://www.googleapis.com/gmail/v1/users/me/watch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topicName: GOOGLE_PUBSUB_TOPIC,
        labelIds: ["INBOX"],
      }),
    });

    const watchData = await watchResponse.json();

    if (!watchResponse.ok) {
      console.error("Failed to set up watch:", watchData);
      // Don't fail - we can set up watch later
    } else {
      console.log("Gmail watch set up successfully, expires:", watchData.expiration);

      // Store watch expiration
      await supabase
        .from("gmail_credentials")
        .update({
          watch_expiration: new Date(parseInt(watchData.expiration)).toISOString(),
        })
        .eq("user_id", userId);
    }

    console.log("OAuth flow completed successfully");
    return Response.redirect(`${APP_URL}/distribution/settings?gmail_connected=true`);
  } catch (error) {
    console.error("Error in gmail-oauth-callback:", error);
    const APP_URL = Deno.env.get("APP_URL") || "https://producepal-logistics.lovable.app";
    return Response.redirect(`${APP_URL}/distribution/settings?gmail_error=unexpected`);
  }
});
