import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ProcessAlertRequest {
  event_type?: string;
  entity_type?: string;
  entity_id?: string;
  entity_data?: Record<string, any>;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("process-alert-rules function called");

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

    // Role check - requires admin or management role for processing alerts
    const { data: roles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError || !roles?.some(r => ['admin', 'management'].includes(r.role))) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Insufficient permissions to process alert rules' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Alert rules processing initiated by user ${user.id}`);

    const requestData: ProcessAlertRequest = await req.json();
    console.log("Processing alerts for:", requestData);

    // Fetch active alert rules
    const { data: rules, error: rulesError2 } = await supabaseClient
      .from("alert_rules")
      .select("*")
      .eq("is_active", true);

    if (rulesError2) {
      console.error("Error fetching alert rules:", rulesError2);
      throw rulesError2;
    }

    console.log(`Found ${rules?.length || 0} active alert rules`);

    const triggeredRules: string[] = [];
    const results: any[] = [];

    for (const rule of rules || []) {
      let shouldTrigger = false;
      let triggerReason = "";

      const config = rule.trigger_config as Record<string, any>;

      // Evaluate rule based on trigger type
      switch (rule.trigger_type) {
        case "event_based":
          if (config.event_type === requestData.event_type) {
            shouldTrigger = true;
            triggerReason = `Event: ${requestData.event_type}`;
          }
          break;

        case "threshold":
          if (
            requestData.entity_type === config.entity &&
            requestData.entity_data
          ) {
            const fieldValue = requestData.entity_data[config.field];
            const threshold = parseFloat(config.value);

            if (config.operator === "greater_than" && fieldValue > threshold) {
              shouldTrigger = true;
              triggerReason = `${config.field} (${fieldValue}) > ${threshold}`;
            } else if (config.operator === "less_than" && fieldValue < threshold) {
              shouldTrigger = true;
              triggerReason = `${config.field} (${fieldValue}) < ${threshold}`;
            } else if (config.operator === "equals" && fieldValue === threshold) {
              shouldTrigger = true;
              triggerReason = `${config.field} equals ${threshold}`;
            }
          }
          break;

        case "time_based":
          // Time-based alerts would typically be triggered by a cron job
          // checking for inactivity
          break;
      }

      if (shouldTrigger) {
        console.log(`Rule "${rule.name}" triggered: ${triggerReason}`);
        triggeredRules.push(rule.id);

        // Create notifications for each recipient
        const recipients = rule.recipients as Record<string, any>;
        const userIds: string[] = recipients.user_ids || [];

        // If role-based, fetch users with those roles
        if (recipients.roles && recipients.roles.length > 0) {
          const { data: roleUsers } = await supabaseClient
            .from("user_roles")
            .select("user_id")
            .in("role", recipients.roles);

          if (roleUsers) {
            userIds.push(...roleUsers.map((r) => r.user_id));
          }
        }

        // Remove duplicates
        const uniqueUserIds = [...new Set(userIds)];
        let notificationsSent = 0;

        // Create in-app notifications
        if (rule.notification_channels.includes("in_app")) {
          const notifications = uniqueUserIds.map((userId) => ({
            user_id: userId,
            type: "alert",
            title: rule.name,
            message: `Alert triggered: ${triggerReason}`,
            severity: "warning",
            related_entity_type: requestData.entity_type,
            related_entity_id: requestData.entity_id,
            metadata: {
              rule_id: rule.id,
              trigger_reason: triggerReason,
              entity_data: requestData.entity_data,
            },
          }));

          if (notifications.length > 0) {
            const { error: notifError } = await supabaseClient
              .from("notifications")
              .insert(notifications);

            if (notifError) {
              console.error("Error creating notifications:", notifError);
            } else {
              notificationsSent += notifications.length;
            }
          }
        }

        // Trigger email notifications
        if (rule.notification_channels.includes("email")) {
          // Get user emails
          const { data: profiles } = await supabaseClient
            .from("profiles")
            .select("email")
            .in("id", uniqueUserIds);

          if (profiles) {
            for (const profile of profiles) {
              if (profile.email) {
                try {
                  await supabaseClient.functions.invoke("send-notification-email", {
                    body: {
                      to: profile.email,
                      template: "alert",
                      data: {
                        title: rule.name,
                        message: `Alert triggered: ${triggerReason}`,
                        severity: "warning",
                      },
                    },
                  });
                  notificationsSent++;
                } catch (emailError) {
                  console.error("Error sending email:", emailError);
                }
              }
            }
          }
        }

        // Trigger push notifications
        if (rule.notification_channels.includes("push")) {
          try {
            await supabaseClient.functions.invoke("send-push-notification", {
              body: {
                user_ids: uniqueUserIds,
                title: rule.name,
                body: `Alert: ${triggerReason}`,
              },
            });
            notificationsSent++;
          } catch (pushError) {
            console.error("Error sending push:", pushError);
          }
        }

        // Log the execution
        const { error: execError } = await supabaseClient
          .from("alert_executions")
          .insert({
            alert_rule_id: rule.id,
            triggered_by: triggerReason,
            trigger_data: requestData,
            notifications_sent: notificationsSent,
            status: notificationsSent > 0 ? "success" : "partial",
          });

        if (execError) {
          console.error("Error logging execution:", execError);
        }

        // Update last triggered timestamp
        await supabaseClient
          .from("alert_rules")
          .update({ last_triggered_at: new Date().toISOString() })
          .eq("id", rule.id);

        results.push({
          rule_id: rule.id,
          rule_name: rule.name,
          triggered: true,
          reason: triggerReason,
          notifications_sent: notificationsSent,
        });
      }
    }

    console.log(`Processed ${rules?.length || 0} rules, triggered ${triggeredRules.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        rules_processed: rules?.length || 0,
        rules_triggered: triggeredRules.length,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in process-alert-rules:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
