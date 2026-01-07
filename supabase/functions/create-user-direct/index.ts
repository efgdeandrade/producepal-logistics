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
const createUserSchema = z.object({
  email: z.string().email("Invalid email format").max(255, "Email too long"),
  fullName: z.string().min(2, "Name too short").max(100, "Name too long"),
  role: z.enum(['admin', 'management', 'driver', 'production', 'logistics', 'accounting', 'manager'], {
    errorMap: () => ({ message: "Invalid role" })
  }),
});

// Generate a secure random password for initial account creation (never exposed)
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  for (let i = 0; i < 24; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAdmin = createClient(
      supabaseUrl,
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
    const { email, fullName, role } = createUserSchema.parse(body);

    // Generate secure password for initial account creation (never exposed to anyone)
    const securePassword = generateSecurePassword();

    // Create user with secure password (will be reset via link)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: securePassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
      },
    });

    if (authError) {
      console.error("Error creating user:", authError);
      throw authError;
    }

    const userId = authData.user.id;

    // Set must_change_password = true in profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', userId);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      throw profileError;
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: role,
      });

    if (roleError) {
      console.error("Error assigning role:", roleError);
      throw roleError;
    }

    // Generate password reset link instead of returning password
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    });

    if (linkError) {
      console.error("Error generating reset link:", linkError);
      throw new Error("User created but failed to generate password reset link");
    }

    // Extract the token from the link and construct a proper reset URL
    const resetToken = linkData.properties?.hashed_token;
    const resetLink = resetToken 
      ? `${supabaseUrl}/auth/v1/verify?token=${resetToken}&type=recovery&redirect_to=${encodeURIComponent(supabaseUrl)}`
      : linkData.properties?.action_link;

    console.log(`User ${email} created successfully by admin ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        email,
        resetLink: linkData.properties?.action_link || resetLink,
      }),
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
    
    console.error("Error in create-user-direct:", errorMessage);
    
    // Return generic errors for 400, specific for auth issues
    const clientMessage = status === 401 ? 'Authentication required' :
                          status === 403 ? 'Forbidden: Admin access required' :
                          'Failed to create user. Please check input and try again.';
    
    return new Response(
      JSON.stringify({ error: clientMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      }
    );
  }
});
