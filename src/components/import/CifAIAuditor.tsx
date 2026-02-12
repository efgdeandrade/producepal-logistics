import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, AlertTriangle, TrendingUp, Lightbulb, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CifAIAuditorProps {
  cifVersionId?: string;
  orderId?: string;
}

interface AuditResult {
  anomalies: Array<{
    type: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    suggestion?: string;
  }>;
  summary: string;
  improvement_notes?: string;
}

export function CifAIAuditor({ cifVersionId, orderId }: CifAIAuditorProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);

  const { data: storedNotes } = useQuery({
    queryKey: ["cif-ai-notes", cifVersionId],
    queryFn: async () => {
      if (!cifVersionId) return null;
      const { data, error } = await supabase
        .from("cif_versions")
        .select("ai_notes")
        .eq("id", cifVersionId)
        .single();
      if (error) throw error;
      return data?.ai_notes;
    },
    enabled: !!cifVersionId,
  });

  const runAudit = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-ai-insights", {
        body: { cifVersionId, orderId, action: "audit" },
      });
      if (error) throw error;
      setResult(data as AuditResult);

      if (cifVersionId && data?.summary) {
        await supabase
          .from("cif_versions")
          .update({ ai_notes: data.summary })
          .eq("id", cifVersionId);
      }
    } catch (err) {
      toast.error("AI audit failed");
    } finally {
      setRunning(false);
    }
  };

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
      default: return <Lightbulb className="h-3.5 w-3.5 text-blue-500" />;
    }
  };

  const severityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge variant="destructive" className="text-xs">Critical</Badge>;
      case 'warning': return <Badge className="bg-amber-500 text-xs">Warning</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Info</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Auditor
          </CardTitle>
          <Button size="sm" variant="outline" onClick={runAudit} disabled={running}>
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            {running ? "Analyzing..." : "Run Audit"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {result ? (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 text-sm">{result.summary}</div>
            {result.anomalies.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Findings</div>
                {result.anomalies.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 border rounded-lg">
                    {severityIcon(a.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{a.type}</span>
                        {severityBadge(a.severity)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>
                      {a.suggestion && (
                        <p className="text-xs text-primary mt-1 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {a.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">
                ✓ No anomalies detected
              </div>
            )}
            {result.improvement_notes && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Next Order Improvements</div>
                <div className="p-3 rounded-lg bg-primary/5 text-sm">{result.improvement_notes}</div>
              </div>
            )}
          </div>
        ) : storedNotes ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Last AI Notes</div>
            <div className="p-3 rounded-lg bg-muted/50 text-sm">{storedNotes}</div>
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-muted-foreground">
            Run the AI auditor to check for anomalies and get improvement suggestions.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
