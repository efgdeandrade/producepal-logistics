import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateFunnyPassword(): string {
  // Multi-language fruit names (Papiamento, English, Dutch, Spanish)
  const fruits = [
    'Manggo', 'Papaya', 'Banana', 'Sandia', 'Limon', 'Parchita', 'Kas', 'Preimu',
    'Apple', 'Grape', 'Orange', 'Cherry', 'Peach', 'Melon', 'Berry', 'Kiwi',
    'Aardbei', 'Druif', 'Citroen', 'Ananas', 'Peer',
    'Naranja', 'Fresa', 'Uva', 'Manzana', 'Lima', 'Pina'
  ];
  
  const randomFruit = fruits[Math.floor(Math.random() * fruits.length)];
  const randomNumber = Math.floor(100 + Math.random() * 900); // 3-digit number (100-999)
  
  return `${randomFruit}${randomNumber}`;
}

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

    // Validate input
    if (!email || !fullName || !role) {
      throw new Error("Missing required fields: email, fullName, or role");
    }

    // Generate funny password
    const generatedPassword = generateFunnyPassword();
    console.log(`Creating user ${email} with password: ${generatedPassword}`);

    // Create user with generated password
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: generatedPassword,
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
    console.log(`User created with ID: ${userId}`);

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

    console.log(`User ${email} created successfully with role ${role}`);

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        email,
        password: generatedPassword,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error("Error in create-user-direct:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
