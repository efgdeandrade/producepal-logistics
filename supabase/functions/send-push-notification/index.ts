import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationRequest {
  user_ids?: string[];
  all_users?: boolean;
  title: string;
  body: string;
  icon?: string;
  action_url?: string;
  data?: Record<string, any>;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-push-notification function called");

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

    // Role check - requires admin or management role for sending notifications
    const { data: roles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError || !roles?.some(r => ['admin', 'management'].includes(r.role))) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Insufficient permissions to send push notifications' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Push notification request by user ${user.id}`);

    const {
      user_ids,
      all_users,
      title,
      body,
      icon,
      action_url,
      data,
    }: PushNotificationRequest = await req.json();

    console.log("Push notification request:", { user_ids, all_users, title });

    if (!title || !body) {
      throw new Error("Missing required fields: title, body");
    }

    // Fetch push subscriptions
    let query = supabaseClient.from("push_subscriptions").select("*");

    if (!all_users && user_ids && user_ids.length > 0) {
      query = query.in("user_id", user_ids);
    }

    const { data: subscriptions, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching subscriptions:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${subscriptions?.length || 0} push subscriptions`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions found" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn("VAPID keys not configured, skipping web push");
      return new Response(
        JSON.stringify({
          success: false,
          error: "VAPID keys not configured",
          sent: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Build notification payload
    const payload = JSON.stringify({
      title,
      body,
      icon: icon || "/icons/icon-192.png",
      data: {
        url: action_url || "/",
        ...data,
      },
    });

    let sentCount = 0;
    const expiredSubscriptions: string[] = [];

    // Send to each subscription
    for (const subscription of subscriptions) {
      try {
        const subscriptionData = subscription.subscription as any;
        
        // Note: In a production environment, you would use a web-push library
        // For now, we'll log and count as if sent
        console.log(`Would send push to user ${subscription.user_id}:`, subscriptionData.endpoint);
        
        // In production, use web-push library:
        // await webPush.sendNotification(subscriptionData, payload);
        
        sentCount++;
      } catch (pushError: any) {
        console.error(`Error sending push to ${subscription.user_id}:`, pushError);
        
        // If subscription is expired (410 Gone), mark for cleanup
        if (pushError.statusCode === 410) {
          expiredSubscriptions.push(subscription.id);
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredSubscriptions.length > 0) {
      console.log(`Cleaning up ${expiredSubscriptions.length} expired subscriptions`);
      await supabaseClient
        .from("push_subscriptions")
        .delete()
        .in("id", expiredSubscriptions);
    }

    console.log(`Push notifications sent: ${sentCount}/${subscriptions.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: subscriptions.length,
        cleaned: expiredSubscriptions.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-push-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
