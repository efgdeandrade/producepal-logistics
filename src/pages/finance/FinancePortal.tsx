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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, AlertTriangle, ShoppingCart, CreditCard, Check, X, Loader2, ChevronDown, ChevronUp, Zap, Brain, ChevronLeft } from 'lucide-react';
import { format, subWeeks, startOfWeek } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function FinancePortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [payDialog, setPayDialog] = useState<any>(null);
  const [payMethod, setPayMethod] = useState('cod_cash');
  const [paying, setPaying] = useState(false);
  const [zoneFilter, setZoneFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [runningAce, setRunningAce] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

  // Revenue summary
  const { data: revenue, isLoading: revLoading } = useQuery({
    queryKey: ['finance-revenue'],
    queryFn: async () => {
      const { data } = await supabase.from('finance_revenue_summary').select('*');
      return data || [];
    },
  });

  // Outstanding balances
  const { data: balances, isLoading: balLoading, refetch: refetchBalances } = useQuery({
    queryKey: ['finance-balances'],
    queryFn: async () => {
      const { data } = await supabase.from('customer_outstanding_balances').select('*').order('outstanding_xcg', { ascending: false });
      return data || [];
    },
  });

  // Invoices
  const { data: invoices, isLoading: invLoading } = useQuery({
    queryKey: ['finance-invoices'],
    queryFn: async () => {
      const { data } = await supabase.from('distribution_invoices').select('*').order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  // Ace officer info
  const { data: aceOfficer } = useQuery({
    queryKey: ['ace-officer'],
    queryFn: async () => {
      const { data } = await supabase.from('ai_chief_officers').select('*').eq('department', 'finance').single();
      return data;
    },
  });

  // AI suggestions for finance
  const [suggestions, setSuggestions] = useState<any[]>([]);
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('ai_suggestions').select('*').eq('department', 'finance').eq('status', 'pending').order('created_at', { ascending: false });
      setSuggestions(data || []);
    };
    fetch();
    const channel = supabase.channel('finance-suggestions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_suggestions', filter: 'department=eq.finance' }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Computed stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekStart = startOfWeek(now).toISOString();

  const monthRevenue = revenue?.filter((r: any) => r.month_start >= monthStart).reduce((s: number, r: any) => s + Number(r.total_revenue_xcg || 0), 0) || 0;
  const totalOutstanding = balances?.reduce((s: number, b: any) => s + Number(b.outstanding_xcg || 0), 0) || 0;
  const weekOrders = revenue?.filter((r: any) => r.week_start >= weekStart).reduce((s: number, r: any) => s + Number(r.order_count || 0), 0) || 0;
  const unpaidOrders = balances?.reduce((s: number, b: any) => s + Number(b.unpaid_orders || 0), 0) || 0;

  // Chart data — last 8 weeks
  const weeklyData = Array.from({ length: 8 }, (_, i) => {
    const ws = startOfWeek(subWeeks(now, 7 - i)).toISOString().slice(0, 10);
    const match = revenue?.filter((r: any) => r.week_start?.slice(0, 10) === ws);
    const total = match?.reduce((s: number, r: any) => s + Number(r.total_revenue_xcg || 0), 0) || 0;
    return { week: format(subWeeks(now, 7 - i), 'MMM d'), revenue: total };
  });

  const codTotal = revenue?.reduce((s: number, r: any) => s + Number(r.cod_revenue_xcg || 0), 0) || 0;
  const creditTotal = revenue?.reduce((s: number, r: any) => s + Number(r.credit_revenue_xcg || 0), 0) || 0;
  const pieData = [
    { name: 'COD', value: codTotal },
    { name: 'Credit', value: creditTotal },
  ];

  const filteredBalances = balances?.filter((b: any) => {
    if (zoneFilter !== 'all' && b.zone !== zoneFilter) return false;
    if (typeFilter !== 'all' && b.customer_type !== typeFilter) return false;
    return true;
  });

  const handleMarkPaid = async () => {
    if (!payDialog) return;
    setPaying(true);
    const { error } = await supabase.from('distribution_orders')
      .update({ payment_status: 'paid', paid_at: new Date().toISOString(), payment_method: payMethod, paid_by: user?.id })
      .eq('customer_id', payDialog.customer_id)
      .in('status', ['confirmed', 'delivered'])
      .or('payment_status.is.null,payment_status.neq.paid');
    setPaying(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Marked as paid' });
      setPayDialog(null);
      refetchBalances();
    }
  };

  const handleRunAce = async () => {
    setRunningAce(true);
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 60000));
      const invokePromise = supabase.functions.invoke('ai-chief-officers', { body: { officer: 'ace' } });
      await Promise.race([invokePromise, timeoutPromise]);
      toast({ title: '✅ Ace analysis complete' });
    } catch (e: any) {
      if (e.message === 'timeout') {
        toast({ title: '⚡ Ace is running', description: 'Suggestions will appear shortly.' });
      } else {
        toast({ title: 'Error running Ace', description: e.message, variant: 'destructive' });
      }
    } finally {
      setRunningAce(false);
    }
  };

  const handleSuggestionAction = async (id: string, status: 'approved' | 'dismissed') => {
    await supabase.from('ai_suggestions').update({ status, actioned_by: user?.id, actioned_at: new Date().toISOString() }).eq('id', id);
    toast({ title: `Suggestion ${status}` });
  };

  const outstandingColor = (val: number) => {
    if (val > 500) return 'text-destructive font-semibold';
    if (val > 100) return 'text-warning font-semibold';
    return '';
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-top">
        <div className="flex h-14 items-center px-4 gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/select-portal')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Finance</span>
          </div>
          <div className="flex-1" />
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">
      <div className="flex-shrink-0">
        <h1 className="text-xl md:text-3xl font-bold tracking-tight">Finance</h1>
        <p className="text-sm text-muted-foreground">Revenue, payments, and financial insights</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
          <TabsList className="inline-flex w-max min-w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="balances">Balances</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="ace">Ace</TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1 — Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {[
              { label: 'Revenue This Month', value: `XCG ${monthRevenue.toFixed(2)}`, icon: DollarSign },
              { label: 'Outstanding Balance', value: `XCG ${totalOutstanding.toFixed(2)}`, icon: AlertTriangle },
              { label: 'Orders This Week', value: weekOrders, icon: ShoppingCart },
              { label: 'Unpaid Orders', value: unpaidOrders, icon: CreditCard },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{revLoading ? <Skeleton className="h-8 w-24" /> : stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Weekly Revenue (Last 8 Weeks)</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="week" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="hsl(186, 90%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Payment Split</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" labelLine={false} outerRadius={100} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      <Cell fill="hsl(186, 90%, 45%)" />
                      <Cell fill="hsl(188, 86%, 53%)" />
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2 — Outstanding Balances */}
        <TabsContent value="balances" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Zone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                <SelectItem value="pariba">Pariba</SelectItem>
                <SelectItem value="meimei">Meimei</SelectItem>
                <SelectItem value="pabou">Pabou</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="wholesale">Wholesale</SelectItem>
                <SelectItem value="horeca">Horeca</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {balLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead>Terms</TableHead>
                      <TableHead>Unpaid Orders</TableHead>
                      <TableHead>Outstanding XCG</TableHead>
                      <TableHead>Last Order</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBalances?.map((b: any) => (
                      <TableRow key={b.customer_id}>
                        <TableCell className="font-medium">{b.customer_name}</TableCell>
                        <TableCell><Badge variant="outline">{b.customer_type}</Badge></TableCell>
                        <TableCell>{b.zone || '—'}</TableCell>
                        <TableCell>{b.payment_terms || '—'}</TableCell>
                        <TableCell>{b.unpaid_orders}</TableCell>
                        <TableCell className={outstandingColor(Number(b.outstanding_xcg))}>{Number(b.outstanding_xcg).toFixed(2)}</TableCell>
                        <TableCell>{b.last_order_date ? format(new Date(b.last_order_date), 'MMM d') : '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => setPayDialog(b)}>Mark Paid</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                              <a href={`https://wa.me/?text=${encodeURIComponent(`Hi ${b.customer_name}, this is a friendly reminder about your outstanding balance of XCG ${Number(b.outstanding_xcg).toFixed(2)} with FUIK. Please arrange payment at your earliest convenience. Thank you!`)}`} target="_blank" rel="noopener">Remind</a>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!filteredBalances || filteredBalances.length === 0) && (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No outstanding balances</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* TAB 3 — Invoices */}
        <TabsContent value="invoices" className="space-y-4">
          {invLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total XCG</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices?.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number || inv.id.slice(0, 8)}</TableCell>
                        <TableCell>{inv.customer_name || '—'}</TableCell>
                        <TableCell>{inv.created_at ? format(new Date(inv.created_at), 'MMM d, yyyy') : '—'}</TableCell>
                        <TableCell><Badge variant="outline">{inv.status || 'draft'}</Badge></TableCell>
                        <TableCell>{Number(inv.total_xcg || inv.total || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    {(!invoices || invoices.length === 0) && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No invoices found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* TAB 4 — Ace Insights */}
        <TabsContent value="ace" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <CardTitle>Ace — Finance AI</CardTitle>
                {aceOfficer?.last_run_at && (
                  <span className="text-xs text-muted-foreground">Last run: {format(new Date(aceOfficer.last_run_at), 'MMM d, HH:mm')}</span>
                )}
              </div>
              <Button onClick={handleRunAce} disabled={runningAce}>
                {runningAce ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                Run Ace Now
              </Button>
            </CardHeader>
            <CardContent>
              {suggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="text-4xl mb-4">🤖</div>
                  <h3 className="font-semibold text-lg mb-2">Ace hasn't run yet today</h3>
                  <p className="text-muted-foreground text-sm mb-4 max-w-sm">
                    Click "Run Ace Now" to generate your first financial analysis.
                    Ace will analyze your orders, customers, and balances to surface actionable insights.
                  </p>
                  <Button onClick={handleRunAce} disabled={runningAce}>
                    {runningAce ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                    Run Ace Now
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((s) => (
                    <Card key={s.id} className="border">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={s.priority === 'critical' ? 'destructive' : s.priority === 'high' ? 'destructive' : 'secondary'}>
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

      {/* Mark Paid Dialog */}
      <Dialog open={!!payDialog} onOpenChange={() => setPayDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Orders Paid — {payDialog?.customer_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will mark all {payDialog?.unpaid_orders} unpaid orders (XCG {Number(payDialog?.outstanding_xcg || 0).toFixed(2)}) as paid.
            </p>
            <Select value={payMethod} onValueChange={setPayMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cod_cash">COD Cash</SelectItem>
                <SelectItem value="cod_swipe">COD Swipe</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancel</Button>
            <Button onClick={handleMarkPaid} disabled={paying}>
              {paying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
