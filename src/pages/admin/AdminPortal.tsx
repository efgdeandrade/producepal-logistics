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
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  ClipboardList, FileText, Truck, Brain, Plus, Loader2, Check, X,
  AlertTriangle, ChevronDown, ChevronUp, Zap, ChevronLeft, Upload,
  Download, Trash2, Edit, Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TASK_CATEGORIES = ['general', 'supplier', 'customs', 'permit', 'payment', 'compliance', 'internal', 'other'] as const;
const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const TASK_STATUSES = ['open', 'in_progress', 'completed', 'cancelled'] as const;
const DOC_TYPES = ['contract', 'invoice', 'customs_declaration', 'import_permit', 'health_certificate', 'phytosanitary', 'certificate_of_origin', 'bill_of_lading', 'packing_list', 'other'] as const;
const SHIPMENT_STATUSES = ['ordered', 'in_transit', 'customs', 'arrived', 'cleared', 'delivered', 'cancelled'] as const;

const priorityColor = (p: string) => {
  switch (p) {
    case 'urgent': case 'critical': return 'destructive';
    case 'high': return 'default';
    case 'medium': return 'secondary';
    default: return 'outline';
  }
};

const shipmentStatusColor = (s: string) => {
  switch (s) {
    case 'ordered': return 'outline';
    case 'in_transit': return 'default';
    case 'customs': return 'secondary';
    case 'arrived': return 'default';
    case 'cleared': case 'delivered': return 'default';
    case 'cancelled': return 'destructive';
    default: return 'outline';
  }
};

export default function AdminPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ═══ TASKS ═══
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['admin-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_tasks').select('*, assigned_profile:profiles!admin_tasks_assigned_to_fkey(full_name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const [taskForm, setTaskForm] = useState({ title: '', description: '', category: 'general', priority: 'medium', due_date: '' });
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(false);

  const saveTask = async () => {
    setSavingTask(true);
    const { error } = await supabase.from('admin_tasks').insert({
      ...taskForm,
      due_date: taskForm.due_date || null,
      created_by: user?.id,
    } as any);
    setSavingTask(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Task created' });
    setTaskSheetOpen(false);
    setTaskForm({ title: '', description: '', category: 'general', priority: 'medium', due_date: '' });
    queryClient.invalidateQueries({ queryKey: ['admin-tasks'] });
  };

  const completeTask = async (id: string) => {
    await supabase.from('admin_tasks').update({ status: 'completed', completed_at: new Date().toISOString(), completed_by: user?.id } as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['admin-tasks'] });
  };

  const deleteTask = async (id: string) => {
    await supabase.from('admin_tasks').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['admin-tasks'] });
  };

  // ═══ SUPPLIER DOCUMENTS ═══
  const { data: docs, isLoading: docsLoading } = useQuery({
    queryKey: ['supplier-documents'],
    queryFn: async () => {
      const { data, error } = await supabase.from('supplier_documents').select('*').order('expiry_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const [docForm, setDocForm] = useState({ supplier_name: '', document_type: 'contract', title: '', document_number: '', issue_date: '', expiry_date: '', notes: '' });
  const [docSheetOpen, setDocSheetOpen] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);

  const saveDoc = async () => {
    setSavingDoc(true);
    let storagePath = null;
    if (docFile) {
      const path = `${Date.now()}-${docFile.name}`;
      const { error: uploadErr } = await supabase.storage.from('supplier-documents').upload(path, docFile);
      if (uploadErr) { toast({ title: 'Upload failed', description: uploadErr.message, variant: 'destructive' }); setSavingDoc(false); return; }
      storagePath = path;
    }
    const { error } = await supabase.from('supplier_documents').insert({
      ...docForm,
      issue_date: docForm.issue_date || null,
      expiry_date: docForm.expiry_date || null,
      storage_path: storagePath,
      uploaded_by: user?.id,
    } as any);
    setSavingDoc(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Document saved' });
    setDocSheetOpen(false);
    setDocForm({ supplier_name: '', document_type: 'contract', title: '', document_number: '', issue_date: '', expiry_date: '', notes: '' });
    setDocFile(null);
    queryClient.invalidateQueries({ queryKey: ['supplier-documents'] });
  };

  const deleteDoc = async (id: string) => {
    await supabase.from('supplier_documents').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['supplier-documents'] });
  };

  const expiredDocs = (docs || []).filter(d => d.expiry_date && new Date(d.expiry_date) < new Date() && d.status === 'active');
  const expiringDocs = (docs || []).filter(d => {
    if (!d.expiry_date || d.status !== 'active') return false;
    const exp = new Date(d.expiry_date);
    const now = new Date();
    return exp >= now && exp <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  });
  const needsAttention = expiredDocs.length + expiringDocs.length;

  // ═══ SHIPMENTS ═══
  const { data: shipments, isLoading: shipmentsLoading } = useQuery({
    queryKey: ['import-shipments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('import_shipments').select('*').order('estimated_arrival', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const [shipForm, setShipForm] = useState({ shipment_number: '', supplier_name: '', origin_country: 'Colombia', status: 'ordered', order_date: '', estimated_arrival: '', total_cif_xcg: '', container_count: '1', notes: '' });
  const [shipSheetOpen, setShipSheetOpen] = useState(false);
  const [savingShip, setSavingShip] = useState(false);

  const saveShipment = async () => {
    setSavingShip(true);
    const { error } = await supabase.from('import_shipments').insert({
      ...shipForm,
      order_date: shipForm.order_date || null,
      estimated_arrival: shipForm.estimated_arrival || null,
      total_cif_xcg: parseFloat(shipForm.total_cif_xcg) || 0,
      container_count: parseInt(shipForm.container_count) || 1,
      created_by: user?.id,
    } as any);
    setSavingShip(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Shipment created' });
    setShipSheetOpen(false);
    setShipForm({ shipment_number: '', supplier_name: '', origin_country: 'Colombia', status: 'ordered', order_date: '', estimated_arrival: '', total_cif_xcg: '', container_count: '1', notes: '' });
    queryClient.invalidateQueries({ queryKey: ['import-shipments'] });
  };

  const updateShipmentStatus = async (id: string, newStatus: string) => {
    const update: any = { status: newStatus };
    if (newStatus === 'arrived') update.actual_arrival = new Date().toISOString().split('T')[0];
    await supabase.from('import_shipments').update(update).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['import-shipments'] });
    toast({ title: `Status updated to ${newStatus}` });
  };

  const shipmentPipeline = SHIPMENT_STATUSES.filter(s => s !== 'cancelled').map(s => ({
    status: s,
    count: (shipments || []).filter(sh => sh.status === s).length,
  }));

  // ═══ AXEL INSIGHTS ═══
  const { data: axelOfficer } = useQuery({
    queryKey: ['axel-officer'],
    queryFn: async () => {
      const { data } = await supabase.from('ai_chief_officers').select('*').eq('department', 'administration').single();
      return data;
    },
  });

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [runningAxel, setRunningAxel] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('ai_suggestions').select('*').eq('department', 'administration').eq('status', 'pending').order('created_at', { ascending: false });
      setSuggestions(data || []);
    };
    fetch();
    const channel = supabase.channel('admin-suggestions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_suggestions', filter: 'department=eq.administration' }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const runAxel = async () => {
    setRunningAxel(true);
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 60000));
      const invokePromise = supabase.functions.invoke('ai-chief-officers', { body: { officer: 'axel' } });
      await Promise.race([invokePromise, timeoutPromise]);
    } catch (e: any) {
      if (e.message !== 'timeout') console.error('Axel error:', e);
    } finally {
      setRunningAxel(false);
      queryClient.invalidateQueries({ queryKey: ['axel-officer'] });
    }
  };

  const handleSuggestion = async (id: string, action: 'approved' | 'dismissed') => {
    await supabase.from('ai_suggestions').update({ status: action, actioned_at: new Date().toISOString(), actioned_by: user?.id } as any).eq('id', id);
  };

  // Stats
  const openTasks = (tasks || []).filter(t => t.status === 'open').length;
  const overdueTasks = (tasks || []).filter(t => t.status !== 'completed' && t.status !== 'cancelled' && t.due_date && new Date(t.due_date) < new Date()).length;
  const inProgressTasks = (tasks || []).filter(t => t.status === 'in_progress').length;
  const completedThisWeek = (tasks || []).filter(t => t.status === 'completed' && t.completed_at && new Date(t.completed_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;

  return (
    <div className="space-y-4">
      <div className="flex-shrink-0">
        <h1 className="text-xl md:text-3xl font-bold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground">Supplier documents, tasks, shipments & Axel AI</p>
      </div>

      <Tabs defaultValue="tasks">
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
          <TabsList className="inline-flex w-max min-w-full">
            <TabsTrigger value="tasks"><ClipboardList className="h-4 w-4 mr-1" />Tasks</TabsTrigger>
            <TabsTrigger value="documents"><FileText className="h-4 w-4 mr-1" />Docs</TabsTrigger>
            <TabsTrigger value="shipments"><Truck className="h-4 w-4 mr-1" />Ships</TabsTrigger>
            <TabsTrigger value="axel"><Brain className="h-4 w-4 mr-1" />Axel</TabsTrigger>
          </TabsList>
        </div>

        {/* ═══ TASKS TAB ═══ */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Open</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{openTasks}</div></CardContent></Card>
            <Card className={overdueTasks > 0 ? 'border-destructive' : ''}><CardHeader className="pb-2"><CardTitle className="text-sm">Overdue</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${overdueTasks > 0 ? 'text-destructive' : ''}`}>{overdueTasks}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">In Progress</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{inProgressTasks}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Done This Week</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{completedThisWeek}</div></CardContent></Card>
          </div>

          <div className="flex justify-end">
            <Sheet open={taskSheetOpen} onOpenChange={setTaskSheetOpen}>
              <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Task</Button></SheetTrigger>
              <SheetContent>
                <SheetHeader><SheetTitle>New Task</SheetTitle></SheetHeader>
                <div className="space-y-4 mt-4">
                  <Input placeholder="Title *" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} />
                  <Textarea placeholder="Description" value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} />
                  <Select value={taskForm.category} onValueChange={v => setTaskForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TASK_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={taskForm.priority} onValueChange={v => setTaskForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TASK_PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} />
                  <Button onClick={saveTask} disabled={!taskForm.title || savingTask} className="w-full">
                    {savingTask ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tasks || []).map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.title}</TableCell>
                        <TableCell><Badge variant="outline">{t.category}</Badge></TableCell>
                        <TableCell><Badge variant={priorityColor(t.priority)}>{t.priority}</Badge></TableCell>
                        <TableCell className={t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed' ? 'text-destructive font-medium' : ''}>
                          {t.due_date ? format(new Date(t.due_date), 'MMM d, yyyy') : '—'}
                        </TableCell>
                        <TableCell><Badge variant="outline">{t.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {t.status !== 'completed' && (
                              <Button size="icon" variant="ghost" onClick={() => completeTask(t.id)}><Check className="h-4 w-4 text-green-600" /></Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => deleteTask(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!tasks?.length && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No tasks yet</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ DOCUMENTS TAB ═══ */}
        <TabsContent value="documents" className="space-y-4">
          {needsAttention > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">⚠️ {needsAttention} document(s) need attention</span>
            </div>
          )}

          <div className="flex justify-end">
            <Sheet open={docSheetOpen} onOpenChange={setDocSheetOpen}>
              <SheetTrigger asChild><Button><Upload className="h-4 w-4 mr-2" />Upload Document</Button></SheetTrigger>
              <SheetContent>
                <SheetHeader><SheetTitle>Upload Supplier Document</SheetTitle></SheetHeader>
                <ScrollArea className="h-[calc(100vh-120px)]">
                  <div className="space-y-4 mt-4 pr-4">
                    <Input placeholder="Supplier Name *" value={docForm.supplier_name} onChange={e => setDocForm(f => ({ ...f, supplier_name: e.target.value }))} />
                    <Select value={docForm.document_type} onValueChange={v => setDocForm(f => ({ ...f, document_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input placeholder="Title *" value={docForm.title} onChange={e => setDocForm(f => ({ ...f, title: e.target.value }))} />
                    <Input placeholder="Document Number" value={docForm.document_number} onChange={e => setDocForm(f => ({ ...f, document_number: e.target.value }))} />
                    <div className="space-y-1"><label className="text-sm text-muted-foreground">Issue Date</label><Input type="date" value={docForm.issue_date} onChange={e => setDocForm(f => ({ ...f, issue_date: e.target.value }))} /></div>
                    <div className="space-y-1"><label className="text-sm text-muted-foreground">Expiry Date</label><Input type="date" value={docForm.expiry_date} onChange={e => setDocForm(f => ({ ...f, expiry_date: e.target.value }))} /></div>
                    <Textarea placeholder="Notes" value={docForm.notes} onChange={e => setDocForm(f => ({ ...f, notes: e.target.value }))} />
                    <Input type="file" onChange={e => setDocFile(e.target.files?.[0] || null)} />
                    <Button onClick={saveDoc} disabled={!docForm.supplier_name || !docForm.title || savingDoc} className="w-full">
                      {savingDoc ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save
                    </Button>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Doc #</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(docs || []).map(d => {
                    const isExpired = d.expiry_date && new Date(d.expiry_date) < new Date();
                    const isExpiring = d.expiry_date && !isExpired && new Date(d.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.supplier_name}</TableCell>
                        <TableCell><Badge variant="outline">{(d.document_type || '').replace(/_/g, ' ')}</Badge></TableCell>
                        <TableCell>{d.title}</TableCell>
                        <TableCell>{d.document_number || '—'}</TableCell>
                        <TableCell className={isExpired ? 'text-destructive font-medium' : isExpiring ? 'text-amber-600 font-medium' : ''}>
                          {d.expiry_date ? format(new Date(d.expiry_date), 'MMM d, yyyy') : '—'}
                        </TableCell>
                        <TableCell><Badge variant={d.status === 'active' ? 'default' : 'outline'}>{d.status}</Badge></TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => deleteDoc(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!docs?.length && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No documents yet</TableCell></TableRow>}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ SHIPMENTS TAB ═══ */}
        <TabsContent value="shipments" className="space-y-4">
          {/* Pipeline */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 overflow-x-auto">
                {shipmentPipeline.map((s, i) => (
                  <div key={s.status} className="flex items-center">
                    <div className="text-center min-w-[80px]">
                      <div className="text-2xl font-bold">{s.count}</div>
                      <div className="text-xs text-muted-foreground capitalize">{s.status.replace(/_/g, ' ')}</div>
                    </div>
                    {i < shipmentPipeline.length - 1 && <span className="text-muted-foreground mx-1">→</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Sheet open={shipSheetOpen} onOpenChange={setShipSheetOpen}>
              <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Shipment</Button></SheetTrigger>
              <SheetContent>
                <SheetHeader><SheetTitle>New Shipment</SheetTitle></SheetHeader>
                <ScrollArea className="h-[calc(100vh-120px)]">
                  <div className="space-y-4 mt-4 pr-4">
                    <Input placeholder="Shipment Number *" value={shipForm.shipment_number} onChange={e => setShipForm(f => ({ ...f, shipment_number: e.target.value }))} />
                    <Input placeholder="Supplier Name *" value={shipForm.supplier_name} onChange={e => setShipForm(f => ({ ...f, supplier_name: e.target.value }))} />
                    <Input placeholder="Origin Country" value={shipForm.origin_country} onChange={e => setShipForm(f => ({ ...f, origin_country: e.target.value }))} />
                    <Select value={shipForm.status} onValueChange={v => setShipForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SHIPMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="space-y-1"><label className="text-sm text-muted-foreground">Order Date</label><Input type="date" value={shipForm.order_date} onChange={e => setShipForm(f => ({ ...f, order_date: e.target.value }))} /></div>
                    <div className="space-y-1"><label className="text-sm text-muted-foreground">Estimated Arrival</label><Input type="date" value={shipForm.estimated_arrival} onChange={e => setShipForm(f => ({ ...f, estimated_arrival: e.target.value }))} /></div>
                    <Input placeholder="CIF Value (XCG)" type="number" value={shipForm.total_cif_xcg} onChange={e => setShipForm(f => ({ ...f, total_cif_xcg: e.target.value }))} />
                    <Input placeholder="Container Count" type="number" value={shipForm.container_count} onChange={e => setShipForm(f => ({ ...f, container_count: e.target.value }))} />
                    <Textarea placeholder="Notes" value={shipForm.notes} onChange={e => setShipForm(f => ({ ...f, notes: e.target.value }))} />
                    <Button onClick={saveShipment} disabled={!shipForm.shipment_number || !shipForm.supplier_name || savingShip} className="w-full">
                      {savingShip ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save
                    </Button>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shipment #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>ETA</TableHead>
                    <TableHead>CIF (XCG)</TableHead>
                    <TableHead>Actions</TableHead>
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
                      <TableCell>
                        <Select onValueChange={v => updateShipmentStatus(s.id, v)}>
                          <SelectTrigger className="w-[120px] h-8"><SelectValue placeholder="Update" /></SelectTrigger>
                          <SelectContent>{SHIPMENT_STATUSES.map(st => <SelectItem key={st} value={st}>{st.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!shipments?.length && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No shipments yet</TableCell></TableRow>}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ AXEL INSIGHTS ═══ */}
        <TabsContent value="axel" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" />Axel — Administration AI</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Last run: {axelOfficer?.last_run_at ? format(new Date(axelOfficer.last_run_at), 'MMM d, yyyy h:mm a') : 'Never'}
                </p>
              </div>
              <Button onClick={runAxel} disabled={runningAxel}>
                {runningAxel ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                Run Axel Now
              </Button>
            </CardHeader>
          </Card>

          {suggestions.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Click "Run Axel Now" to generate your first administration analysis</CardContent></Card>
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
