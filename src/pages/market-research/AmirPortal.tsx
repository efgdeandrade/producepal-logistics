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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, Package, Ship, DollarSign, Brain, Zap, Loader2, ChevronLeft, ChevronDown, ChevronUp, Check, X, Plus } from 'lucide-react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function AmirPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [runningAmir, setRunningAmir] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [showAddSignal, setShowAddSignal] = useState(false);
  const [newSignal, setNewSignal] = useState({ signal_type: 'trend', title: '', description: '', relevance_score: 0.5 });

  // Market signals
  const { data: signals, isLoading: signalsLoading } = useQuery({
    queryKey: ['market-signals'],
    queryFn: async () => {
      const { data } = await supabase.from('rd_market_signals').select('*').order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  // Top products this month
  const { data: topProducts } = useQuery({
    queryKey: ['market-top-products'],
    queryFn: async () => {
      const monthAgo = subMonths(new Date(), 1).toISOString();
      const twoMonthsAgo = subMonths(new Date(), 2).toISOString();
      const { data: currentItems } = await supabase
        .from('distribution_order_items')
        .select('product_name_raw')
        .gte('created_at', monthAgo)
        .limit(500);

      const { data: prevItems } = await supabase
        .from('distribution_order_items')
        .select('product_name_raw')
        .gte('created_at', twoMonthsAgo)
        .lt('created_at', monthAgo)
        .limit(500);

      const countItems = (items: any[]) => {
        const counts: Record<string, number> = {};
        items.forEach((i: any) => {
          const n = (i.product_name_raw || '').toLowerCase().trim();
          if (n) counts[n] = (counts[n] || 0) + 1;
        });
        return counts;
      };

      const current = countItems(currentItems || []);
      const prev = countItems(prevItems || []);

      const allProducts = [...new Set([...Object.keys(current), ...Object.keys(prev)])];
      return allProducts
        .map(p => ({ name: p, current: current[p] || 0, previous: prev[p] || 0 }))
        .sort((a, b) => b.current - a.current)
        .slice(0, 10);
    },
  });

  // Import shipments
  const { data: shipments, isLoading: shipmentsLoading } = useQuery({
    queryKey: ['market-shipments'],
    queryFn: async () => {
      const { data } = await supabase.from('import_shipments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Amir officer
  const { data: amirOfficer } = useQuery({
    queryKey: ['amir-officer'],
    queryFn: async () => {
      const { data } = await supabase.from('ai_chief_officers').select('*').eq('department', 'market_research').single();
      return data;
    },
  });

  // AI suggestions
  const [suggestions, setSuggestions] = useState<any[]>([]);
  useEffect(() => {
    const fetchSuggestions = async () => {
      const { data } = await supabase.from('ai_suggestions').select('*')
        .eq('department', 'market_research').eq('status', 'pending')
        .order('created_at', { ascending: false });
      setSuggestions(data || []);
    };
    fetchSuggestions();
    const channel = supabase.channel('market-research-suggestions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_suggestions', filter: 'department=eq.market_research' }, () => fetchSuggestions())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Stats
  const activeSignals = signals?.filter((s: any) => s.status === 'new').length || 0;
  const topProduct = topProducts?.[0]?.name || '—';
  const activeShipments = shipments?.filter((s: any) => ['ordered', 'in_transit'].includes(s.status)).length || 0;
  const recentShipments = shipments?.filter((s: any) => {
    const threeMonthsAgo = subMonths(new Date(), 3).toISOString();
    return s.created_at >= threeMonthsAgo;
  }) || [];
  const avgCIF = recentShipments.length
    ? (recentShipments.reduce((s: number, sh: any) => s + Number(sh.total_cif_xcg || 0), 0) / recentShipments.length)
    : 0;

  // Monthly import chart data
  const monthlyImportData = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(new Date(), 5 - i);
    const monthStart = startOfMonth(month).toISOString();
    const nextMonth = startOfMonth(subMonths(new Date(), 4 - i)).toISOString();
    const monthShipments = shipments?.filter((s: any) => s.created_at >= monthStart && (i < 5 ? s.created_at < nextMonth : true)) || [];
    return {
      month: format(month, 'MMM'),
      value: monthShipments.reduce((s: number, sh: any) => s + Number(sh.total_cif_xcg || 0), 0),
    };
  });

  const handleRunAmir = async () => {
    setRunningAmir(true);
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 60000));
      const invokePromise = supabase.functions.invoke('ai-chief-officers', { body: { officer: 'amir' } });
      await Promise.race([invokePromise, timeoutPromise]);
      toast({ title: '✅ Amir analysis complete' });
    } catch (e: any) {
      if (e.message === 'timeout') {
        toast({ title: '⚡ Amir is running', description: 'Suggestions will appear shortly.' });
      } else {
        toast({ title: 'Error running Amir', description: e.message, variant: 'destructive' });
      }
    } finally {
      setRunningAmir(false);
    }
  };

  const handleSuggestionAction = async (id: string, status: 'approved' | 'dismissed') => {
    await supabase.from('ai_suggestions').update({ status, actioned_by: user?.id, actioned_at: new Date().toISOString() }).eq('id', id);
    toast({ title: `Suggestion ${status}` });
  };

  const handleAddSignal = async () => {
    const { error } = await supabase.from('rd_market_signals').insert({
      signal_type: newSignal.signal_type,
      title: newSignal.title,
      description: newSignal.description,
      relevance_score: newSignal.relevance_score,
      status: 'new',
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Signal added' });
      setShowAddSignal(false);
      setNewSignal({ signal_type: 'trend', title: '', description: '', relevance_score: 0.5 });
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'ordered': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'in_transit': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
      case 'customs': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'arrived': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Seasonal calendar data
  const seasonalData = [
    { product: 'Mango', jan: '○', feb: '○', mar: '●', apr: '●', may: '●', jun: '●', jul: '●', aug: '○', sep: '○', oct: '○', nov: '○', dec: '○' },
    { product: 'Avocado', jan: '●', feb: '●', mar: '●', apr: '○', may: '○', jun: '○', jul: '○', aug: '○', sep: '●', oct: '●', nov: '●', dec: '●' },
    { product: 'Papaya', jan: '●', feb: '●', mar: '●', apr: '●', may: '●', jun: '●', jul: '●', aug: '●', sep: '●', oct: '●', nov: '●', dec: '●' },
    { product: 'Plantain', jan: '●', feb: '●', mar: '●', apr: '●', may: '●', jun: '●', jul: '●', aug: '●', sep: '●', oct: '●', nov: '●', dec: '●' },
    { product: 'Passion Fruit', jan: '○', feb: '○', mar: '●', apr: '●', may: '●', jun: '○', jul: '○', aug: '○', sep: '●', oct: '●', nov: '○', dec: '○' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="portal-header">
        <div className="flex items-center gap-2 pt-1">
          <button onClick={() => navigate('/select-portal')} className="p-1 -ml-1 rounded-md hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold leading-tight">Market Research</h1>
            <p className="text-xs text-muted-foreground">Trends, import intelligence, Amir AI insights</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">
        <Tabs defaultValue="overview" className="space-y-4">
          <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
            <TabsList className="inline-flex w-max min-w-full">
              <TabsTrigger value="overview">Market Overview</TabsTrigger>
              <TabsTrigger value="import">Import Intelligence</TabsTrigger>
              <TabsTrigger value="amir">Amir Insights</TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1 — Market Overview */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {[
                { label: 'Active Signals', value: activeSignals, icon: TrendingUp },
                { label: 'Top Product', value: topProduct, icon: Package },
                { label: 'Active Shipments', value: activeShipments, icon: Ship },
                { label: 'Avg Import CIF', value: `XCG ${avgCIF.toFixed(0)}`, icon: DollarSign },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold truncate">{stat.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Demand Trends Chart */}
            <Card>
              <CardHeader><CardTitle>Demand Trends — Top 10 Products</CardTitle></CardHeader>
              <CardContent className="h-[350px]">
                {topProducts?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" className="text-xs fill-muted-foreground" />
                      <YAxis dataKey="name" type="category" width={80} className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="current" name="This Month" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="previous" name="Last Month" fill="hsl(var(--muted-foreground) / 0.3)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No order data yet</div>
                )}
              </CardContent>
            </Card>

            {/* Seasonal Calendar */}
            <Card>
              <CardHeader><CardTitle>Seasonal Calendar — Curaçao Produce</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
                          <TableHead key={m} className="text-center text-xs px-2">{m}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {seasonalData.map(row => (
                        <TableRow key={row.product}>
                          <TableCell className="font-medium text-sm">{row.product}</TableCell>
                          {['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].map(m => (
                            <TableCell key={m} className="text-center text-sm px-2">
                              <span className={(row as any)[m] === '●' ? 'text-primary font-bold' : 'text-muted-foreground'}>
                                {(row as any)[m]}
                              </span>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">● = Peak season • ○ = Off-season</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2 — Import Intelligence */}
          <TabsContent value="import" className="space-y-6">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Import Value (3mo)</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">XCG {recentShipments.reduce((s: number, sh: any) => s + Number(sh.total_cif_xcg || 0), 0).toFixed(0)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Top Supplier</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold truncate">{(() => {
                  const counts: Record<string, number> = {};
                  recentShipments.forEach((s: any) => { counts[s.supplier_name || 'Unknown'] = (counts[s.supplier_name || 'Unknown'] || 0) + 1; });
                  return Object.entries(counts).sort(([,a],[,b]) => b - a)[0]?.[0] || '—';
                })()}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Shipments</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{shipments?.length || 0}</div></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Monthly Import CIF Value</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyImportData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Shipments</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowAddSignal(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Market Signal
                </Button>
              </CardHeader>
              <CardContent>
                {shipmentsLoading ? (
                  <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Shipment #</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Origin</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Order Date</TableHead>
                          <TableHead>ETA</TableHead>
                          <TableHead>CIF XCG</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shipments?.slice(0, 20).map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium text-sm">{s.shipment_number || s.id.slice(0, 8)}</TableCell>
                            <TableCell className="text-sm">{s.supplier_name || '—'}</TableCell>
                            <TableCell className="text-sm">{s.origin_country || '—'}</TableCell>
                            <TableCell><Badge className={statusColor(s.status)}>{s.status}</Badge></TableCell>
                            <TableCell className="text-sm">{s.created_at ? format(new Date(s.created_at), 'MMM d') : '—'}</TableCell>
                            <TableCell className="text-sm">{s.estimated_arrival ? format(new Date(s.estimated_arrival), 'MMM d') : '—'}</TableCell>
                            <TableCell className="text-sm">{Number(s.total_cif_xcg || 0).toFixed(0)}</TableCell>
                          </TableRow>
                        ))}
                        {(!shipments || shipments.length === 0) && (
                          <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No shipments found</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3 — Amir Insights */}
          <TabsContent value="amir" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <CardTitle>Amir — Market Research AI</CardTitle>
                  {amirOfficer?.last_run_at && (
                    <span className="text-xs text-muted-foreground">Last run: {format(new Date(amirOfficer.last_run_at), 'MMM d, HH:mm')}</span>
                  )}
                </div>
                <Button onClick={handleRunAmir} disabled={runningAmir}>
                  {runningAmir ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                  Run Amir Now
                </Button>
              </CardHeader>
              <CardContent>
                {suggestions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="text-4xl mb-4">🔍</div>
                    <h3 className="font-semibold text-lg mb-2">Amir hasn't run yet</h3>
                    <p className="text-muted-foreground text-sm mb-4 max-w-sm">
                      Click "Run Amir Now" to generate market research insights based on demand trends, import data, and market signals.
                    </p>
                    <Button onClick={handleRunAmir} disabled={runningAmir}>
                      {runningAmir ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                      Run Amir Now
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
      </div>

      {/* Add Market Signal Sheet */}
      <Sheet open={showAddSignal} onOpenChange={setShowAddSignal}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Market Signal</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Signal Type</Label>
              <Select value={newSignal.signal_type} onValueChange={(v) => setNewSignal({ ...newSignal, signal_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trend">Trend</SelectItem>
                  <SelectItem value="competitor">Competitor</SelectItem>
                  <SelectItem value="pricing">Pricing</SelectItem>
                  <SelectItem value="supply">Supply</SelectItem>
                  <SelectItem value="demand">Demand</SelectItem>
                  <SelectItem value="regulatory">Regulatory</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title</Label>
              <Input value={newSignal.title} onChange={(e) => setNewSignal({ ...newSignal, title: e.target.value })} placeholder="e.g., Mango prices increasing" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={newSignal.description} onChange={(e) => setNewSignal({ ...newSignal, description: e.target.value })} className="h-24" />
            </div>
            <div>
              <Label>Relevance Score: {newSignal.relevance_score.toFixed(1)}</Label>
              <Slider
                value={[newSignal.relevance_score]}
                onValueChange={([v]) => setNewSignal({ ...newSignal, relevance_score: v })}
                min={0} max={1} step={0.1}
                className="mt-2"
              />
            </div>
            <Button onClick={handleAddSignal} disabled={!newSignal.title.trim()} className="w-full">
              Add Signal
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
