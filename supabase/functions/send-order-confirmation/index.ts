import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { orderId, emailId, templateId } = await req.json();

    if (!orderId) {
      throw new Error("orderId is required");
    }

    console.log(`Sending confirmation for order: ${orderId}`);

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("distribution_orders")
      .select(`
        *,
        customer:distribution_customers(id, name, whatsapp_phone),
        items:distribution_order_items(
          id,
          quantity,
          order_unit,
          unit_price_xcg,
          total_xcg,
          product:distribution_products(id, name, sku)
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    // Get email details
    let email: any = null;
    if (emailId) {
      const { data } = await supabase
        .from("email_inbox")
        .select("*")
        .eq("id", emailId)
        .single();
      email = data;
    } else if (order.source_email_id) {
      const { data } = await supabase
        .from("email_inbox")
        .select("*")
        .eq("id", order.source_email_id)
        .single();
      email = data;
    }

    if (!email) {
      throw new Error("No source email found for order");
    }

    // Get template
    const { data: template } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", templateId || "default-confirmation")
      .single();

    const defaultTemplate = {
      subject: "Order Confirmation - {order_number}",
      body_html: `
        <h2>Order Confirmation</h2>
        <p>Dear {customer_name},</p>
        <p>Thank you for your order. We have received the following:</p>
        <p><strong>Order Number:</strong> {order_number}</p>
        <p><strong>Delivery Date:</strong> {delivery_date}</p>
        {po_number_section}
        <h3>Order Items:</h3>
        {items_table}
        <p><strong>Total:</strong> ${"{total}"} XCG</p>
        <p>If you have any questions, please reply to this email.</p>
        <p>Best regards,<br>ProducePal Team</p>
      `,
    };

    const templateToUse = template || defaultTemplate;

    // Build items table
    const itemsTable = `
      <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Product</th>
            <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">Qty</th>
            <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Unit</th>
            <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">Price</th>
            <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map((item: any) => `
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${item.product?.name || "Unknown"}</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">${item.quantity}</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${item.order_unit || "cs"}</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">$${item.unit_price_xcg?.toFixed(2) || "0.00"}</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">$${item.total_xcg?.toFixed(2) || "0.00"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    // Replace template variables
    const poSection = order.po_number 
      ? `<p><strong>PO Number:</strong> ${order.po_number}</p>` 
      : "";

    let emailSubject = templateToUse.subject
      .replace("{order_number}", order.order_number)
      .replace("{customer_name}", order.customer?.name || "Customer");

    let emailBody = templateToUse.body_html
      .replace("{customer_name}", order.customer?.name || "Valued Customer")
      .replace("{order_number}", order.order_number)
      .replace("{delivery_date}", order.delivery_date || "To be confirmed")
      .replace("{po_number_section}", poSection)
      .replace("{items_table}", itemsTable)
      .replace("{total}", order.total_xcg?.toFixed(2) || "0.00");

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "ProducePal <orders@fuik.co>",
      to: [email.sender_email],
      subject: `Re: ${email.subject}`,
      html: emailBody,
      headers: {
        "In-Reply-To": email.gmail_message_id,
        "References": email.gmail_message_id,
      },
    });

    console.log("Email sent successfully:", emailResponse);

    // Update email status
    await supabase
      .from("email_inbox")
      .update({
        status: "confirmed",
        confirmation_sent_at: new Date().toISOString(),
      })
      .eq("id", email.id);

    // Update order status
    await supabase
      .from("distribution_orders")
      .update({ status: "confirmed" })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({
        success: true,
        emailId: emailResponse.data?.id || "sent",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-order-confirmation:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
