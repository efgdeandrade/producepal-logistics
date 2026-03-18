import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Send, CheckCircle, AlertTriangle, Trash2, Edit, BookOpen, Calendar, MessageSquare, BarChart3 } from 'lucide-react';

const CATEGORIES = ['vocabulary', 'grammar', 'sales_phrase', 'slang', 'objection_handling', 'greeting', 'product_name', 'unit_name', 'other'];

function categoryBadge(cat: string) {
  const colors: Record<string, string> = {
    vocabulary: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    grammar: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    sales_phrase: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    slang: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    objection_handling: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    greeting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    product_name: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
    unit_name: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    other: 'bg-muted text-muted-foreground',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[cat] || colors.other}`}>{cat}</span>;
}

function confidenceColor(score: number) {
  if (score >= 0.8) return 'text-green-600';
  if (score >= 0.5) return 'text-amber-600';
  return 'text-red-600';
}

// ═══════════════════════════════════════════
// TAB 1: KNOWLEDGE BASE
// ═══════════════════════════════════════════

function KnowledgeBaseTab() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({ category: 'vocabulary', original_question: '', kathy_response: '' as string, confidence_score: 0.5 });

  const fetchEntries = async () => {
    let query = supabase.from('papiamentu_training_entries').select('*').order('created_at', { ascending: false });
    if (!showInactive) query = query.eq('is_active', true);
    const { data } = await query;
    setEntries(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, [showInactive]);

  const filtered = entries.filter(e => {
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return e.original_question?.toLowerCase().includes(s) || e.kathy_response?.toLowerCase().includes(s) || e.corrected_phrase?.toLowerCase().includes(s);
    }
    return true;
  });

  const addEntry = async () => {
    const { error } = await supabase.from('papiamentu_training_entries').insert({
      ...newEntry,
      corrected_phrase: newEntry.kathy_response,
      added_by: 'manual',
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Entry added' });
      setAddOpen(false);
      setNewEntry({ category: 'vocabulary', original_question: '', kathy_response: '', confidence_score: 0.5 });
      fetchEntries();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Input placeholder="Search entries..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} />
          <span className="text-sm text-muted-foreground">Show inactive</span>
        </div>
        <div className="flex-1" />
        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Manual Entry</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader><SheetTitle>Add Training Entry</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Category</Label>
                <Select value={newEntry.category} onValueChange={v => setNewEntry({ ...newEntry, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Question / Context</Label>
                <Textarea value={newEntry.original_question} onChange={e => setNewEntry({ ...newEntry, original_question: e.target.value })} />
              </div>
              <div>
                <Label>Bolenga's Response / Correct Phrase</Label>
                <Textarea value={newEntry.kathy_response} onChange={e => setNewEntry({ ...newEntry, kathy_response: e.target.value })} />
              </div>
              <div>
                <Label>Confidence ({newEntry.confidence_score})</Label>
                <Input type="number" min={0} max={1} step={0.1} value={newEntry.confidence_score} onChange={e => setNewEntry({ ...newEntry, confidence_score: parseFloat(e.target.value) || 0.5 })} />
              </div>
              <Button onClick={addEntry} className="w-full">Save Entry</Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Original Question</TableHead>
                <TableHead>Bolenga's Response</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No entries found</TableCell></TableRow>
              ) : filtered.map(e => (
                <TableRow key={e.id}>
                  <TableCell>{categoryBadge(e.category)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">{e.original_question}</TableCell>
                  <TableCell className="max-w-[250px] truncate text-sm font-medium">{e.kathy_response}</TableCell>
                  <TableCell className={`font-mono text-sm ${confidenceColor(e.confidence_score)}`}>{(e.confidence_score || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-sm">{e.times_used}</TableCell>
                  <TableCell>
                    {e.flagged_for_review && <Badge variant="destructive" className="text-xs">Flagged</Badge>}
                    {!e.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 2: DAILY SESSIONS
// ═══════════════════════════════════════════

function DailySessionsTab() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('papiamentu_training_sessions').select('*').order('started_at', { ascending: false }).limit(30);
      setSessions(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const sendTraining = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-daily-training');
      if (error) throw error;
      toast({ title: 'Training sent!', description: `${data?.questions_sent || 0} questions sent to Kathy` });
      // Refresh
      const { data: updated } = await supabase.from('papiamentu_training_sessions').select('*').order('started_at', { ascending: false }).limit(30);
      setSessions(updated || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const expandSession = async (sessionId: string) => {
    if (expandedId === sessionId) { setExpandedId(null); return; }
    setExpandedId(sessionId);
    const { data } = await supabase.from('papiamentu_training_questions').select('*').eq('session_id', sessionId).order('question_number');
    setQuestions(data || []);
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default', in_progress: 'secondary', pending: 'outline', failed: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button onClick={sendTraining} disabled={sending}>
          <Send className="h-4 w-4 mr-1" /> {sending ? 'Sending...' : "Send Today's Training Now"}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : sessions.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No training sessions yet. Click "Send Today's Training Now" to start!</p>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <Card key={s.id} className="cursor-pointer hover:bg-muted/50 transition" onClick={() => expandSession(s.id)}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="font-medium text-sm">{s.session_date}</span>
                  {statusBadge(s.status)}
                  <span className="text-xs text-muted-foreground">Sent: {s.questions_sent}</span>
                  <span className="text-xs text-muted-foreground">Responses: {s.responses_received || 0}</span>
                  <span className="text-xs text-muted-foreground">Entries: {s.entries_created || 0}</span>
                </div>
                {expandedId === s.id && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    {questions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No questions found for this session.</p>
                    ) : questions.map(q => (
                      <div key={q.id} className="text-sm border rounded p-2 bg-background">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">Q{q.question_number}</span>
                          {categoryBadge(q.category)}
                          <Badge variant={q.status === 'entry_created' ? 'default' : 'outline'} className="text-xs">{q.status}</Badge>
                        </div>
                        <p className="mt-1 text-foreground">{q.question_text}</p>
                        {q.kathy_response_text && (
                          <p className="mt-1 text-primary font-medium">→ {q.kathy_response_text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 3: REVIEW QUEUE
// ═══════════════════════════════════════════

function ReviewQueueTab() {
  const { toast } = useToast();
  const [flaggedEntries, setFlaggedEntries] = useState<any[]>([]);
  const [dreReplies, setDreReplies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [{ data: flagged }, { data: replies }] = await Promise.all([
      supabase.from('papiamentu_training_entries').select('*').eq('flagged_for_review', true).order('created_at', { ascending: false }),
      supabase.from('distribution_ai_match_logs').select('*').eq('needs_language_review', true).eq('source_channel', 'telegram').is('corrected_reply', null).order('created_at', { ascending: false }).limit(50),
    ]);
    setFlaggedEntries(flagged || []);
    setDreReplies(replies || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const approveEntry = async (id: string) => {
    await supabase.from('papiamentu_training_entries').update({ flagged_for_review: false, confidence_score: 0.9 }).eq('id', id);
    toast({ title: 'Entry approved' });
    fetchData();
  };

  const deleteEntry = async (id: string) => {
    await supabase.from('papiamentu_training_entries').update({ is_active: false }).eq('id', id);
    toast({ title: 'Entry deactivated' });
    fetchData();
  };

  const approveDreReply = async (logId: string) => {
    await supabase.from('distribution_ai_match_logs').update({ needs_language_review: false }).eq('id', logId);
    toast({ title: 'Reply approved' });
    fetchData();
  };

  const [correcting, setCorrecting] = useState<string | null>(null);
  const [correction, setCorrection] = useState('');

  const saveDreCorrection = async (logId: string, rawText: string) => {
    // Save correction and create training entry
    await supabase.from('distribution_ai_match_logs').update({
      corrected_reply: correction,
      needs_language_review: false,
    }).eq('id', logId);

    await supabase.from('papiamentu_training_entries').insert({
      original_question: rawText,
      kathy_response: correction,
      corrected_phrase: correction,
      category: 'sales_phrase',
      confidence_score: 0.8,
      added_by: 'review_correction',
    });

    toast({ title: 'Correction saved to knowledge base' });
    setCorrecting(null);
    setCorrection('');
    fetchData();
  };

  if (loading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-6">
      {/* Flagged Entries */}
      <div>
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Flagged Training Entries ({flaggedEntries.length})
        </h3>
        {flaggedEntries.length === 0 ? (
          <p className="text-muted-foreground text-sm">No flagged entries 🎉</p>
        ) : flaggedEntries.map(e => (
          <Card key={e.id} className="mb-2">
            <CardContent className="py-3 px-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {categoryBadge(e.category)}
                  <p className="text-sm mt-1"><span className="text-muted-foreground">Q:</span> {e.original_question}</p>
                  <p className="text-sm font-medium mt-1"><span className="text-muted-foreground">A:</span> {e.kathy_response}</p>
                  {e.flagged_reason && <p className="text-xs text-red-500 mt-1">Reason: {e.flagged_reason}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => approveEntry(e.id)}><CheckCircle className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => deleteEntry(e.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dre Reply Review */}
      <div>
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-500" /> Dre Language Review ({dreReplies.length})
        </h3>
        {dreReplies.length === 0 ? (
          <p className="text-muted-foreground text-sm">No replies pending review</p>
        ) : dreReplies.map(r => (
          <Card key={r.id} className="mb-2">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Customer: "{r.raw_text}"</p>
              <p className="text-sm font-medium mt-1">Dre: "{r.dre_reply}"</p>
              <p className="text-xs text-muted-foreground mt-1">Language: {r.detected_language}</p>
              {correcting === r.id ? (
                <div className="mt-2 space-y-2">
                  <Textarea value={correction} onChange={e => setCorrection(e.target.value)} placeholder="Write the correct Papiamentu reply..." className="text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveDreCorrection(r.id, r.raw_text)}>Save to Knowledge Base</Button>
                    <Button size="sm" variant="outline" onClick={() => setCorrecting(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-1 mt-2">
                  <Button size="sm" variant="outline" onClick={() => approveDreReply(r.id)}><CheckCircle className="h-4 w-4 mr-1" /> Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => { setCorrecting(r.id); setCorrection(r.dre_reply || ''); }}><Edit className="h-4 w-4 mr-1" /> Correct</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 4: ANALYTICS
// ═══════════════════════════════════════════

function AnalyticsTab() {
  const [entries, setEntries] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: ent }, { data: sess }] = await Promise.all([
        supabase.from('papiamentu_training_entries').select('*').eq('is_active', true),
        supabase.from('papiamentu_training_sessions').select('*').order('session_date', { ascending: false }).limit(60),
      ]);
      setEntries(ent || []);
      setSessions(sess || []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;

  const totalEntries = entries.length;
  const highConfidence = entries.filter(e => (e.confidence_score || 0) >= 0.8).length;
  const now = new Date();
  const thisMonth = sessions.filter(s => {
    const d = new Date(s.session_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const categoryCounts: Record<string, number> = {};
  entries.forEach(e => { categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1; });
  const mostUsedCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  const categoryChartData = Object.entries(categoryCounts).map(([name, count]) => ({ name, count }));

  // Weekly entries over 8 weeks
  const weeklyData: { week: string; count: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const count = entries.filter(e => {
      const d = new Date(e.created_at);
      return d >= weekStart && d < weekEnd;
    }).length;
    weeklyData.push({ week: `W${8 - i}`, count });
  }

  const topPhrases = [...entries].sort((a, b) => (b.times_used || 0) - (a.times_used || 0)).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-3xl font-bold">{totalEntries}</p><p className="text-sm text-muted-foreground">Total Entries</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-3xl font-bold text-green-600">{highConfidence}</p><p className="text-sm text-muted-foreground">High Confidence (≥0.8)</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-3xl font-bold">{thisMonth}</p><p className="text-sm text-muted-foreground">Sessions This Month</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-3xl font-bold">{mostUsedCategory}</p><p className="text-sm text-muted-foreground">Most Used Category</p></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Entries by Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Entries Added Per Week</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 Most Used Phrases</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Phrase</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Times Used</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topPhrases.map((e, i) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                  <TableCell className="text-sm font-medium">{e.corrected_phrase || e.kathy_response}</TableCell>
                  <TableCell>{categoryBadge(e.category)}</TableCell>
                  <TableCell>{e.times_used}</TableCell>
                  <TableCell className={confidenceColor(e.confidence_score)}>{(e.confidence_score || 0).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════

export default function PapiamentuTraining() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Papiamentu Training</h1>
        <p className="text-muted-foreground">Kathy's language training system for Dre AI</p>
      </div>

      <Tabs defaultValue="knowledge" className="w-full">
        <TabsList>
          <TabsTrigger value="knowledge" className="gap-1"><BookOpen className="h-4 w-4" /> Knowledge Base</TabsTrigger>
          <TabsTrigger value="sessions" className="gap-1"><Calendar className="h-4 w-4" /> Daily Sessions</TabsTrigger>
          <TabsTrigger value="review" className="gap-1"><MessageSquare className="h-4 w-4" /> Review Queue</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1"><BarChart3 className="h-4 w-4" /> Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge"><KnowledgeBaseTab /></TabsContent>
        <TabsContent value="sessions"><DailySessionsTab /></TabsContent>
        <TabsContent value="review"><ReviewQueueTab /></TabsContent>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
