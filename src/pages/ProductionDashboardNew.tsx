import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  Factory, Package, ClipboardList, TrendingUp, ArrowRight,
  AlertTriangle, CheckCircle, Brain, Zap, Loader2, Check, X,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { format, startOfDay } from "date-fns";

export default function ProductionDashboardNew() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const today = new Date();

  const [runningGino, setRunningGino] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // ── Existing queries ──
  const { data: todayProduction } = useQuery({
    queryKey: ["production-orders-today"],
    queryFn: async () => {
      const dayStart = startOfDay(today).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("production_orders")
        .select("id, status, order_date, notes, created_at")
        .eq("order_date", dayStart);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allProduction } = useQuery({
    queryKey: ["production-orders-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("id, status, order_date, notes, created_at")
        .order("order_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Gino officer info
  const { data: ginoOfficer } = useQuery({
    queryKey: ["gino-officer"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_chief_officers").select("*").eq("department", "production").single();
      return data;
    },
  });

  // Realtime suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      const { data } = await supabase.from("ai_suggestions").select("*").eq("department", "production").eq("status", "pending").order("created_at", { ascending: false });
      setSuggestions(data || []);
    };
    fetchSuggestions();
    const channel = supabase.channel("production-suggestions")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_suggestions", filter: "department=eq.production" }, () => fetchSuggestions())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Stats
  const productionStats = {
    todayOrders: todayProduction?.length || 0,
    pending: allProduction?.filter((p) => p.status === "pending").length || 0,
    inProgress: allProduction?.filter((p) => p.status === "in_progress").length || 0,
    completed: allProduction?.filter((p) => p.status === "completed").length || 0,
  };

  const completionRate = productionStats.todayOrders > 0
    ? Math.round(((todayProduction?.filter((p) => p.status === "completed").length || 0) / productionStats.todayOrders) * 100)
    : 0;

  const handleRunGino = async () => {
    setRunningGino(true);
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 60000));
      const invokePromise = supabase.functions.invoke("ai-chief-officers", { body: { officer: "gino" } });
      await Promise.race([invokePromise, timeoutPromise]);
      toast({ title: "✅ Gino analysis complete" });
    } catch (e: any) {
      if (e.message === 'timeout') {
        toast({ title: "⚡ Gino is running", description: "Suggestions will appear shortly." });
      } else {
        toast({ title: "Error running Gino", description: e.message, variant: "destructive" });
      }
    } finally {
      setRunningGino(false);
    }
  };

  const handleSuggestionAction = async (id: string, status: "approved" | "dismissed") => {
    await supabase.from("ai_suggestions").update({ status, actioned_by: user?.id, actioned_at: new Date().toISOString() }).eq("id", id);
    toast({ title: `Suggestion ${status}` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Production Dashboard</h1>
          <p className="text-muted-foreground">Production orders, scheduling, and inventory</p>
        </div>
        <Button onClick={() => navigate("/production/input")}>
          <Factory className="h-4 w-4 mr-2" />
          New Production Order
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="gino">Gino Insights</TabsTrigger>
        </TabsList>

        {/* ══════ TAB: Overview ══════ */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Orders</CardTitle>
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{productionStats.todayOrders}</div>
                <p className="text-xs text-muted-foreground">production orders</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{productionStats.pending}</div>
                <p className="text-xs text-muted-foreground">awaiting start</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Factory className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{productionStats.inProgress}</div>
                <p className="text-xs text-muted-foreground">currently running</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{productionStats.completed}</div>
                <Progress value={completionRate} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate("/production/input")}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Factory className="h-8 w-8 text-primary" />
                  <div><p className="font-medium">Production Input</p><p className="text-sm text-muted-foreground">Create orders</p></div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate("/production/dashboard")}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-primary" />
                  <div><p className="font-medium">Production View</p><p className="text-sm text-muted-foreground">Full dashboard</p></div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate("/production/stock")}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="h-8 w-8 text-primary" />
                  <div><p className="font-medium">Stock Tracker</p><p className="text-sm text-muted-foreground">Inventory levels</p></div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>

          {/* Recent Production Orders */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Production Orders</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/production/dashboard")}>
                View All <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardHeader>
            <CardContent>
              {allProduction && allProduction.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allProduction.slice(0, 5).map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{format(new Date(order.order_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant={order.status === "completed" ? "default" : order.status === "in_progress" ? "secondary" : "outline"}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{order.notes || "-"}</TableCell>
                        <TableCell className="text-right">{format(new Date(order.created_at), "MMM d")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No production orders yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════ TAB: Gino Insights ══════ */}
        <TabsContent value="gino" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <CardTitle>Gino — Production AI</CardTitle>
                {ginoOfficer?.last_run_at && (
                  <span className="text-xs text-muted-foreground">Last run: {format(new Date(ginoOfficer.last_run_at), "MMM d, HH:mm")}</span>
                )}
              </div>
              <Button onClick={handleRunGino} disabled={runningGino}>
                {runningGino ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                Run Gino Now
              </Button>
            </CardHeader>
            <CardContent>
              {suggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="text-4xl mb-4">🤖</div>
                  <h3 className="font-semibold text-lg mb-2">Gino hasn't run yet today</h3>
                  <p className="text-muted-foreground text-sm mb-4 max-w-sm">
                    Click "Run Gino Now" to generate your first production analysis.
                    Gino will analyze your orders, fulfillment, and operations to surface actionable insights.
                  </p>
                  <Button onClick={handleRunGino} disabled={runningGino}>
                    {runningGino ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                    Run Gino Now
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
    </div>
  );
}
