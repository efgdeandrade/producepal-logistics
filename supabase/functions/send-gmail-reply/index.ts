import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function encodeBase64Url(str: string): string {
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

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

    const { emailId, to, cc, subject, body } = await req.json();

    if (!emailId || !to || !subject || !body) {
      throw new Error("Missing required fields: emailId, to, subject, body");
    }

    // Get the original email
    const { data: originalEmail, error: emailError } = await supabase
      .from("email_inbox")
      .select("*")
      .eq("id", emailId)
      .single();

    if (emailError || !originalEmail) {
      throw new Error("Original email not found");
    }

    // Get the Gmail credential
    const { data: credential, error: credError } = await supabase
      .from("gmail_credentials")
      .select("*")
      .eq("is_active", true)
      .single();

    if (credError || !credential) {
      throw new Error("No active Gmail credential found");
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

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
      throw new Error("Failed to refresh access token");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Build the MIME message
    const fromEmail = credential.email_address;
    const messageId = `<${crypto.randomUUID()}@${fromEmail.split("@")[1]}>`;
    const references = originalEmail.message_id 
      ? `${originalEmail.message_id}`
      : "";

    let mimeMessage = [
      `From: ${fromEmail}`,
      `To: ${to}`,
      cc ? `Cc: ${cc}` : null,
      `Subject: ${subject}`,
      `In-Reply-To: ${originalEmail.message_id}`,
      references ? `References: ${references}` : null,
      `Message-ID: ${messageId}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `MIME-Version: 1.0`,
      "",
      body,
    ]
      .filter(Boolean)
      .join("\r\n");

    // Encode the message for the Gmail API
    const encodedMessage = encodeBase64Url(mimeMessage);

    // Send via Gmail API
    const sendResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: encodedMessage,
          threadId: originalEmail.thread_id || undefined,
        }),
      }
    );

    if (!sendResponse.ok) {
      const error = await sendResponse.text();
      console.error("Gmail send failed:", error);
      throw new Error(`Failed to send email: ${error}`);
    }

    const sendData = await sendResponse.json();
    console.log("Email sent successfully:", sendData);

    // Store the sent reply in email_inbox
    const { error: insertError } = await supabase
      .from("email_inbox")
      .insert({
        message_id: messageId,
        thread_id: sendData.threadId || originalEmail.thread_id,
        from_email: fromEmail,
        from_name: "Me",
        to_email: to,
        subject: subject,
        body_text: body,
        received_at: new Date().toISOString(),
        status: "sent",
        is_reply: true,
        parent_email_id: emailId,
        reply_sent_at: new Date().toISOString(),
        reply_message_id: sendData.id,
      });

    if (insertError) {
      console.error("Failed to store sent reply:", insertError);
      // Don't throw - the email was sent successfully
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: sendData.id,
        threadId: sendData.threadId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-gmail-reply:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
