import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  to: string;
  template: "order_confirmation" | "delivery_update" | "alert" | "digest";
  data: Record<string, any>;
}

const templates = {
  order_confirmation: (data: Record<string, any>) => ({
    subject: `Order Confirmation - ${data.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Order Confirmed</h1>
        <p>Your order <strong>${data.orderNumber}</strong> has been received and is being processed.</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Customer:</strong> ${data.customerName}</p>
          <p style="margin: 8px 0 0;"><strong>Delivery Date:</strong> ${data.deliveryDate}</p>
          <p style="margin: 8px 0 0;"><strong>Items:</strong> ${data.itemCount} items</p>
          <p style="margin: 8px 0 0;"><strong>Total:</strong> $${data.total}</p>
        </div>
        <p>Thank you for your order!</p>
      </div>
    `,
  }),
  delivery_update: (data: Record<string, any>) => ({
    subject: `Delivery Update - ${data.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Delivery Update</h1>
        <p>Your order <strong>${data.orderNumber}</strong> status has been updated.</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Status:</strong> ${data.status}</p>
          ${data.driverName ? `<p style="margin: 8px 0 0;"><strong>Driver:</strong> ${data.driverName}</p>` : ""}
          ${data.estimatedTime ? `<p style="margin: 8px 0 0;"><strong>Estimated Time:</strong> ${data.estimatedTime}</p>` : ""}
        </div>
        ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ""}
      </div>
    `,
  }),
  alert: (data: Record<string, any>) => ({
    subject: `[${data.severity?.toUpperCase() || "ALERT"}] ${data.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${data.severity === "critical" ? "#dc2626" : data.severity === "warning" ? "#f59e0b" : "#2563eb"}; color: white; padding: 16px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">${data.title}</h1>
        </div>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 0 0 8px 8px;">
          <p>${data.message}</p>
          ${data.actionUrl ? `<a href="${data.actionUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Details</a>` : ""}
        </div>
      </div>
    `,
  }),
  digest: (data: Record<string, any>) => ({
    subject: `Daily Summary - ${data.date}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Daily Summary</h1>
        <p>Here's your daily summary for ${data.date}:</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Orders:</strong> ${data.ordersCount}</p>
          <p style="margin: 8px 0 0;"><strong>Deliveries:</strong> ${data.deliveriesCount}</p>
          <p style="margin: 8px 0 0;"><strong>Revenue:</strong> $${data.revenue}</p>
          ${data.alerts > 0 ? `<p style="margin: 8px 0 0; color: #dc2626;"><strong>Alerts:</strong> ${data.alerts}</p>` : ""}
        </div>
      </div>
    `,
  }),
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-notification-email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Role check - requires admin or management role for sending emails
    const { data: roles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError || !roles?.some(r => ['admin', 'management'].includes(r.role))) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Insufficient permissions to send notification emails' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Notification email request by user ${user.id}`);

    const { to, template, data }: NotificationEmailRequest = await req.json();
    console.log(`Sending ${template} email to ${to}`);

    if (!to || !template) {
      throw new Error("Missing required fields: to, template");
    }

    const templateFn = templates[template];
    if (!templateFn) {
      throw new Error(`Unknown template: ${template}`);
    }

    const emailContent = templateFn(data);

    const emailResponse = await resend.emails.send({
      from: "Notifications <onboarding@resend.dev>",
      to: [to],
      subject: emailContent.subject,
      html: emailContent.html,
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the email send to the database using supabaseClient from above

    await supabaseClient.from("activity_log").insert({
      action: "email_sent",
      entity_type: "notification",
      details: {
        to,
        template,
        subject: emailContent.subject,
      },
    });

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-notification-email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
