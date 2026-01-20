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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Parse Pub/Sub message
    const body = await req.json();
    console.log("Received Pub/Sub notification:", JSON.stringify(body));

    // Pub/Sub sends data in base64
    const message = body.message;
    if (!message || !message.data) {
      console.log("No message data, acknowledging");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode the notification
    const decodedData = atob(message.data);
    const notification = JSON.parse(decodedData);
    console.log("Decoded notification:", notification);

    const { emailAddress, historyId } = notification;

    if (!emailAddress) {
      console.log("No email address in notification");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find credentials for this email
    const { data: credentials, error: credError } = await supabase
      .from("gmail_credentials")
      .select("*")
      .eq("email_address", emailAddress)
      .eq("is_active", true)
      .single();

    if (credError || !credentials) {
      console.error("No active credentials found for:", emailAddress);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Refresh token if needed
    let accessToken = credentials.access_token;
    const expiresAt = new Date(credentials.token_expiry);
    if (expiresAt.getTime() - Date.now() < 60000) {
      console.log("Token expiring soon, refreshing...");
      const refreshResponse = await supabase.functions.invoke("gmail-refresh-token", {
        body: { credentialId: credentials.id },
      });
      if (refreshResponse.data?.accessToken) {
        accessToken = refreshResponse.data.accessToken;
      }
    }

    // Get recent messages using history API
    const lastHistoryId = credentials.history_id || historyId;
    console.log(`Fetching history from ${lastHistoryId}`);

    // Fetch recent messages from inbox (not just unread - check DB for processed status)
    const listResponse = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const listData = await listResponse.json();

    if (!listData.messages || listData.messages.length === 0) {
      console.log("No new messages");
      // Update history ID
      await supabase
        .from("gmail_credentials")
        .update({ history_id: historyId })
        .eq("id", credentials.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${listData.messages.length} unread messages`);

    // Process each message
    for (const msg of listData.messages) {
      // Check if already processed
      const { data: existing } = await supabase
        .from("email_inbox")
        .select("id")
        .eq("message_id", msg.id)
        .single();

      if (existing) {
        console.log(`Message ${msg.id} already processed`);
        continue;
      }

      // Fetch full message
      const msgResponse = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const msgData = await msgResponse.json();

      // Extract headers
      const headers = msgData.payload.headers.reduce((acc: Record<string, string>, h: { name: string; value: string }) => {
        acc[h.name.toLowerCase()] = h.value;
        return acc;
      }, {});

      const senderEmail = extractEmail(headers.from || "");
      const subject = headers.subject || "(No Subject)";
      const threadId = msgData.threadId;

      console.log(`Processing email from ${senderEmail}: ${subject}`);

      // Extract body
      const bodyText = extractBody(msgData.payload);

      // Extract and store attachments
      const attachments: { name: string; mimeType: string; storagePath: string }[] = [];
      const attachmentParts = findAttachments(msgData.payload);

      for (const part of attachmentParts) {
        if (part.body.attachmentId) {
          const attachmentResponse = await fetch(
            `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${part.body.attachmentId}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          const attachmentData = await attachmentResponse.json();
          const fileData = base64UrlDecode(attachmentData.data);

          // Store in Supabase Storage
          const fileName = `${msg.id}/${part.filename}`;
          const { error: uploadError } = await supabase.storage
            .from("email-attachments")
            .upload(fileName, fileData, {
              contentType: part.mimeType,
              upsert: true,
            });

          if (!uploadError) {
            attachments.push({
              name: part.filename,
              mimeType: part.mimeType,
              storagePath: fileName,
            });
            console.log(`Stored attachment: ${part.filename}`);
          } else {
            console.error(`Failed to store attachment: ${uploadError.message}`);
          }
        }
      }

      // Match sender to customer
      const { data: customer } = await supabase
        .from("distribution_customers")
        .select("id, name")
        .or(`whatsapp_phone.ilike.%${senderEmail}%,notes.ilike.%${senderEmail}%`)
        .limit(1)
        .single();

      // Insert into email_inbox
      const { data: emailRecord, error: insertError } = await supabase
        .from("email_inbox")
        .insert({
          message_id: msg.id,
          thread_id: threadId,
          from_email: senderEmail,
          from_name: extractName(headers.from || ""),
          to_email: headers.to || "",
          subject,
          body_text: bodyText,
          body_html: extractHtmlBody(msgData.payload),
          received_at: new Date(parseInt(msgData.internalDate)).toISOString(),
          matched_customer_id: customer?.id || null,
          status: "new",
        })
        .select()
        .single();

      // Store attachments in separate table
      if (attachments.length > 0 && emailRecord) {
        for (const attachment of attachments) {
          await supabase
            .from("email_inbox_attachments")
            .insert({
              email_id: emailRecord.id,
              file_name: attachment.name,
              mime_type: attachment.mimeType,
              storage_path: attachment.storagePath,
              file_size: 0,
            });
        }
      }

      if (insertError) {
        console.error(`Failed to insert email: ${insertError.message}`);
        continue;
      }

      console.log(`Email stored with ID: ${emailRecord.id}`);

      // Trigger order processing
      try {
        await supabase.functions.invoke("process-email-order", {
          body: { emailId: emailRecord.id },
        });
        console.log(`Order processing triggered for email ${emailRecord.id}`);
      } catch (processError) {
        console.error(`Failed to trigger processing: ${processError}`);
      }
    }

    // Update history ID
    await supabase
      .from("gmail_credentials")
      .update({ history_id: historyId })
      .eq("id", credentials.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in email-webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // Always return 200 to acknowledge Pub/Sub
    return new Response(JSON.stringify({ success: true, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

function extractName(from: string): string {
  const match = from.match(/^([^<]+)</);
  return match ? match[1].trim().replace(/"/g, "") : from;
}

function extractBody(payload: any): string {
  if (payload.body?.data) {
    return base64UrlDecodeString(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return base64UrlDecodeString(part.body.data);
      }
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
  }

  return "";
}

function extractHtmlBody(payload: any): string | null {
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return base64UrlDecodeString(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return base64UrlDecodeString(part.body.data);
      }
      if (part.parts) {
        const nested = extractHtmlBody(part);
        if (nested) return nested;
      }
    }
  }

  return null;
}

function findAttachments(payload: any, attachments: any[] = []): any[] {
  if (payload.filename && payload.filename.length > 0) {
    attachments.push(payload);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      findAttachments(part, attachments);
    }
  }

  return attachments;
}

function base64UrlDecodeString(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(base64);
  return decoded;
}

function base64UrlDecode(data: string): Uint8Array {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
