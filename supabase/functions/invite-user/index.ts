import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Allowed origins for CORS - production and staging domains
const allowedOrigins = [
  'https://fuik.io',
  'https://www.fuik.io',
  'https://dnxzpkbobzwjcuyfgdnh.lovable.app'
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

// Default CORS headers for preflight
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigins[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const inviteUserSchema = z.object({
  email: z.string().email("Invalid email format").max(255, "Email too long"),
  fullName: z.string().min(2, "Name too short").max(100, "Name too long"),
  role: z.enum(['admin', 'management', 'driver', 'production', 'logistics', 'accounting', 'manager'], {
    errorMap: () => ({ message: "Invalid role" })
  }),
});

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

    // Get and verify the JWT token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Unauthorized: No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized: Invalid token");
    }

    // Check if user has admin role
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      throw new Error("Error checking user roles");
    }

    if (!roles?.some(r => r.role === 'admin')) {
      throw new Error("Forbidden: Admin access required");
    }

    // Validate input
    const body = await req.json();
    const { email, fullName, role } = inviteUserSchema.parse(body);

    console.log(`Admin ${user.id} inviting user: ${email}`);

    // Try to create user with admin API
    let createResult = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    // If user already exists (soft-deleted), hard delete them first and retry
    if (createResult.error && createResult.error.message.includes('already been registered')) {
      console.log(`User with email ${email} already exists (likely soft-deleted). Attempting hard delete...`);
      
      // List all users and find the one with this email
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (listError) {
        console.error("Error listing users:", listError);
        throw new Error(`Failed to check existing users: ${listError.message}`);
      }

      const existingUser = users.find(u => u.email === email);
      
      if (existingUser) {
        console.log(`Found existing user ${existingUser.id}, performing hard delete...`);
        
        // Hard delete the existing user (second parameter: false = hard delete)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id, false);
        
        if (deleteError) {
          console.error("Error hard deleting existing user:", deleteError);
          throw new Error(`Failed to remove existing user: ${deleteError.message}`);
        }
        
        console.log(`Successfully hard deleted user ${existingUser.id}. Retrying creation...`);
        
        // Retry creating the user
        createResult = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
          },
        });
        
        console.log(`User creation retry result:`, { hasUser: !!createResult.data?.user, hasError: !!createResult.error });
      } else {
        throw new Error(`User with email ${email} is registered but could not be found for cleanup`);
      }
    }
    
    if (createResult.error) {
      console.error("Final creation error:", createResult.error);
      throw createResult.error;
    }

    if (!createResult.data?.user) {
      console.error("No user in response despite no error:", createResult);
      throw new Error("Failed to create user - no user data returned");
    }

    const userData = createResult.data.user;

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userData.id,
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
      JSON.stringify({ success: true, userId: userData.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const status = errorMessage.includes('Unauthorized') ? 401 
                 : errorMessage.includes('Forbidden') ? 403
                 : 400;
    
    console.error("Error in invite-user function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      }
    );
  }
});
