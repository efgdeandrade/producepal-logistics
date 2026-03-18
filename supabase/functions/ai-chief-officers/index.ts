import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function callGPT(system: string, user: string, key: string): Promise<any> {
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
  const data = await resp.json();
  return JSON.parse(data.choices?.[0]?.message?.content || '{}');
}

async function runAce(supabase: any, key: string): Promise<void> {
  const [ordersRes, balancesRes] = await Promise.all([
    supabase.from('distribution_orders')
      .select('id, total_xcg, payment_status, payment_method, created_at, status')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .in('status', ['confirmed', 'delivered', 'invoiced']),
    supabase.from('customer_outstanding_balances')
      .select('customer_name, outstanding_xcg, unpaid_orders')
      .order('outstanding_xcg', { ascending: false })
      .limit(10),
  ]);

  const orders = ordersRes.data || [];
  const balances = balancesRes.data || [];
  const totalRevenue = orders.reduce((s: number, o: any) => s + (o.total_xcg || 0), 0);
  const totalOutstanding = balances.reduce((s: number, b: any) => s + (b.outstanding_xcg || 0), 0);

  const result = await callGPT(
    `You are Ace, the AI Chief Finance Officer for FUIK, a fresh produce distributor in Curaçao. Generate specific, actionable financial insights for management.`,
    `Analyze and generate 2-3 actionable suggestions:
Total orders (30 days): ${orders.length}
Total revenue: XCG ${totalRevenue.toFixed(2)}
Unpaid orders: ${orders.filter((o: any) => o.payment_status !== 'paid').length}
Total outstanding: XCG ${totalOutstanding.toFixed(2)}
Top outstanding: ${balances.slice(0, 3).map((b: any) => `${b.customer_name}: XCG ${(b.outstanding_xcg || 0).toFixed(2)}`).join(', ')}
Return: {"suggestions":[{"title":string,"content":string,"priority":"low"|"medium"|"high"|"critical","reasoning":string}]}`,
    key
  );

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
  const [segRes, itemsRes] = await Promise.all([
    supabase.from('marketing_customer_segments').select('*'),
    supabase.from('distribution_order_items').select('product_name_raw').limit(300),
  ]);

  const segments = segRes.data || [];
  const items = itemsRes.data || [];
  const counts: Record<string, number> = {};
  items.forEach((i: any) => { const n = (i.product_name_raw || '').toLowerCase(); counts[n] = (counts[n] || 0) + 1; });
  const topProducts = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([n, c]) => `${n}(${c})`).join(', ');

  const result = await callGPT(
    `You are Maya, the AI Chief Marketing Officer for FUIK, a fresh produce distributor in Curaçao. Generate practical marketing suggestions a small team can execute immediately.`,
    `Analyze and generate 2-3 actionable suggestions:
Total customers: ${segments.length}
Active (last 7 days): ${segments.filter((s: any) => s.segment === 'active').length}
At risk (last 90 days): ${segments.filter((s: any) => s.segment === 'at_risk').length}
Churned: ${segments.filter((s: any) => s.segment === 'churned').length}
Top products: ${topProducts}
Zones: Pariba ${segments.filter((s: any) => s.zone === 'pariba').length}, Meimei ${segments.filter((s: any) => s.zone === 'meimei').length}, Pabou ${segments.filter((s: any) => s.zone === 'pabou').length}
Return: {"suggestions":[{"title":string,"content":string,"priority":"low"|"medium"|"high"|"critical","reasoning":string}]}`,
    key
  );

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
