import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvoiceItem {
  product_name: string;
  description: string | null;
  quantity: number;
  unit_price_xcg: number;
  line_total_xcg: number;
  is_ob_eligible: boolean;
}

interface Invoice {
  id: string;
  invoice_date: string;
  due_date: string;
  customer_memo: string | null;
  total_xcg: number;
  fnb_customers: {
    name: string;
    whatsapp_phone: string;
    address: string | null;
  };
  fnb_invoice_items: InvoiceItem[];
}

// Get the correct QuickBooks API base URL based on environment
function getQuickBooksBaseUrl(isSandbox: boolean): string {
  return isSandbox 
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { invoice_id } = await req.json();
    
    if (!invoice_id) {
      throw new Error('Invoice ID is required');
    }

    console.log('QuickBooks invoice sync requested for:', invoice_id);

    // Fetch invoice with customer and items
    const { data: invoice, error: invoiceError } = await supabase
      .from('fnb_invoices')
      .select(`
        *,
        fnb_customers (name, whatsapp_phone, address),
        fnb_invoice_items (*)
      `)
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found');
    }

    // Check if invoice is in confirmed status
    if (invoice.status !== 'confirmed' && invoice.status !== 'failed') {
      throw new Error('Invoice must be confirmed before syncing');
    }

    // Get QuickBooks credentials from secrets
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    const configuredRealmId = Deno.env.get('QUICKBOOKS_REALM_ID');

    // Check for OAuth tokens in database
    const { data: tokenData, error: tokenError } = await supabase
      .from('quickbooks_tokens')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (tokenError) {
      console.error('Error fetching QuickBooks tokens:', tokenError);
      throw new Error('Failed to retrieve QuickBooks tokens');
    }

    // If no tokens, simulate sync for development
    if (!tokenData || !clientId || !clientSecret) {
      console.log('QuickBooks not connected or credentials missing, simulating sync...');
      
      // Generate a mock QB invoice number
      const mockInvoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
      
      // Update invoice as synced
      const { error: updateError } = await supabase
        .from('fnb_invoices')
        .update({
          status: 'synced',
          quickbooks_invoice_id: `mock-${invoice_id.slice(0, 8)}`,
          quickbooks_invoice_number: mockInvoiceNumber,
          quickbooks_sync_status: 'synced',
          quickbooks_synced_at: new Date().toISOString(),
          quickbooks_sync_error: null,
        })
        .eq('id', invoice_id);

      if (updateError) throw updateError;

      // Log activity
      await supabase.from('fnb_invoice_activity').insert({
        invoice_id,
        action: 'synced',
        details: { 
          quickbooks_invoice_number: mockInvoiceNumber,
          simulated: true,
          reason: !tokenData ? 'QuickBooks not connected' : 'Missing client credentials'
        },
      });

      // Log to quickbooks_sync_log
      await supabase.from('quickbooks_sync_log').insert({
        entity_type: 'invoice',
        status: 'success',
        records_synced: 1,
        sync_direction: 'export',
      });

      return new Response(JSON.stringify({
        success: true,
        quickbooks_invoice_id: `mock-${invoice_id.slice(0, 8)}`,
        quickbooks_invoice_number: mockInvoiceNumber,
        message: 'Invoice synced (simulated - QuickBooks not connected)',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use realm ID from token or config
    const realmId = tokenData.realm_id || configuredRealmId;
    let refreshToken = tokenData.refresh_token;
    
    // Determine if this is a sandbox connection (default to true for safety)
    const isSandbox = tokenData.is_sandbox !== false;
    const baseUrl = getQuickBooksBaseUrl(isSandbox);
    
    console.log('Using QuickBooks environment:', isSandbox ? 'SANDBOX' : 'PRODUCTION');
    console.log('API Base URL:', baseUrl);

    try {
      // Step 1: Refresh the access token
      console.log('Refreshing access token...');
      const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token refresh failed:', tokenResponse.status, errorText);
        throw new Error(`Token refresh failed: ${errorText}`);
      }

      const tokens = await tokenResponse.json();
      const accessToken = tokens.access_token;
      console.log('Access token refreshed successfully');
      
      // IMPORTANT: Store the new refresh token (QuickBooks rotates tokens)
      if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
        console.log('Storing rotated refresh token...');
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + (tokens.expires_in || 3600));
        
        await supabase
          .from('quickbooks_tokens')
          .update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('realm_id', realmId);
      }

      // Step 2: Look up customer by name
      const customerName = invoice.fnb_customers?.name;
      console.log('Looking up customer:', customerName);
      
      // Escape single quotes in customer name for the query
      const escapedCustomerName = customerName?.replace(/'/g, "\\'") || '';
      const customerQuery = encodeURIComponent(`select * from Customer where DisplayName = '${escapedCustomerName}'`);
      
      const customerUrl = `${baseUrl}/v3/company/${realmId}/query?query=${customerQuery}`;
      console.log('Customer query URL:', customerUrl);
      
      const customerResponse = await fetch(customerUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!customerResponse.ok) {
        const errorBody = await customerResponse.text();
        console.error('Customer lookup HTTP error:', customerResponse.status, errorBody);
        throw new Error(`Customer lookup failed (HTTP ${customerResponse.status}): ${errorBody}`);
      }

      const customerData = await customerResponse.json();
      console.log('Customer query response:', JSON.stringify(customerData, null, 2));
      
      const customers = customerData.QueryResponse?.Customer || [];
      
      if (customers.length === 0) {
        throw new Error(`Customer "${customerName}" not found in QuickBooks. Please create the customer first or check the exact spelling matches.`);
      }

      const qbCustomer = customers[0];
      console.log('Found customer in QuickBooks:', qbCustomer.DisplayName, 'ID:', qbCustomer.Id);

      // Step 3: Build line items (look up products)
      const lineItems = [];
      const missingProducts: string[] = [];

      for (const item of invoice.fnb_invoice_items || []) {
        const escapedProductName = item.product_name?.replace(/'/g, "\\'") || '';
        const productQuery = encodeURIComponent(`select * from Item where Name = '${escapedProductName}'`);
        
        const productUrl = `${baseUrl}/v3/company/${realmId}/query?query=${productQuery}`;
        console.log('Product query for:', item.product_name);
        
        const productResponse = await fetch(productUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (productResponse.ok) {
          const productData = await productResponse.json();
          const products = productData.QueryResponse?.Item || [];
          
          if (products.length > 0) {
            console.log('Found product in QuickBooks:', products[0].Name, 'ID:', products[0].Id);
            lineItems.push({
              DetailType: 'SalesItemLineDetail',
              Amount: item.line_total_xcg,
              Description: item.description || undefined,
              SalesItemLineDetail: {
                ItemRef: { value: products[0].Id },
                Qty: item.quantity,
                UnitPrice: item.unit_price_xcg,
              },
            });
          } else {
            console.warn('Product not found in QuickBooks:', item.product_name);
            missingProducts.push(item.product_name);
          }
        } else {
          const errorBody = await productResponse.text();
          console.error('Product lookup HTTP error for', item.product_name, ':', productResponse.status, errorBody);
          missingProducts.push(item.product_name);
        }
      }

      if (missingProducts.length > 0) {
        throw new Error(`Missing products in QuickBooks: ${missingProducts.join(', ')}. Please create these items in QuickBooks first.`);
      }

      // Step 4: Create invoice
      console.log('Creating invoice in QuickBooks...');
      const invoicePayload = {
        CustomerRef: { value: qbCustomer.Id },
        TxnDate: invoice.invoice_date,
        DueDate: invoice.due_date,
        CurrencyRef: { value: 'XCG' },
        CustomerMemo: invoice.customer_memo ? { value: invoice.customer_memo } : undefined,
        Line: lineItems,
      };

      console.log('Invoice payload:', JSON.stringify(invoicePayload, null, 2));

      const createUrl = `${baseUrl}/v3/company/${realmId}/invoice`;
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(invoicePayload),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Invoice creation failed:', createResponse.status, errorText);
        throw new Error(`Failed to create invoice (HTTP ${createResponse.status}): ${errorText}`);
      }

      const createdInvoice = await createResponse.json();
      const qbInvoiceId = createdInvoice.Invoice?.Id;
      const qbInvoiceNumber = createdInvoice.Invoice?.DocNumber;
      
      console.log('Invoice created successfully! QB ID:', qbInvoiceId, 'Number:', qbInvoiceNumber);

      // Step 5: Update our invoice with QB details
      await supabase
        .from('fnb_invoices')
        .update({
          status: 'synced',
          quickbooks_invoice_id: qbInvoiceId,
          quickbooks_invoice_number: qbInvoiceNumber,
          quickbooks_sync_status: 'synced',
          quickbooks_synced_at: new Date().toISOString(),
          quickbooks_sync_error: null,
        })
        .eq('id', invoice_id);

      // Log activity
      await supabase.from('fnb_invoice_activity').insert({
        invoice_id,
        action: 'synced',
        details: { 
          quickbooks_invoice_id: qbInvoiceId,
          quickbooks_invoice_number: qbInvoiceNumber,
          environment: isSandbox ? 'sandbox' : 'production',
        },
      });

      // Log to quickbooks_sync_log
      await supabase.from('quickbooks_sync_log').insert({
        entity_type: 'invoice',
        status: 'success',
        records_synced: 1,
        sync_direction: 'export',
      });

      return new Response(JSON.stringify({
        success: true,
        quickbooks_invoice_id: qbInvoiceId,
        quickbooks_invoice_number: qbInvoiceNumber,
        environment: isSandbox ? 'sandbox' : 'production',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (qbError: any) {
      console.error('QuickBooks API error:', qbError);

      // Update invoice with error
      await supabase
        .from('fnb_invoices')
        .update({
          status: 'failed',
          quickbooks_sync_status: 'failed',
          quickbooks_sync_error: qbError.message,
        })
        .eq('id', invoice_id);

      // Log activity
      await supabase.from('fnb_invoice_activity').insert({
        invoice_id,
        action: 'sync_failed',
        details: { error: qbError.message },
      });

      // Log to quickbooks_sync_log
      await supabase.from('quickbooks_sync_log').insert({
        entity_type: 'invoice',
        status: 'error',
        records_synced: 0,
        sync_direction: 'export',
      });

      throw qbError;
    }

  } catch (error: unknown) {
    console.error('Invoice sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
