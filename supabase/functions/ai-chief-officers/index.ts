import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function callGPT(system: string, user: string, key: string): Promise<any> {
  console.log('OpenAI API call - model: gpt-4o');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 1500,
    }),
  });

  console.log('OpenAI response status:', resp.status);
  const data = await resp.json();
  console.log('OpenAI choices:', data.choices?.length);
  console.log('OpenAI content:', data.choices?.[0]?.message?.content?.substring(0, 200));
  if (data.error) console.error('OpenAI error:', JSON.stringify(data.error));

  return JSON.parse(data.choices?.[0]?.message?.content || '{}');
}

async function runAce(supabase: any, key: string): Promise<void> {
  const [ordersRes, balancesRes, allOrdersRes, allCustomersRes] = await Promise.all([
    supabase.from('distribution_orders')
      .select('id, total_xcg, payment_status, payment_method, created_at, status')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .in('status', ['confirmed', 'delivered', 'invoiced']),
    supabase.from('customer_outstanding_balances')
      .select('customer_name, outstanding_xcg, unpaid_orders')
      .order('outstanding_xcg', { ascending: false })
      .limit(10),
    supabase.from('distribution_orders')
      .select('id, status, created_at, customer_id, source_channel')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('distribution_customers')
      .select('id, name, customer_type, payment_terms, zone'),
  ]);

  const orders = ordersRes.data || [];
  const balances = balancesRes.data || [];
  const allOrders = allOrdersRes.data || [];
  const allCustomers = allCustomersRes.data || [];
  const totalRevenue = orders.reduce((s: number, o: any) => s + (o.total_xcg || 0), 0);
  const totalOutstanding = balances.reduce((s: number, b: any) => s + (b.outstanding_xcg || 0), 0);

  console.log('=== ACE STARTING ===');
  console.log('Orders fetched:', orders.length);
  console.log('Balances fetched:', balances.length);
  console.log('Total revenue:', totalRevenue);
  console.log('Calling GPT-4o...');

  const dataContext = `
FUIK Distribution Business — Curaçao
Total orders in system: ${allOrders.length}
Recent orders (30 days): ${orders.length}
Order sources: ${[...new Set(allOrders.map((o: any) => o.source_channel).filter(Boolean))].join(', ') || 'manual, telegram'}
Total customers: ${allCustomers.length}
Customer types: ${[...new Set(allCustomers.map((c: any) => c.customer_type).filter(Boolean))].join(', ') || 'not categorized yet'}
Payment terms in use: ${[...new Set(allCustomers.map((c: any) => c.payment_terms).filter(Boolean))].join(', ') || 'not set'}
Zones served: ${[...new Set(allCustomers.map((c: any) => c.zone).filter(Boolean))].join(', ') || 'not zoned yet'}
Outstanding balances tracked: ${balances.length} customers
Total revenue tracked: XCG ${totalRevenue.toFixed(2)}${totalRevenue === 0 ? ' (pricing setup may be pending)' : ''}
Total outstanding: XCG ${totalOutstanding.toFixed(2)}
Top outstanding: ${balances.slice(0, 3).map((b: any) => `${b.customer_name}: XCG ${(b.outstanding_xcg || 0).toFixed(2)}`).join(', ') || 'none yet'}
Unpaid orders: ${orders.filter((o: any) => o.payment_status !== 'paid').length}
Note: This is a growing business — provide setup recommendations if data is sparse.
`;

  const result = await callGPT(
    `You are Ace, the AI Chief Finance Officer for FUIK, a fresh produce distributor in Curaçao. Analyze the available data and generate 2-3 actionable suggestions. If financial data is sparse or pricing is not yet set up, generate suggestions about setting up proper financial tracking, pricing strategy, and payment collection processes that would benefit a growing produce distributor in Curaçao.`,
    `Analyze and generate 2-3 actionable suggestions:\n${dataContext}\nReturn: {"suggestions":[{"title":string,"content":string,"priority":"low"|"medium"|"high"|"critical","reasoning":string}]}`,
    key
  );

  console.log('GPT raw result:', JSON.stringify(result));
  console.log('Suggestions count:', result.suggestions?.length || 0);

  for (const s of (result.suggestions || [])) {
    await supabase.from('ai_suggestions').insert({
      department: 'finance', suggestion_type: 'financial_analysis',
      title: s.title, content: s.content, reasoning: s.reasoning,
      priority: s.priority || 'medium', status: 'pending',
    });
  }
  await supabase.from('ai_chief_officers').update({
    last_run_at: new Date().toISOString(),
    last_suggestion_at: new Date().toISOString(),
    status: 'active',
  }).eq('department', 'finance');
}

async function runMaya(supabase: any, key: string): Promise<void> {
  const [segRes, itemsRes, customersRes] = await Promise.all([
    supabase.from('marketing_customer_segments').select('*'),
    supabase.from('distribution_order_items').select('product_name_raw').limit(300),
    supabase.from('distribution_customers').select('id, name, customer_type, zone, preferred_language, created_at'),
  ]);

  const segments = segRes.data || [];
  const items = itemsRes.data || [];
  const customers = customersRes.data || [];
  const counts: Record<string, number> = {};
  items.forEach((i: any) => { const n = (i.product_name_raw || '').toLowerCase(); counts[n] = (counts[n] || 0) + 1; });
  const topProducts = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([n, c]) => `${n}(${c})`).join(', ');

  console.log('=== MAYA STARTING ===');
  console.log('Segments fetched:', segments.length);
  console.log('Items fetched:', items.length);
  console.log('Calling GPT-4o...');

  const dataContext = `
FUIK Distribution Business — Curaçao
Total customers in system: ${customers.length}
Customer types: ${[...new Set(customers.map((c: any) => c.customer_type).filter(Boolean))].join(', ') || 'not categorized'}
Languages: ${[...new Set(customers.map((c: any) => c.preferred_language).filter(Boolean))].join(', ') || 'papiamentu, dutch, english'}
Zones: Pariba ${segments.filter((s: any) => s.zone === 'pariba').length}, Meimei ${segments.filter((s: any) => s.zone === 'meimei').length}, Pabou ${segments.filter((s: any) => s.zone === 'pabou').length}
Segments from view: Active ${segments.filter((s: any) => s.segment === 'active').length}, Regular ${segments.filter((s: any) => s.segment === 'regular').length}, At risk ${segments.filter((s: any) => s.segment === 'at_risk').length}, Churned ${segments.filter((s: any) => s.segment === 'churned').length}, Inactive ${segments.filter((s: any) => s.segment === 'inactive').length}
Top products ordered: ${topProducts || 'no order items yet'}
Total order items tracked: ${items.length}
Note: This is a growing business — if data is sparse, generate suggestions about customer onboarding, engagement strategies, and growth tactics for a Caribbean fresh produce distributor.
`;

  const result = await callGPT(
    `You are Maya, the AI Chief Marketing Officer for FUIK, a fresh produce distributor in Curaçao. Generate practical marketing suggestions a small team can execute immediately. If customer or order data is sparse, focus on customer acquisition, onboarding workflows, and engagement strategies for a growing Caribbean produce business.`,
    `Analyze and generate 2-3 actionable suggestions:\n${dataContext}\nReturn: {"suggestions":[{"title":string,"content":string,"priority":"low"|"medium"|"high"|"critical","reasoning":string}]}`,
    key
  );

  console.log('GPT raw result:', JSON.stringify(result));
  console.log('Suggestions count:', result.suggestions?.length || 0);

  for (const s of (result.suggestions || [])) {
    await supabase.from('ai_suggestions').insert({
      department: 'marketing', suggestion_type: 'marketing_analysis',
      title: s.title, content: s.content, reasoning: s.reasoning,
      priority: s.priority || 'medium', status: 'pending',
    });
  }
  await supabase.from('ai_chief_officers').update({
    last_run_at: new Date().toISOString(),
    last_suggestion_at: new Date().toISOString(),
    status: 'active',
  }).eq('department', 'marketing');
}

async function runOracle(supabase: any, key: string): Promise<void> {
  const { data: pending } = await supabase.from('ai_suggestions')
    .select('department, priority, title, content')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!pending?.length) return;

  const list = pending.map((s: any) => `[${s.department}/${s.priority}] ${s.title}: ${s.content}`).join('\n');

  const result = await callGPT(
    `You are Oracle, the AI Chief Oversight Officer for FUIK. Review all AI officer suggestions and generate alerts only for genuinely urgent issues.`,
    `Review and generate 0-2 alerts if truly needed:\n${list}\nReturn: {"alerts":[{"title":string,"message":string,"severity":"info"|"warning"|"critical","department":string}]}`,
    key
  );

  for (const a of (result.alerts || [])) {
    await supabase.from('ai_alerts').insert({
      department: a.department || 'oversight',
      severity: a.severity || 'info',
      title: a.title, message: a.message, resolved: false,
    });
  }
  await supabase.from('ai_chief_officers').update({
    last_run_at: new Date().toISOString(), status: 'active',
  }).eq('department', 'oversight');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set' }), {
    status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const body = await req.json().catch(() => ({}));
    const officer = body.officer || 'all';
    if (officer === 'ace' || officer === 'all') await runAce(supabase, key);
    if (officer === 'maya' || officer === 'all') await runMaya(supabase, key);
    if (officer === 'oracle' || officer === 'all') await runOracle(supabase, key);

    return new Response(JSON.stringify({ success: true, officer }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('ai-chief-officers error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
