import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Lightbulb, Radio, Users, Brain, Plus, Loader2, Check, X,
  ChevronDown, ChevronUp, Zap, ChevronLeft, ArrowRight, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const OPP_CATEGORIES = ['new_product', 'new_supplier', 'new_market', 'process_improvement', 'technology', 'packaging', 'other'] as const;
const OPP_STATUSES = ['idea', 'researching', 'validated', 'approved', 'rejected', 'implemented'] as const;
const OPP_SOURCES = ['internal', 'customer_request', 'market_research', 'ai_suggestion', 'other'] as const;
const SIGNAL_TYPES = ['customer_request', 'competitor_activity', 'price_change', 'seasonal_trend', 'new_product_demand', 'supply_issue', 'other'] as const;

const priorityColor = (p: string) => {
  switch (p) {
    case 'critical': return 'destructive';
    case 'high': return 'default';
    case 'medium': return 'secondary';
    default: return 'outline';
  }
};

const statusColor = (s: string) => {
  switch (s) {
    case 'idea': return 'outline';
    case 'researching': return 'secondary';
    case 'validated': return 'default';
    case 'approved': return 'default';
    case 'implemented': return 'default';
    case 'rejected': return 'destructive';
    default: return 'outline';
  }
};

export default function RDPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ═══ OPPORTUNITIES ═══
  const { data: opportunities } = useQuery({
    queryKey: ['rd-opportunities'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rd_opportunities').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const [oppForm, setOppForm] = useState({ title: '', description: '', category: 'new_product', priority: 'medium', source: 'internal', potential_revenue_xcg: '', estimated_cost_xcg: '', target_date: '' });
  const [oppSheetOpen, setOppSheetOpen] = useState(false);
  const [savingOpp, setSavingOpp] = useState(false);

  const saveOpp = async () => {
    setSavingOpp(true);
    const { error } = await supabase.from('rd_opportunities').insert({
      ...oppForm,
      potential_revenue_xcg: parseFloat(oppForm.potential_revenue_xcg) || null,
      estimated_cost_xcg: parseFloat(oppForm.estimated_cost_xcg) || null,
      target_date: oppForm.target_date || null,
      submitted_by: user?.id,
    } as any);
    setSavingOpp(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Opportunity created' });
    setOppSheetOpen(false);
    setOppForm({ title: '', description: '', category: 'new_product', priority: 'medium', source: 'internal', potential_revenue_xcg: '', estimated_cost_xcg: '', target_date: '' });
    queryClient.invalidateQueries({ queryKey: ['rd-opportunities'] });
  };

  const advanceOpp = async (id: string, currentStatus: string) => {
    const order = ['idea', 'researching', 'validated', 'approved', 'implemented'];
    const idx = order.indexOf(currentStatus);
    if (idx < order.length - 1) {
      await supabase.from('rd_opportunities').update({ status: order[idx + 1] } as any).eq('id', id);
      queryClient.invalidateQueries({ queryKey: ['rd-opportunities'] });
    }
  };

  const rejectOpp = async (id: string) => {
    await supabase.from('rd_opportunities').update({ status: 'rejected' } as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['rd-opportunities'] });
  };

  // ═══ MARKET SIGNALS ═══
  const { data: signals } = useQuery({
    queryKey: ['rd-signals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rd_market_signals').select('*').order('detected_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const [sigForm, setSigForm] = useState({ signal_type: 'customer_request', title: '', description: '', source: '', relevance_score: 0.5 });
  const [sigSheetOpen, setSigSheetOpen] = useState(false);
  const [savingSig, setSavingSig] = useState(false);

  const saveSig = async () => {
    setSavingSig(true);
    const { error } = await supabase.from('rd_market_signals').insert(sigForm as any);
    setSavingSig(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Signal added' });
    setSigSheetOpen(false);
    setSigForm({ signal_type: 'customer_request', title: '', description: '', source: '', relevance_score: 0.5 });
    queryClient.invalidateQueries({ queryKey: ['rd-signals'] });
  };

  const reviewSignal = async (id: string, status: string) => {
    await supabase.from('rd_market_signals').update({ status, reviewed_by: user?.id } as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['rd-signals'] });
  };

  const newSignals = (signals || []).filter(s => s.status === 'new').length;

  // ═══ CUSTOMER REQUESTS (unmatched items) ═══
  const { data: unmatchedItems } = useQuery({
    queryKey: ['rd-unmatched'],
    queryFn: async () => {
      const { data, error } = await supabase.from('distribution_order_items')
        .select('product_name_raw, created_at')
        .is('product_id', null)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const counts: Record<string, { count: number; first: string }> = {};
      (data || []).forEach((i: any) => {
        const n = (i.product_name_raw || '').toLowerCase().trim();
        if (!n) return;
        if (!counts[n]) counts[n] = { count: 0, first: i.created_at };
        counts[n].count++;
      });
      return Object.entries(counts).sort(([, a], [, b]) => b.count - a.count).map(([name, info]) => ({ name, ...info }));
    },
  });

  const customerRequests = (opportunities || []).filter(o => o.source === 'customer_request');

  // ═══ KAYDEN INSIGHTS ═══
  const { data: kaydenOfficer } = useQuery({
    queryKey: ['kayden-officer'],
    queryFn: async () => {
      const { data } = await supabase.from('ai_chief_officers').select('*').eq('department', 'research_development').single();
      return data;
    },
  });

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [runningKayden, setRunningKayden] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('ai_suggestions').select('*').eq('department', 'research_development').eq('status', 'pending').order('created_at', { ascending: false });
      setSuggestions(data || []);
    };
    fetch();
    const channel = supabase.channel('rd-suggestions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_suggestions', filter: 'department=eq.research_development' }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const runKayden = async () => {
    setRunningKayden(true);
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 60000));
      const invokePromise = supabase.functions.invoke('ai-chief-officers', { body: { officer: 'kayden' } });
      await Promise.race([invokePromise, timeoutPromise]);
    } catch (e: any) {
      if (e.message !== 'timeout') console.error('Kayden error:', e);
    } finally {
      setRunningKayden(false);
      queryClient.invalidateQueries({ queryKey: ['kayden-officer'] });
    }
  };

  const handleSuggestion = async (id: string, action: 'approved' | 'dismissed') => {
    await supabase.from('ai_suggestions').update({ status: action, actioned_at: new Date().toISOString(), actioned_by: user?.id } as any).eq('id', id);
  };

  // Pipeline columns
  const pipelineStatuses = ['idea', 'researching', 'validated', 'approved', 'implemented', 'rejected'];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/select-portal')}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl md:text-3xl font-bold tracking-tight">R&D</h1>
          <p className="text-muted-foreground">Market opportunities, innovation pipeline & Kayden AI</p>
        </div>
      </div>

      <Tabs defaultValue="opportunities">
        <TabsList className="w-full overflow-x-auto flex">
          <TabsTrigger value="opportunities"><Lightbulb className="h-4 w-4 mr-1" />Pipeline</TabsTrigger>
          <TabsTrigger value="signals"><Radio className="h-4 w-4 mr-1" />Signals{newSignals > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5">{newSignals}</Badge>}</TabsTrigger>
          <TabsTrigger value="customers"><Users className="h-4 w-4 mr-1" />Requests</TabsTrigger>
          <TabsTrigger value="kayden"><Brain className="h-4 w-4 mr-1" />Kayden</TabsTrigger>
        </TabsList>

        {/* ═══ OPPORTUNITIES PIPELINE ═══ */}
        <TabsContent value="opportunities" className="space-y-4">
          <div className="flex justify-end">
            <Sheet open={oppSheetOpen} onOpenChange={setOppSheetOpen}>
              <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Opportunity</Button></SheetTrigger>
              <SheetContent>
                <SheetHeader><SheetTitle>New Opportunity</SheetTitle></SheetHeader>
                <ScrollArea className="h-[calc(100vh-120px)]">
                  <div className="space-y-4 mt-4 pr-4">
                    <Input placeholder="Title *" value={oppForm.title} onChange={e => setOppForm(f => ({ ...f, title: e.target.value }))} />
                    <Textarea placeholder="Description" value={oppForm.description} onChange={e => setOppForm(f => ({ ...f, description: e.target.value }))} />
                    <Select value={oppForm.category} onValueChange={v => setOppForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{OPP_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={oppForm.priority} onValueChange={v => setOppForm(f => ({ ...f, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{['low', 'medium', 'high', 'critical'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={oppForm.source} onValueChange={v => setOppForm(f => ({ ...f, source: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{OPP_SOURCES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input placeholder="Potential Revenue (XCG)" type="number" value={oppForm.potential_revenue_xcg} onChange={e => setOppForm(f => ({ ...f, potential_revenue_xcg: e.target.value }))} />
                    <Input placeholder="Estimated Cost (XCG)" type="number" value={oppForm.estimated_cost_xcg} onChange={e => setOppForm(f => ({ ...f, estimated_cost_xcg: e.target.value }))} />
                    <div className="space-y-1"><label className="text-sm text-muted-foreground">Target Date</label><Input type="date" value={oppForm.target_date} onChange={e => setOppForm(f => ({ ...f, target_date: e.target.value }))} /></div>
                    <Button onClick={saveOpp} disabled={!oppForm.title || savingOpp} className="w-full">
                      {savingOpp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save
                    </Button>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {pipelineStatuses.map(status => (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium capitalize">{status}</h3>
                  <Badge variant="outline" className="text-xs">{(opportunities || []).filter(o => o.status === status).length}</Badge>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {(opportunities || []).filter(o => o.status === status).map(opp => (
                    <Card key={opp.id} className="p-3">
                      <p className="font-medium text-sm">{opp.title}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="outline" className="text-xs">{(opp.category || '').replace(/_/g, ' ')}</Badge>
                        <Badge variant={priorityColor(opp.priority)} className="text-xs">{opp.priority}</Badge>
                      </div>
                      {opp.potential_revenue_xcg && <p className="text-xs text-muted-foreground mt-1">XCG {Number(opp.potential_revenue_xcg).toLocaleString()}</p>}
                      <Badge variant="outline" className="text-xs mt-1">{(opp.source || '').replace(/_/g, ' ')}</Badge>
                      <div className="flex gap-1 mt-2">
                        {status !== 'implemented' && status !== 'rejected' && (
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => advanceOpp(opp.id, status)}>
                            <ArrowRight className="h-3 w-3 mr-1" />Next
                          </Button>
                        )}
                        {status !== 'rejected' && status !== 'implemented' && (
                          <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive" onClick={() => rejectOpp(opp.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ═══ MARKET SIGNALS ═══ */}
        <TabsContent value="signals" className="space-y-4">
          {newSignals > 0 && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm font-medium">
              {newSignals} new signal(s) need review
            </div>
          )}

          <div className="flex justify-end">
            <Sheet open={sigSheetOpen} onOpenChange={setSigSheetOpen}>
              <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Signal</Button></SheetTrigger>
              <SheetContent>
                <SheetHeader><SheetTitle>New Market Signal</SheetTitle></SheetHeader>
                <div className="space-y-4 mt-4">
                  <Select value={sigForm.signal_type} onValueChange={v => setSigForm(f => ({ ...f, signal_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SIGNAL_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Title *" value={sigForm.title} onChange={e => setSigForm(f => ({ ...f, title: e.target.value }))} />
                  <Textarea placeholder="Description *" value={sigForm.description} onChange={e => setSigForm(f => ({ ...f, description: e.target.value }))} />
                  <Input placeholder="Source" value={sigForm.source} onChange={e => setSigForm(f => ({ ...f, source: e.target.value }))} />
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Relevance: {sigForm.relevance_score.toFixed(1)}</label>
                    <Slider value={[sigForm.relevance_score]} onValueChange={([v]) => setSigForm(f => ({ ...f, relevance_score: v }))} min={0} max={1} step={0.1} />
                  </div>
                  <Button onClick={saveSig} disabled={!sigForm.title || !sigForm.description || savingSig} className="w-full">
                    {savingSig ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Relevance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(signals || []).map(s => (
                    <TableRow key={s.id}>
                      <TableCell><Badge variant="outline">{(s.signal_type || '').replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell className="font-medium">{s.title}</TableCell>
                      <TableCell>{s.source || '—'}</TableCell>
                      <TableCell><Progress value={(s.relevance_score || 0) * 100} className="h-2 w-16" /></TableCell>
                      <TableCell><Badge variant={s.status === 'new' ? 'default' : 'outline'}>{s.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {s.status === 'new' && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => reviewSignal(s.id, 'reviewed')}><Eye className="h-4 w-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => reviewSignal(s.id, 'dismissed')}><X className="h-4 w-4" /></Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!signals?.length && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No signals yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ CUSTOMER REQUESTS ═══ */}
        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Customer Request Opportunities</CardTitle></CardHeader>
            <CardContent>
              {customerRequests.length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {customerRequests.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.title}</TableCell>
                        <TableCell><Badge variant={statusColor(o.status)}>{o.status}</Badge></TableCell>
                        <TableCell><Badge variant={priorityColor(o.priority)}>{o.priority}</Badge></TableCell>
                        <TableCell>{format(new Date(o.created_at), 'MMM d, yyyy')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-4 text-muted-foreground">No customer request opportunities yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Unmatched Products (Potential New Products)</CardTitle></CardHeader>
            <CardContent>
              {(unmatchedItems || []).length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Product Requested</TableHead><TableHead>Times Ordered</TableHead><TableHead>First Seen</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(unmatchedItems || []).slice(0, 20).map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium capitalize">{item.name}</TableCell>
                        <TableCell>{item.count}</TableCell>
                        <TableCell>{format(new Date(item.first), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => { setOppForm(f => ({ ...f, title: `New product: ${item.name}`, source: 'customer_request', category: 'new_product' })); setOppSheetOpen(true); }}>
                            <Plus className="h-3 w-3 mr-1" />Create Opportunity
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-4 text-muted-foreground">All ordered products are matched</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ KAYDEN INSIGHTS ═══ */}
        <TabsContent value="kayden" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" />Kayden — R&D AI</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Last run: {kaydenOfficer?.last_run_at ? format(new Date(kaydenOfficer.last_run_at), 'MMM d, yyyy h:mm a') : 'Never'}
                </p>
              </div>
              <Button onClick={runKayden} disabled={runningKayden}>
                {runningKayden ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                Run Kayden Now
              </Button>
            </CardHeader>
          </Card>

          {suggestions.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Click "Run Kayden Now" to generate your first R&D analysis</CardContent></Card>
          )}

          {suggestions.map(s => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={priorityColor(s.priority)}>{s.priority}</Badge>
                    <CardTitle className="text-base">{s.title}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => handleSuggestion(s.id, 'approved')}><Check className="h-4 w-4 mr-1" />Approve</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleSuggestion(s.id, 'dismissed')}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{s.content}</p>
                {s.reasoning && (
                  <button className="text-xs text-muted-foreground mt-2 flex items-center gap-1" onClick={() => setExpandedSuggestion(expandedSuggestion === s.id ? null : s.id)}>
                    {expandedSuggestion === s.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}Reasoning
                  </button>
                )}
                {expandedSuggestion === s.id && <p className="text-xs text-muted-foreground mt-1 p-2 bg-muted rounded">{s.reasoning}</p>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
