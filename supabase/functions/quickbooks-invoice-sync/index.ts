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
  product_id?: string;
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

// Normalize names for matching (trim, collapse spaces, case-insensitive ready)
function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ');
}

// Get the correct QuickBooks API base URL based on environment
function getQuickBooksBaseUrl(isSandbox: boolean): string {
  return isSandbox 
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';
}

// Look up an item in QuickBooks with normalized matching
async function findItemInQuickBooks(
  itemName: string,
  accessToken: string,
  baseUrl: string,
  realmId: string
): Promise<{ Id: string; Name: string } | null> {
  const normalizedSearchName = normalizeName(itemName).toLowerCase();
  
  // First try exact name match
  const escapedName = itemName.replace(/'/g, "\\'");
  const exactQuery = encodeURIComponent(`select * from Item where Name = '${escapedName}'`);
  
  try {
    const response = await fetch(`${baseUrl}/v3/company/${realmId}/query?query=${exactQuery}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      const items = data.QueryResponse?.Item || [];
      if (items.length > 0) {
        console.log('Found item with exact match:', items[0].Name, 'ID:', items[0].Id);
        return items[0];
      }
    }
  } catch (e) {
    console.warn('Exact match query failed:', e);
  }
  
  // Try normalized matching - fetch all items and compare
  console.log('Exact match failed, trying normalized search for:', itemName);
  const allItemsQuery = encodeURIComponent(`select * from Item MAXRESULTS 1000`);
  
  try {
    const response = await fetch(`${baseUrl}/v3/company/${realmId}/query?query=${allItemsQuery}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      const items = data.QueryResponse?.Item || [];
      
      // Find with normalized comparison
      const match = items.find((item: any) => 
        normalizeName(item.Name).toLowerCase() === normalizedSearchName
      );
      
      if (match) {
        console.log('Found item with normalized match:', match.Name, 'ID:', match.Id);
        return match;
      }
    }
  } catch (e) {
    console.warn('Normalized search failed:', e);
  }
  
  return null;
}

// Create a new item in QuickBooks
async function createItemInQuickBooks(
  itemName: string,
  description: string | null,
  accessToken: string,
  baseUrl: string,
  realmId: string
): Promise<{ Id: string; Name: string }> {
  // First, get the default income account (required for items)
  console.log('Fetching income account for new item...');
  
  let incomeAccountRef = { value: '1', name: 'Sales' }; // Default fallback
  
  try {
    const accountQuery = encodeURIComponent(`select * from Account where AccountType = 'Income' MAXRESULTS 1`);
    const accountResponse = await fetch(`${baseUrl}/v3/company/${realmId}/query?query=${accountQuery}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    
    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      const accounts = accountData.QueryResponse?.Account || [];
      if (accounts.length > 0) {
        incomeAccountRef = { value: accounts[0].Id, name: accounts[0].Name };
        console.log('Using income account:', incomeAccountRef.name, 'ID:', incomeAccountRef.value);
      }
    }
  } catch (e) {
    console.warn('Failed to fetch income account, using default:', e);
  }
  
  // Create the item - QuickBooks has a 100 char limit on names
  const truncatedName = normalizeName(itemName).substring(0, 100);
  
  const itemPayload = {
    Name: truncatedName,
    Type: 'NonInventory',
    IncomeAccountRef: incomeAccountRef,
    Description: description || undefined,
    Taxable: false, // You may want to adjust this based on business logic
  };
  
  console.log('Creating new item in QuickBooks:', truncatedName);
  
  const createResponse = await fetch(`${baseUrl}/v3/company/${realmId}/item`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(itemPayload),
  });
  
  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error('Failed to create item:', createResponse.status, errorText);
    throw new Error(`Failed to create item "${truncatedName}" in QuickBooks: ${errorText}`);
  }
  
  const createdItem = await createResponse.json();
  console.log('Successfully created item:', createdItem.Item?.Name, 'ID:', createdItem.Item?.Id);
  
  return { Id: createdItem.Item.Id, Name: createdItem.Item.Name };
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

    // Fetch invoice with customer and items (including product_id)
    const { data: invoice, error: invoiceError } = await supabase
      .from('fnb_invoices')
      .select(`
        *,
        fnb_customers (name, whatsapp_phone, address),
        fnb_invoice_items (*, product_id)
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

      // Step 2: Look up customer by name (with normalized matching)
      const customerName = invoice.fnb_customers?.name;
      console.log('Looking up customer:', customerName);
      const normalizedCustomerName = normalizeName(customerName).toLowerCase();
      
      // Try exact match first
      const escapedCustomerName = customerName?.replace(/'/g, "\\'") || '';
      const customerQuery = encodeURIComponent(`select * from Customer where DisplayName = '${escapedCustomerName}'`);
      
      let qbCustomer = null;
      const customerUrl = `${baseUrl}/v3/company/${realmId}/query?query=${customerQuery}`;
      console.log('Customer query URL:', customerUrl);
      
      const customerResponse = await fetch(customerUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        console.log('Customer query response:', JSON.stringify(customerData, null, 2));
        const customers = customerData.QueryResponse?.Customer || [];
        
        if (customers.length > 0) {
          qbCustomer = customers[0];
        } else {
          // Try normalized matching
          console.log('Exact customer match failed, trying normalized search...');
          const allCustomersQuery = encodeURIComponent(`select * from Customer MAXRESULTS 1000`);
          const allCustomersResponse = await fetch(`${baseUrl}/v3/company/${realmId}/query?query=${allCustomersQuery}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });
          
          if (allCustomersResponse.ok) {
            const allCustomersData = await allCustomersResponse.json();
            const allCustomers = allCustomersData.QueryResponse?.Customer || [];
            qbCustomer = allCustomers.find((c: any) => 
              normalizeName(c.DisplayName).toLowerCase() === normalizedCustomerName
            );
          }
        }
      } else {
        const errorBody = await customerResponse.text();
        console.error('Customer lookup HTTP error:', customerResponse.status, errorBody);
        throw new Error(`Customer lookup failed (HTTP ${customerResponse.status}): ${errorBody}`);
      }
      
      if (!qbCustomer) {
        throw new Error(`Customer "${customerName}" not found in QuickBooks. Please create the customer first or check the exact spelling matches.`);
      }

      console.log('Found customer in QuickBooks:', qbCustomer.DisplayName, 'ID:', qbCustomer.Id);

      // Step 3: Build line items (look up or create products)
      const lineItems = [];
      const createdItems: { productId: string; qbItemId: string }[] = [];

      for (const item of invoice.fnb_invoice_items || []) {
        console.log('Processing line item:', item.product_name);
        
        // Check if we already have a cached QuickBooks Item ID
        let qbItemId = null;
        if (item.product_id) {
          const { data: productData } = await supabase
            .from('fnb_products')
            .select('quickbooks_item_id')
            .eq('id', item.product_id)
            .single();
          
          if (productData?.quickbooks_item_id) {
            console.log('Using cached QuickBooks Item ID:', productData.quickbooks_item_id);
            qbItemId = productData.quickbooks_item_id;
          }
        }
        
        // If no cached ID, look up in QuickBooks
        if (!qbItemId) {
          const foundItem = await findItemInQuickBooks(
            item.product_name,
            accessToken,
            baseUrl,
            realmId
          );
          
          if (foundItem) {
            qbItemId = foundItem.Id;
            
            // Cache the QuickBooks Item ID for future syncs
            if (item.product_id) {
              await supabase
                .from('fnb_products')
                .update({ quickbooks_item_id: foundItem.Id })
                .eq('id', item.product_id);
              console.log('Cached QuickBooks Item ID for product:', item.product_id);
            }
          } else {
            // Item doesn't exist - create it
            console.log('Item not found in QuickBooks, auto-creating:', item.product_name);
            
            const createdItem = await createItemInQuickBooks(
              item.product_name,
              item.description,
              accessToken,
              baseUrl,
              realmId
            );
            
            qbItemId = createdItem.Id;
            
            // Cache the QuickBooks Item ID
            if (item.product_id) {
              await supabase
                .from('fnb_products')
                .update({ quickbooks_item_id: createdItem.Id })
                .eq('id', item.product_id);
              console.log('Cached newly created QuickBooks Item ID for product:', item.product_id);
              createdItems.push({ productId: item.product_id, qbItemId: createdItem.Id });
            }
          }
        }
        
        lineItems.push({
          DetailType: 'SalesItemLineDetail',
          Amount: item.line_total_xcg,
          Description: item.description || undefined,
          SalesItemLineDetail: {
            ItemRef: { value: qbItemId },
            Qty: item.quantity,
            UnitPrice: item.unit_price_xcg,
          },
        });
      }

      // Step 4: Create invoice
      console.log('Creating invoice in QuickBooks with', lineItems.length, 'line items...');
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
          items_created: createdItems.length,
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
        items_created: createdItems.length,
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
