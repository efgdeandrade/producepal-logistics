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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { email, fullName, role } = await req.json();

    // Create user with admin API
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      throw createError;
    }

    if (!userData.user) {
      throw new Error("Failed to create user");
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userData.user.id,
        role: role,
      });

    if (roleError) {
      throw new Error(`Failed to assign role: ${roleError.message}`);
    }

    // Generate password reset link
    const { data: linkData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
      throw new Error(`Failed to generate reset link: ${resetError.message}`);
    }

    // Send invitation email via Resend API
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to FUIK!</h1>
            </div>
            <div class="content">
              <h2>Hello ${fullName},</h2>
              <p>You've been invited to join FUIK as a <strong>${role}</strong>.</p>
              <p>To get started, please set your password by clicking the button below:</p>
              <div style="text-align: center;">
                <a href="${linkData.properties.action_link}" class="button">Set Your Password</a>
              </div>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #6366f1;">${linkData.properties.action_link}</p>
              <p>This link will expire in 24 hours for security reasons.</p>
              <p>If you have any questions, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>© 2025 FUIK. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      },
      body: JSON.stringify({
        from: 'FUIK <onboarding@resend.dev>',
        to: [email],
        subject: 'Welcome to FUIK - Set Your Password',
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error("Error sending email:", errorData);
      throw new Error(`Failed to send invitation email: ${JSON.stringify(errorData)}`);
    }

    const emailData = await resendResponse.json();
    console.log(`Invitation email sent successfully to ${email}:`, emailData);

    return new Response(
      JSON.stringify({ success: true, userId: userData.user.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
