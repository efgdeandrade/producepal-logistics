import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyShopifyHmac(body: string, hmacHeader: string): Promise<boolean> {
  const secret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');
  if (!secret) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const computedHmac = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return computedHmac === hmacHeader;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const rawBody = await req.text();
  const hmacHeader = req.headers.get('X-Shopify-Hmac-Sha256') || '';

  // Validate HMAC
  const valid = await verifyShopifyHmac(rawBody, hmacHeader);
  if (!valid) {
    console.error('Invalid Shopify HMAC signature');
    return new Response('Unauthorized', { status: 401 });
  }

  // Return 200 immediately
  const responsePromise = new Response('OK', { status: 200 });

  // Process asynchronously
  try {
    const shopifyOrder = JSON.parse(rawBody);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Extract customer info
    const shopifyCustomer = shopifyOrder.customer || {};
    const email = shopifyCustomer.email || shopifyOrder.email || null;
    const firstName = shopifyCustomer.first_name || '';
    const lastName = shopifyCustomer.last_name || '';
    const phone = shopifyCustomer.phone || null;
    const shopifyCustomerId = shopifyCustomer.id ? String(shopifyCustomer.id) : null;

    // Find or create customer
    let customerId: string | null = null;

    if (email) {
      const { data: existingByEmail } = await supabase
        .from('distribution_customers')
        .select('id')
        .eq('email', email)
        .limit(1)
        .single();
      if (existingByEmail) customerId = existingByEmail.id;
    }

    if (!customerId && shopifyCustomerId) {
      const { data: existingByShopify } = await supabase
        .from('distribution_customers')
        .select('id')
        .eq('shopify_customer_id', shopifyCustomerId)
        .limit(1)
        .single();
      if (existingByShopify) customerId = existingByShopify.id;
    }

    if (!customerId) {
      const { data: newCustomer } = await supabase.from('distribution_customers').insert({
        name: `${firstName} ${lastName}`.trim() || 'Shopify Customer',
        customer_type: 'online',
        email: email || '',
        shopify_customer_id: shopifyCustomerId,
        preferred_language: 'english',
        whatsapp_phone: phone || 'pending',
      }).select().single();
      customerId = newCustomer?.id || null;
    }

    // Map fulfillment type
    const tags = (shopifyOrder.tags || '').toLowerCase();
    const hasShipping = !!shopifyOrder.shipping_address;
    const isPickup = tags.includes('local-pickup');
    let fulfillmentType = 'walk_in';
    if (hasShipping && !isPickup) fulfillmentType = 'delivery';
    else if (isPickup) fulfillmentType = 'pickup';

    // Map payment status
    const financialStatus = shopifyOrder.financial_status || 'pending';
    const orderStatus = financialStatus === 'paid' ? 'confirmed' : 'draft';

    const orderNumber = `SHOP-${shopifyOrder.order_number || Date.now().toString(36).toUpperCase()}`;

    // Create order
    const { data: order } = await supabase.from('distribution_orders').insert({
      order_number: orderNumber,
      customer_id: customerId,
      source_channel: 'shopify',
      status: orderStatus,
      is_pickup: isPickup,
      notes: `Shopify order #${shopifyOrder.order_number || shopifyOrder.name || 'unknown'}`,
    }).select().single();

    if (order && shopifyOrder.line_items) {
      // Load products for matching
      const { data: products } = await supabase
        .from('distribution_products')
        .select('id, name, name_pap, name_nl, name_es')
        .eq('is_active', true);

      const { data: aliases } = await supabase
        .from('distribution_product_aliases')
        .select('alias, product_id');

      for (const item of shopifyOrder.line_items) {
        const title = item.title || '';
        const searchName = title.toLowerCase().trim();
        let matchedProductId: string | null = null;

        // Match against aliases
        for (const alias of (aliases || [])) {
          if (alias.alias.toLowerCase() === searchName || searchName.includes(alias.alias.toLowerCase())) {
            matchedProductId = alias.product_id;
            break;
          }
        }

        // Match against product names
        if (!matchedProductId) {
          for (const p of (products || [])) {
            const names = [p.name, p.name_pap, p.name_nl, p.name_es].filter(Boolean).map(n => (n as string).toLowerCase());
            if (names.some(n => n === searchName || n.includes(searchName) || searchName.includes(n))) {
              matchedProductId = p.id;
              break;
            }
          }
        }

        await supabase.from('distribution_order_items').insert({
          order_id: order.id,
          product_id: matchedProductId,
          product_name_raw: title,
          quantity: item.quantity || 1,
          order_unit: 'piece',
          unit_price_xcg: parseFloat(item.price) || 0,
        });
      }
    }

    console.log('Shopify order processed:', orderNumber);
  } catch (error) {
    console.error('shopify-order-webhook processing error:', error);
  }

  return responsePromise;
});
