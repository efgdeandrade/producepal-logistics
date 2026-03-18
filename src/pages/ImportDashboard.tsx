import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Plane,
  ArrowRight,
  Clock,
  ShoppingCart,
  Brain,
  Loader2,
  Zap,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { MarketNewsWidget } from '@/components/import/MarketNewsWidget';
import { useToast } from '@/hooks/use-toast';

export default function ImportDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch active orders in transit
  const { data: ordersInTransit } = useQuery({
    queryKey: ['orders-in-transit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['in_transit', 'processing'])
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch recent orders
  const { data: recentOrders } = useQuery({
    queryKey: ['recent-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch supplier summary
  const { data: suppliers } = useQuery({
    queryKey: ['supplier-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, country')
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch import shipments
  const { data: shipments } = useQuery({
    queryKey: ['import-shipments-overview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_shipments')
        .select('*')
        .order('estimated_arrival', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Zya officer
  const { data: zyaOfficer } = useQuery({
    queryKey: ['zya-officer'],
    queryFn: async () => {
      const { data } = await supabase.from('ai_chief_officers').select('*').eq('department', 'import').single();
      return data;
    },
  });

  // AI suggestions for import
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [runningZya, setRunningZya] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      const { data } = await supabase.from('ai_suggestions').select('*').eq('department', 'import').eq('status', 'pending').order('created_at', { ascending: false });
      setSuggestions(data || []);
    };
    fetchSuggestions();
    const channel = supabase.channel('import-suggestions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_suggestions', filter: 'department=eq.import' }, () => fetchSuggestions())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const runZya = async () => {
    setRunningZya(true);
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 60000));
      const invokePromise = supabase.functions.invoke('ai-chief-officers', { body: { officer: 'zya' } });
      await Promise.race([invokePromise, timeoutPromise]);
    } catch (e: any) {
      if (e.message !== 'timeout') console.error('Zya error:', e);
    } finally {
      setRunningZya(false);
      queryClient.invalidateQueries({ queryKey: ['zya-officer'] });
    }
  };

  const handleSuggestion = async (id: string, action: 'approved' | 'dismissed') => {
    await supabase.from('ai_suggestions').update({ status: action, actioned_at: new Date().toISOString(), actioned_by: user?.id } as any).eq('id', id);
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case 'critical': return 'destructive' as const;
      case 'high': return 'default' as const;
      case 'medium': return 'secondary' as const;
      default: return 'outline' as const;
    }
  };

  const shipmentStatusColor = (s: string) => {
    switch (s) {
      case 'ordered': return 'outline' as const;
      case 'in_transit': return 'default' as const;
      case 'customs': return 'secondary' as const;
      case 'arrived': case 'cleared': case 'delivered': return 'default' as const;
      case 'cancelled': return 'destructive' as const;
      default: return 'outline' as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Dashboard</h1>
          <p className="text-muted-foreground">
            Supplier orders, shipments, and import logistics
          </p>
        </div>
        <Button onClick={() => navigate('/import/orders/new')}>
          <ShoppingCart className="h-4 w-4 mr-2" />
          New Order
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="shipments"><Plane className="h-4 w-4 mr-2" />Shipments</TabsTrigger>
          <TabsTrigger value="zya"><Brain className="h-4 w-4 mr-2" />Zya</TabsTrigger>
        </TabsList>

        {/* ═══ OVERVIEW TAB (original content) ═══ */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Transit</CardTitle>
                <Plane className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{ordersInTransit?.length || 0}</div>
                <p className="text-xs text-muted-foreground">active shipments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{suppliers?.length || 0}</div>
                <p className="text-xs text-muted-foreground">in database</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent Orders</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{recentOrders?.length || 0}</div>
                <p className="text-xs text-muted-foreground">this week</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/import/orders')}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="h-8 w-8 text-primary" />
                  <div><p className="font-medium">Orders</p><p className="text-sm text-muted-foreground">View all orders</p></div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/import/suppliers')}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="h-8 w-8 text-primary" />
                  <div><p className="font-medium">Suppliers</p><p className="text-sm text-muted-foreground">Manage suppliers</p></div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/import/shipments')}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Plane className="h-8 w-8 text-primary" />
                  <div><p className="font-medium">Shipments</p><p className="text-sm text-muted-foreground">Track shipments</p></div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>

          {/* Bottom Row: News + Recent Orders */}
          <div className="grid gap-6 lg:grid-cols-2">
            <MarketNewsWidget />
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Orders</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/import/orders')}>
                  View All<ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardHeader>
              <CardContent>
                {recentOrders && recentOrders.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Week</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentOrders.map((order) => (
                        <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/import/orders/${order.id}`)}>
                          <TableCell className="font-medium">{order.order_number}</TableCell>
                          <TableCell>Week {order.week_number}</TableCell>
                          <TableCell><Badge variant="outline">{order.status}</Badge></TableCell>
                          <TableCell>{format(new Date(order.created_at), 'MMM d, yyyy')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No orders yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ SHIPMENTS TAB ═══ */}
        <TabsContent value="shipments" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Import Shipments</CardTitle></CardHeader>
            <CardContent>
              {(shipments || []).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shipment #</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Origin</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>ETA</TableHead>
                      <TableHead>CIF (XCG)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(shipments || []).map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.shipment_number}</TableCell>
                        <TableCell>{s.supplier_name}</TableCell>
                        <TableCell>{s.origin_country}</TableCell>
                        <TableCell><Badge variant={shipmentStatusColor(s.status)}>{s.status?.replace(/_/g, ' ')}</Badge></TableCell>
                        <TableCell>{s.estimated_arrival ? format(new Date(s.estimated_arrival), 'MMM d, yyyy') : '—'}</TableCell>
                        <TableCell>{Number(s.total_cif_xcg || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No shipments yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ ZYA INSIGHTS TAB ═══ */}
        <TabsContent value="zya" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" />Zya — Import AI</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Last run: {zyaOfficer?.last_run_at ? format(new Date(zyaOfficer.last_run_at), 'MMM d, yyyy h:mm a') : 'Never'}
                </p>
              </div>
              <Button onClick={runZya} disabled={runningZya}>
                {runningZya ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                Run Zya Now
              </Button>
            </CardHeader>
          </Card>

          {suggestions.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Click "Run Zya Now" to generate your first import analysis</CardContent></Card>
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
