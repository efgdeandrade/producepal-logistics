import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Users, TrendingUp, Megaphone, Brain, Zap, Check, X, Loader2, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Segment = 'active' | 'regular' | 'at_risk' | 'churned' | 'inactive';

const SEGMENT_STYLES: Record<Segment, { label: string; border: string; badgeClass: string }> = {
  active: { label: 'Active', border: 'border-l-green-500', badgeClass: 'bg-green-100 text-green-800' },
  regular: { label: 'Regular', border: 'border-l-primary', badgeClass: 'bg-primary/10 text-primary' },
  at_risk: { label: 'At Risk', border: 'border-l-yellow-500', badgeClass: 'bg-yellow-100 text-yellow-800' },
  churned: { label: 'Churned', border: 'border-l-red-500', badgeClass: 'bg-red-100 text-red-800' },
  inactive: { label: 'New/Inactive', border: 'border-l-muted-foreground', badgeClass: 'bg-muted text-muted-foreground' },
};

export default function MarketingPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState('month');
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [runningMaya, setRunningMaya] = useState(false);

  // Broadcast state
  const [bcStep, setBcStep] = useState(1);
  const [bcSegment, setBcSegment] = useState<Segment>('active');
  const [bcMessage, setBcMessage] = useState('');
  const [bcLang, setBcLang] = useState('pap');
  const [bcSending, setBcSending] = useState(false);
  const [bcProgress, setBcProgress] = useState(0);
  const [bcConfirmOpen, setBcConfirmOpen] = useState(false);

  // Segments data
  const { data: segments, isLoading: segLoading } = useQuery({
    queryKey: ['marketing-segments'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_customer_segments').select('*');
      return data || [];
    },
  });

  // Top products
  const { data: topProducts, isLoading: prodLoading } = useQuery({
    queryKey: ['marketing-top-products', dateRange],
    queryFn: async () => {
      const days = dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : 90;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from('distribution_order_items')
        .select('product_name_raw, quantity')
        .gte('created_at', since);
      const counts: Record<string, { count: number; totalQty: number }> = {};
      (data || []).forEach((i: any) => {
        const n = i.product_name_raw || 'Unknown';
        if (!counts[n]) counts[n] = { count: 0, totalQty: 0 };
        counts[n].count++;
        counts[n].totalQty += Number(i.quantity || 0);
      });
      return Object.entries(counts)
        .map(([name, v]) => ({ name, orderCount: v.count, totalQty: v.totalQty, avgQty: v.count > 0 ? v.totalQty / v.count : 0 }))
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 10);
    },
  });

  // Maya officer
  const { data: mayaOfficer } = useQuery({
    queryKey: ['maya-officer'],
    queryFn: async () => {
      const { data } = await supabase.from('ai_chief_officers').select('*').eq('department', 'marketing').single();
      return data;
    },
  });

  // AI suggestions
  const [suggestions, setSuggestions] = useState<any[]>([]);
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('ai_suggestions').select('*').eq('department', 'marketing').eq('status', 'pending').order('created_at', { ascending: false });
      setSuggestions(data || []);
    };
    fetch();
    const channel = supabase.channel('marketing-suggestions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_suggestions', filter: 'department=eq.marketing' }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const segmentCounts: Record<Segment, number> = { active: 0, regular: 0, at_risk: 0, churned: 0, inactive: 0 };
  segments?.forEach((s: any) => { if (segmentCounts[s.segment as Segment] !== undefined) segmentCounts[s.segment as Segment]++; });
  const totalCustomers = segments?.length || 0;

  const filteredCustomers = segments?.filter((s: any) => {
    if (selectedSegment && s.segment !== selectedSegment) return false;
    if (search && !s.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const bcRecipients = segments?.filter((s: any) => s.segment === bcSegment && s.telegram_chat_id) || [];

  const handleRunMaya = async () => {
    setRunningMaya(true);
    const { error } = await supabase.functions.invoke('ai-chief-officers', { body: { officer: 'maya' } });
    setRunningMaya(false);
    if (error) toast({ title: 'Error running Maya', variant: 'destructive' });
    else toast({ title: 'Maya analysis complete' });
  };

  const handleSuggestionAction = async (id: string, status: 'approved' | 'dismissed') => {
    await supabase.from('ai_suggestions').update({ status, actioned_by: user?.id, actioned_at: new Date().toISOString() }).eq('id', id);
    toast({ title: `Suggestion ${status}` });
  };

  const handleBroadcast = async () => {
    setBcConfirmOpen(false);
    setBcSending(true);
    setBcProgress(0);
    const recipients = segments?.filter((s: any) => s.segment === bcSegment) || [];
    let sent = 0;
    for (const r of recipients) {
      try {
        // Create conversation if needed
        const { data: existing } = await supabase.from('dre_conversations')
          .select('id').eq('customer_id', r.id).limit(1).maybeSingle();
        let convId = existing?.id;
        if (!convId) {
          const { data: newConv } = await supabase.from('dre_conversations').insert({
            customer_id: r.id, customer_name: r.name, channel: 'telegram',
            control_status: 'dre_active', external_chat_id: r.id,
          }).select('id').single();
          convId = newConv?.id;
        }
        if (convId) {
          await supabase.from('dre_messages').insert({
            conversation_id: convId, role: 'dre', content: bcMessage,
          });
        }
        sent++;
        setBcProgress(Math.round((sent / recipients.length) * 100));
      } catch (e) {
        console.error('Broadcast error for', r.name, e);
      }
    }
    setBcSending(false);
    toast({ title: `Broadcast sent to ${sent} customers` });
    setBcStep(1);
    setBcMessage('');
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Marketing</h1>
        <p className="text-muted-foreground">Customer segments, product trends, and outreach</p>
      </div>

      <Tabs defaultValue="segments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="segments">Customer Segments</TabsTrigger>
          <TabsTrigger value="products">Top Products</TabsTrigger>
          <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
          <TabsTrigger value="maya">Maya Insights</TabsTrigger>
        </TabsList>

        {/* TAB 1 — Segments */}
        <TabsContent value="segments" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.entries(SEGMENT_STYLES) as [Segment, typeof SEGMENT_STYLES[Segment]][]).map(([key, style]) => (
              <Card
                key={key}
                className={`cursor-pointer border-l-4 ${style.border} transition-all hover:shadow-md ${selectedSegment === key ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedSegment(selectedSegment === key ? null : key)}
              >
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-muted-foreground">{style.label}</p>
                  <p className="text-2xl font-bold">{segLoading ? <Skeleton className="h-8 w-12" /> : segmentCounts[key]}</p>
                  <p className="text-xs text-muted-foreground">{totalCustomers > 0 ? `${((segmentCounts[key] / totalCustomers) * 100).toFixed(0)}%` : '0%'}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>

          {segLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Last Order</TableHead>
                    <TableHead>Lifetime Revenue</TableHead>
                    <TableHead>Segment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers?.slice(0, 50).map((c: any) => {
                    const seg = SEGMENT_STYLES[c.segment as Segment] || SEGMENT_STYLES.inactive;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell><Badge variant="outline">{c.customer_type}</Badge></TableCell>
                        <TableCell>{c.zone || '—'}</TableCell>
                        <TableCell>{c.last_order_date ? format(new Date(c.last_order_date), 'MMM d') : '—'}</TableCell>
                        <TableCell>XCG {Number(c.lifetime_revenue_xcg || 0).toFixed(2)}</TableCell>
                        <TableCell><Badge className={seg.badgeClass}>{seg.label}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                  {(!filteredCustomers || filteredCustomers.length === 0) && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No customers found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* TAB 2 — Top Products */}
        <TabsContent value="products" className="space-y-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">Last 3 Months</SelectItem>
            </SelectContent>
          </Select>

          {prodLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <Card>
              <CardContent className="pt-6 h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs fill-muted-foreground" />
                    <YAxis type="category" dataKey="name" width={150} className="text-xs fill-muted-foreground" />
                    <Tooltip />
                    <Bar dataKey="orderCount" fill="hsl(186, 90%, 45%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Order Count</TableHead>
                  <TableHead>Total Quantity</TableHead>
                  <TableHead>Avg Qty/Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts?.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.orderCount}</TableCell>
                    <TableCell>{p.totalQty.toFixed(1)}</TableCell>
                    <TableCell>{p.avgQty.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* TAB 3 — Broadcast */}
        <TabsContent value="broadcast" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Broadcast Composer</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {/* Step indicators */}
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className={`flex-1 h-1.5 rounded-full ${bcStep >= s ? 'bg-primary' : 'bg-muted'}`} />
                ))}
              </div>

              {bcStep === 1 && (
                <div className="space-y-4">
                  <h3 className="font-medium">Step 1: Select Segment</h3>
                  <Select value={bcSegment} onValueChange={(v) => setBcSegment(v as Segment)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(SEGMENT_STYLES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label} ({segmentCounts[k as Segment]})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">{segmentCounts[bcSegment]} customers in this segment</p>
                  <Button onClick={() => setBcStep(2)}>Next</Button>
                </div>
              )}

              {bcStep === 2 && (
                <div className="space-y-4">
                  <h3 className="font-medium">Step 2: Compose Message</h3>
                  <Textarea value={bcMessage} onChange={(e) => setBcMessage(e.target.value.slice(0, 500))} placeholder="Type your broadcast message..." className="h-32" />
                  <p className="text-xs text-muted-foreground">{bcMessage.length}/500</p>
                  <Select value={bcLang} onValueChange={setBcLang}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pap">Papiamentu</SelectItem>
                      <SelectItem value="nl">Dutch</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setBcStep(1)}>Back</Button>
                    <Button onClick={() => setBcStep(3)} disabled={!bcMessage.trim()}>Next</Button>
                  </div>
                </div>
              )}

              {bcStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-medium">Step 3: Preview</h3>
                  <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                    <p className="text-sm"><strong>Segment:</strong> {SEGMENT_STYLES[bcSegment].label} ({segmentCounts[bcSegment]} recipients)</p>
                    <p className="text-sm"><strong>Language:</strong> {bcLang.toUpperCase()}</p>
                    <div className="bg-primary text-primary-foreground rounded-xl p-3 max-w-xs">
                      <p className="text-sm">{bcMessage}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setBcStep(2)}>Back</Button>
                    <Button onClick={() => setBcStep(4)}>Next</Button>
                  </div>
                </div>
              )}

              {bcStep === 4 && (
                <div className="space-y-4">
                  <h3 className="font-medium">Step 4: Send</h3>
                  {bcSending ? (
                    <div className="space-y-2">
                      <Progress value={bcProgress} />
                      <p className="text-sm text-muted-foreground">Sending... {bcProgress}%</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">Ready to send to {segmentCounts[bcSegment]} customers in the "{SEGMENT_STYLES[bcSegment].label}" segment.</p>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setBcStep(3)}>Back</Button>
                        <Button onClick={() => setBcConfirmOpen(true)}>Send Broadcast</Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4 — Maya Insights */}
        <TabsContent value="maya" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <CardTitle>Maya — Marketing AI</CardTitle>
                {mayaOfficer?.last_run_at && (
                  <span className="text-xs text-muted-foreground">Last run: {format(new Date(mayaOfficer.last_run_at), 'MMM d, HH:mm')}</span>
                )}
              </div>
              <Button onClick={handleRunMaya} disabled={runningMaya}>
                {runningMaya ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                Run Maya Now
              </Button>
            </CardHeader>
            <CardContent>
              {suggestions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No pending suggestions from Maya</p>
                  <Button className="mt-4" onClick={handleRunMaya} disabled={runningMaya}>
                    {runningMaya ? 'Running...' : 'Run Maya Now'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((s) => (
                    <Card key={s.id} className="border">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={s.priority === 'critical' || s.priority === 'high' ? 'destructive' : 'secondary'}>
                            {s.priority}
                          </Badge>
                          <span className="font-medium text-sm">{s.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{s.content}</p>
                        {s.reasoning && (
                          <button className="text-xs text-primary flex items-center gap-1" onClick={() => setExpandedSuggestion(expandedSuggestion === s.id ? null : s.id)}>
                            {expandedSuggestion === s.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            Reasoning
                          </button>
                        )}
                        {expandedSuggestion === s.id && s.reasoning && (
                          <p className="text-xs text-muted-foreground bg-muted p-2 rounded">{s.reasoning}</p>
                        )}
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" onClick={() => handleSuggestionAction(s.id, 'approved')}>
                            <Check className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleSuggestionAction(s.id, 'dismissed')}>
                            <X className="h-3 w-3 mr-1" /> Dismiss
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Broadcast confirm dialog */}
      <Dialog open={bcConfirmOpen} onOpenChange={setBcConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Broadcast</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Send this message to {segmentCounts[bcSegment]} customers in the "{SEGMENT_STYLES[bcSegment].label}" segment?
          </p>
          <div className="bg-muted rounded-lg p-3"><p className="text-sm">{bcMessage}</p></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBcConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleBroadcast}>Send Now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
