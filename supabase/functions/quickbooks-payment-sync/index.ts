import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { data: tokenData } = await supabase
      .from('quickbooks_tokens')
      .select('*')
      .single();

    if (!tokenData) {
      return new Response(JSON.stringify({ error: 'QuickBooks not connected' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    const realmId = tokenData.realm_id;
    const baseUrl = tokenData.is_sandbox
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

    // Refresh access token
    const tokenResp = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=refresh_token&refresh_token=${tokenData.refresh_token}`,
    });

    const tokens = await tokenResp.json();
    if (!tokens.access_token) {
      return new Response(JSON.stringify({ error: 'Token refresh failed', details: tokens }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store rotated token
    await supabase.from('quickbooks_tokens').update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || tokenData.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('realm_id', realmId);

    const accessToken = tokens.access_token;

    // Get all invoices synced to QB
    const { data: syncedInvoices } = await supabase
      .from('distribution_invoices')
      .select('id, quickbooks_invoice_id, quickbooks_invoice_number, payment_status')
      .eq('quickbooks_sync_status', 'synced')
      .not('quickbooks_invoice_id', 'is', null);

    if (!syncedInvoices?.length) {
      return new Response(JSON.stringify({ synced: 0, checked: 0, updated: 0, message: 'No synced invoices to check' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let updated = 0;

    for (const invoice of syncedInvoices) {
      try {
        const qbResp = await fetch(
          `${baseUrl}/v3/company/${realmId}/invoice/${invoice.quickbooks_invoice_id}?minorversion=65`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          }
        );

        if (!qbResp.ok) continue;

        const qbData = await qbResp.json();
        const qbInvoice = qbData.Invoice;
        if (!qbInvoice) continue;

        const balance = parseFloat(qbInvoice.Balance || '0');
        const totalAmt = parseFloat(qbInvoice.TotalAmt || '0');

        let paymentStatus: string;
        if (balance === 0 && totalAmt > 0) {
          paymentStatus = 'paid';
        } else if (balance < totalAmt && balance > 0) {
          paymentStatus = 'partial';
        } else {
          paymentStatus = 'unpaid';
        }

        if (paymentStatus !== invoice.payment_status) {
          await supabase.from('distribution_invoices').update({
            payment_status: paymentStatus,
            paid_at: paymentStatus === 'paid' ? new Date().toISOString() : null,
            quickbooks_synced_at: new Date().toISOString(),
          }).eq('id', invoice.id);

          await supabase.from('distribution_orders').update({
            payment_status: paymentStatus,
            paid_at: paymentStatus === 'paid' ? new Date().toISOString() : null,
          }).eq('invoice_id', invoice.id);

          updated++;
          console.log(`Updated invoice ${invoice.quickbooks_invoice_number}: ${paymentStatus}`);
        }
      } catch (e) {
        console.error(`Failed to check invoice ${invoice.id}:`, e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      checked: syncedInvoices.length,
      updated,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('QB payment sync error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
