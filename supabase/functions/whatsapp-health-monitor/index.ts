import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'failed';
  response_time_ms: number;
  error_message?: string;
  error_code?: string;
  token_valid: boolean;
  phone_number_status?: string;
}

async function checkWhatsAppHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

  if (!accessToken || !phoneNumberId) {
    return {
      status: 'failed',
      response_time_ms: Date.now() - startTime,
      error_message: 'Missing WhatsApp credentials',
      error_code: 'MISSING_CREDENTIALS',
      token_valid: false,
    };
  }

  try {
    // Check phone number status via Meta Graph API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}?fields=verified_name,quality_rating,display_phone_number,messaging_limit_tier`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    const responseTime = Date.now() - startTime;
    const data = await response.json();

    if (!response.ok) {
      // Check for specific error codes
      const errorCode = data.error?.code?.toString() || 'UNKNOWN';
      const errorMessage = data.error?.message || 'Unknown error';
      
      // Token-related errors
      const tokenErrors = ['190', '102', '104', 'OAuthException'];
      const isTokenError = tokenErrors.some(code => 
        errorMessage.includes(code) || errorCode === code || data.error?.type === code
      );

      return {
        status: 'failed',
        response_time_ms: responseTime,
        error_message: errorMessage,
        error_code: errorCode,
        token_valid: !isTokenError,
      };
    }

    // Success - token is valid and API is responding
    return {
      status: 'healthy',
      response_time_ms: responseTime,
      token_valid: true,
      phone_number_status: data.quality_rating || 'unknown',
    };
  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Network error';
    return {
      status: 'failed',
      response_time_ms: responseTime,
      error_message: errorMessage,
      error_code: 'NETWORK_ERROR',
      token_valid: false,
    };
  }
}

async function sendAlertNotification(
  supabase: any,
  result: HealthCheckResult
): Promise<void> {
  try {
    // Check if we should send an alert (avoid alert fatigue)
    const { data: recentChecks } = await supabase
      .from('whatsapp_health_checks')
      .select('status, created_at')
      .order('created_at', { ascending: false })
      .limit(3);

    // If last 3 checks were failures, we've already alerted - skip
    if (recentChecks?.every((c: any) => c.status === 'failed')) {
      console.log('Already in failed state, skipping duplicate alert');
      return;
    }

    // Get admin users to notify
    const { data: adminUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'management']);

    if (!adminUsers?.length) {
      console.log('No admin users to notify');
      return;
    }

    // Create notifications for admins
    const notifications = adminUsers.map((user: any) => ({
      user_id: user.user_id,
      type: 'alert',
      title: '⚠️ WhatsApp API Alert',
      message: result.token_valid === false 
        ? `WhatsApp token is invalid: ${result.error_message}. Please update the access token.`
        : `WhatsApp API check failed: ${result.error_message}`,
      action_url: '/settings/integrations/whatsapp',
      is_read: false,
    }));

    const { error: notifyError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notifyError) {
      console.error('Failed to create notifications:', notifyError);
    } else {
      console.log(`Alert notifications sent to ${notifications.length} admins`);
    }
  } catch (error) {
    console.error('Error sending alert notification:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting WhatsApp health check...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Perform health check
    const result = await checkWhatsAppHealth();
    console.log('Health check result:', result);

    // Store the result
    const { error: insertError } = await supabase
      .from('whatsapp_health_checks')
      .insert({
        check_type: 'api_status',
        status: result.status,
        response_time_ms: result.response_time_ms,
        error_message: result.error_message,
        error_code: result.error_code,
        token_valid: result.token_valid,
        phone_number_status: result.phone_number_status,
      });

    if (insertError) {
      console.error('Failed to store health check result:', insertError);
    }

    // Send alert if check failed
    if (result.status === 'failed') {
      console.log('Health check failed, sending alert...');
      await sendAlertNotification(supabase, result);
    }

    // Cleanup old records (keep last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    await supabase
      .from('whatsapp_health_checks')
      .delete()
      .lt('created_at', sevenDaysAgo.toISOString());

    return new Response(
      JSON.stringify({
        success: true,
        result,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Health monitor error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
