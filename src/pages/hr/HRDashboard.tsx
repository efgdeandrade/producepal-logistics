import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Clock, FileText, AlertTriangle, UserPlus, Upload,
  Brain, Zap, Loader2, Check, X, ChevronDown, ChevronUp,
  CalendarDays, DollarSign,
} from "lucide-react";
import { format, differenceInDays, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { Link, useNavigate } from "react-router-dom";

export default function HRDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = new Date();

  // ── State ──
  const [runningRosa, setRunningRosa] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [rejectDialog, setRejectDialog] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // ── Queries ──
  const { data: employeeStats, isLoading: loadingEmployees } = useQuery({
    queryKey: ["hr-employee-stats"],
    queryFn: async () => {
      const { data: employees, error } = await supabase.from("employees").select("id, status, department");
      if (error) throw error;
      const total = employees?.length || 0;
      const active = employees?.filter(e => e.status === "active").length || 0;
      return { total, active, departments: [...new Set(employees?.map(e => e.department).filter(Boolean))].length };
    },
  });

  const { data: todayClockIns, isLoading: loadingClockIns } = useQuery({
    queryKey: ["hr-today-clock-ins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("id, clock_in, clock_out, employee_id, employees(full_name, department)")
        .gte("clock_in", startOfDay(today).toISOString())
        .lte("clock_in", endOfDay(today).toISOString())
        .order("clock_in", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pendingDocs, isLoading: loadingDocs } = useQuery({
    queryKey: ["hr-pending-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_documents")
        .select("id, title, document_type, status, expiry_date, employee_id, employees(full_name)")
        .or("status.eq.pending,expiry_date.lte." + format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"))
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: weekHours, isLoading: loadingHours } = useQuery({
    queryKey: ["hr-week-hours"],
    queryFn: async () => {
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      const { data, error } = await supabase
        .from("time_entries")
        .select("clock_in, clock_out")
        .gte("clock_in", weekStart.toISOString())
        .lte("clock_in", weekEnd.toISOString())
        .not("clock_out", "is", null);
      if (error) throw error;
      let totalMinutes = 0;
      data?.forEach(entry => {
        if (entry.clock_in && entry.clock_out) {
          totalMinutes += (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60);
        }
      });
      return Math.round(totalMinutes / 60);
    },
  });

  // Leave requests
  const { data: leaveRequests, isLoading: loadingLeave } = useQuery({
    queryKey: ["hr-leave-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, employees(full_name)")
        .eq("status", "pending")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Payroll summary
  const { data: payrollSummary } = useQuery({
    queryKey: ["hr-payroll-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_records")
        .select("id, net_amount, status")
        .eq("status", "draft");
      if (error) throw error;
      const count = data?.length || 0;
      const total = data?.reduce((s, r) => s + Number(r.net_amount || 0), 0) || 0;
      return { count, total };
    },
  });

  // Rosa officer info
  const { data: rosaOfficer } = useQuery({
    queryKey: ["rosa-officer"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_chief_officers").select("*").eq("department", "hr").single();
      return data;
    },
  });

  // Realtime suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      const { data } = await supabase.from("ai_suggestions").select("*").eq("department", "hr").eq("status", "pending").order("created_at", { ascending: false });
      setSuggestions(data || []);
    };
    fetchSuggestions();
    const channel = supabase.channel("hr-suggestions")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_suggestions", filter: "department=eq.hr" }, () => fetchSuggestions())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Mutations ──
  const handleRunRosa = async () => {
    setRunningRosa(true);
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 60000));
      const invokePromise = supabase.functions.invoke("ai-chief-officers", { body: { officer: "rosa" } });
      await Promise.race([invokePromise, timeoutPromise]);
      toast({ title: "✅ Rosa analysis complete" });
    } catch (e: any) {
      if (e.message === 'timeout') {
        toast({ title: "⚡ Rosa is running", description: "Suggestions will appear shortly." });
      } else {
        toast({ title: "Error running Rosa", description: e.message, variant: "destructive" });
      }
    } finally {
      setRunningRosa(false);
    }
  };

  const handleSuggestionAction = async (id: string, status: "approved" | "dismissed") => {
    await supabase.from("ai_suggestions").update({ status, actioned_by: user?.id, actioned_at: new Date().toISOString() }).eq("id", id);
    toast({ title: `Suggestion ${status}` });
  };

  const approveLeave = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leave_requests").update({
        status: "approved", approved_by: user?.id, approved_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-leave-requests"] });
      toast({ title: "Leave approved" });
    },
  });

  const rejectLeave = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.from("leave_requests").update({
        status: "rejected", approved_by: user?.id, approved_at: new Date().toISOString(), rejection_reason: reason,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-leave-requests"] });
      setRejectDialog(null);
      setRejectionReason("");
      toast({ title: "Leave rejected" });
    },
  });

  const clockedInCount = todayClockIns?.filter(t => !t.clock_out).length || 0;
  const pendingCount = pendingDocs?.filter(d => d.status === "pending").length || 0;
  const expiringCount = pendingDocs?.filter(d => d.expiry_date && differenceInDays(new Date(d.expiry_date), today) <= 30).length || 0;

  const leaveTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      annual: "default", sick: "destructive", personal: "secondary", maternity: "outline", paternity: "outline", unpaid: "secondary",
    };
    return <Badge variant={(colors[type] || "outline") as any}>{type}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HR Dashboard</h1>
          <p className="text-muted-foreground">Employee management & attendance overview</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/hr/employees">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Employee
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="leave">Leave Requests</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="rosa">Rosa Insights</TabsTrigger>
        </TabsList>

        {/* ══════ TAB: Overview ══════ */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingEmployees ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <div className="text-2xl font-bold">{employeeStats?.total || 0}</div>
                    <p className="text-xs text-muted-foreground">{employeeStats?.active || 0} active</p>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clocked In Today</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingClockIns ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <div className="text-2xl font-bold">{clockedInCount}</div>
                    <p className="text-xs text-muted-foreground">{todayClockIns?.length || 0} total entries today</p>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingDocs ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <div className="text-2xl font-bold">{pendingCount}</div>
                    <p className="text-xs text-muted-foreground">documents awaiting approval</p>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingHours ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <div className="text-2xl font-bold">{weekHours || 0}h</div>
                    <p className="text-xs text-muted-foreground">total logged hours</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <Button variant="outline" className="h-20 flex-col" asChild>
                  <Link to="/hr/attendance"><Clock className="h-6 w-6 mb-2" />Clock In/Out</Link>
                </Button>
                <Button variant="outline" className="h-20 flex-col" asChild>
                  <Link to="/hr/employees"><UserPlus className="h-6 w-6 mb-2" />Add Employee</Link>
                </Button>
                <Button variant="outline" className="h-20 flex-col" asChild>
                  <Link to="/hr/documents"><Upload className="h-6 w-6 mb-2" />Upload Document</Link>
                </Button>
                <Button variant="outline" className="h-20 flex-col" asChild>
                  <Link to="/hr/timesheets"><FileText className="h-6 w-6 mb-2" />View Timesheets</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Today's Attendance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Today's Attendance
                  <Button variant="ghost" size="sm" asChild><Link to="/hr/attendance">View All</Link></Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingClockIns ? (
                  <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : todayClockIns && todayClockIns.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todayClockIns.slice(0, 5).map((entry: any) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{entry.employees?.full_name || "Unknown"}</TableCell>
                          <TableCell>{format(new Date(entry.clock_in), "h:mm a")}</TableCell>
                          <TableCell>
                            {entry.clock_out ? (
                              <Badge variant="secondary">Clocked Out</Badge>
                            ) : (
                              <Badge className="bg-green-500 text-white">Working</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No clock-ins today</p>
                )}
              </CardContent>
            </Card>

            {/* Expiring Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Document Alerts
                    {expiringCount > 0 && <Badge variant="destructive">{expiringCount}</Badge>}
                  </span>
                  <Button variant="ghost" size="sm" asChild><Link to="/hr/documents">View All</Link></Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingDocs ? (
                  <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : pendingDocs && pendingDocs.length > 0 ? (
                  <div className="space-y-3">
                    {pendingDocs.map((doc: any) => {
                      const daysUntilExpiry = doc.expiry_date ? differenceInDays(new Date(doc.expiry_date), today) : null;
                      return (
                        <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <p className="font-medium text-sm">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">{doc.employees?.full_name} • {doc.document_type}</p>
                          </div>
                          <div className="text-right">
                            {doc.status === "pending" && <Badge variant="outline">Pending Review</Badge>}
                            {daysUntilExpiry !== null && daysUntilExpiry <= 30 && (
                              <Badge variant={daysUntilExpiry <= 0 ? "destructive" : "secondary"}>
                                {daysUntilExpiry <= 0 ? "Expired" : `Expires in ${daysUntilExpiry}d`}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No pending documents or alerts</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ══════ TAB: Leave Requests ══════ */}
        <TabsContent value="leave" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Pending Leave Requests
                {leaveRequests && leaveRequests.length > 0 && (
                  <Badge variant="secondary">{leaveRequests.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLeave ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : leaveRequests && leaveRequests.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.map((lr: any) => (
                      <TableRow key={lr.id}>
                        <TableCell className="font-medium">{lr.employees?.full_name || "—"}</TableCell>
                        <TableCell>{leaveTypeBadge(lr.leave_type)}</TableCell>
                        <TableCell>{format(new Date(lr.start_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{format(new Date(lr.end_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{lr.days_requested}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 text-xs" onClick={() => approveLeave.mutate(lr.id)}>
                              <Check className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRejectDialog(lr)}>
                              <X className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No pending leave requests</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════ TAB: Payroll ══════ */}
        <TabsContent value="payroll" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Payroll Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 mb-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Draft Payroll Records</p>
                  <p className="text-2xl font-bold">{payrollSummary?.count || 0}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Pending Amount</p>
                  <p className="text-2xl font-bold">XCG {(payrollSummary?.total || 0).toFixed(2)}</p>
                </div>
              </div>
              <Button onClick={() => navigate("/hr/payroll")}>
                <DollarSign className="h-4 w-4 mr-2" /> View Payroll
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════ TAB: Rosa Insights ══════ */}
        <TabsContent value="rosa" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <CardTitle>Rosa — HR AI</CardTitle>
                {rosaOfficer?.last_run_at && (
                  <span className="text-xs text-muted-foreground">Last run: {format(new Date(rosaOfficer.last_run_at), "MMM d, HH:mm")}</span>
                )}
              </div>
              <Button onClick={handleRunRosa} disabled={runningRosa}>
                {runningRosa ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                Run Rosa Now
              </Button>
            </CardHeader>
            <CardContent>
              {suggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="text-4xl mb-4">🤖</div>
                  <h3 className="font-semibold text-lg mb-2">Rosa hasn't run yet today</h3>
                  <p className="text-muted-foreground text-sm mb-4 max-w-sm">
                    Click "Run Rosa Now" to generate your first HR analysis.
                    Rosa will analyze your employees, attendance, and compliance to surface actionable insights.
                  </p>
                  <Button onClick={handleRunRosa} disabled={runningRosa}>
                    {runningRosa ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                    Run Rosa Now
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((s) => (
                    <Card key={s.id} className="border">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={s.priority === "critical" || s.priority === "high" ? "destructive" : "secondary"}>
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
                          <Button size="sm" onClick={() => handleSuggestionAction(s.id, "approved")}>
                            <Check className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleSuggestionAction(s.id, "dismissed")}>
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

      {/* Reject Leave Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Rejecting {rejectDialog?.employees?.full_name}'s {rejectDialog?.leave_type} leave request
              ({rejectDialog?.start_date} to {rejectDialog?.end_date}).
            </p>
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectLeave.mutate({ id: rejectDialog?.id, reason: rejectionReason })}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
