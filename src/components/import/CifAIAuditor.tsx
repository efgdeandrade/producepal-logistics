import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Loader2, AlertTriangle, TrendingUp, Lightbulb,
  Download, FileJson, ShieldCheck, ShieldAlert, Copy, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  generateAuditPack,
  saveAuditPackToStorage,
  hashAuditPack,
  type ExportType,
} from "@/lib/cifAuditPack";

interface CifAIAuditorProps {
  cifVersionId?: string;
  orderId?: string;
}

interface AuditIssue {
  severity: string;
  where: string;
  problem: string;
  expected?: string;
  found?: string;
  fix?: string;
}

interface AuditResult {
  audit_status: string;
  issues: AuditIssue[];
  summary: string;
  lovable_fix_prompt?: string;
}

export function CifAIAuditor({ cifVersionId, orderId }: CifAIAuditorProps) {
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState<ExportType | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Fetch previous audits
  const { data: previousAudits } = useQuery({
    queryKey: ["cif-audits", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from("cif_audits")
        .select("*")
        .eq("import_order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orderId,
  });

  // Fetch previous exports
  const { data: previousExports } = useQuery({
    queryKey: ["cif-exports", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from("cif_exports")
        .select("*")
        .eq("import_order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orderId,
  });

  const handleExport = async (type: ExportType) => {
    if (!orderId) return;
    setExporting(type);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const pack = await generateAuditPack({
        orderId,
        exportType: type,
        userId: user?.id,
        userEmail: user?.email,
      });

      // Save to storage
      await saveAuditPackToStorage(pack, orderId, type, cifVersionId, user?.id);

      // Download locally
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cif_${type}_${orderId.slice(0, 8)}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      queryClient.invalidateQueries({ queryKey: ["cif-exports", orderId] });
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} CIF exported`);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Export failed");
    } finally {
      setExporting(null);
    }
  };

  const handleAudit = async () => {
    if (!orderId) return;
    setAuditing(true);
    setAuditResult(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const pack = await generateAuditPack({
        orderId,
        exportType: 'full',
        userId: user?.id,
        userEmail: user?.email,
      });

      const inputHash = hashAuditPack(pack);

      // Check cache
      const { data: cached } = await supabase
        .from("cif_audits")
        .select("*")
        .eq("import_order_id", orderId)
        .eq("input_hash", inputHash)
        .eq("audit_status", "PASS")
        .or("audit_status.eq.FAIL")
        .limit(1)
        .maybeSingle();

      if (cached && cached.audit_status !== 'pending') {
        setAuditResult({
          audit_status: cached.audit_status,
          issues: (cached.issues_json as any) || [],
          summary: cached.summary_text || '',
          lovable_fix_prompt: cached.lovable_fix_prompt || '',
        });
        toast.info("Showing cached audit result");
        setAuditing(false);
        return;
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke("audit-cif-pack", {
        body: { auditPack: pack },
      });

      if (error) throw error;

      const result = data as AuditResult;
      setAuditResult(result);

      // Save to cif_audits
      await supabase.from("cif_audits").insert({
        import_order_id: orderId,
        cif_version_id: cifVersionId || null,
        audit_status: result.audit_status || 'unknown',
        issues_json: result.issues as any,
        summary_text: result.summary || '',
        lovable_fix_prompt: result.lovable_fix_prompt || '',
        created_by: user?.id || null,
        model_used: 'google/gemini-2.5-flash',
        input_hash: inputHash,
      } as any);

      queryClient.invalidateQueries({ queryKey: ["cif-audits", orderId] });

      if (result.audit_status === 'PASS') {
        toast.success("CIF audit passed ✓");
      } else {
        toast.warning(`CIF audit: ${result.audit_status} — ${(result.issues || []).length} issues found`);
      }
    } catch (err) {
      console.error("Audit failed:", err);
      toast.error("AI audit failed. Please try again.");

      // Record failed attempt
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("cif_audits").insert({
        import_order_id: orderId!,
        cif_version_id: cifVersionId || null,
        audit_status: 'error',
        summary_text: err instanceof Error ? err.message : 'Unknown error',
        created_by: user?.id || null,
        model_used: 'google/gemini-2.5-flash',
        input_hash: '',
      } as any);
    } finally {
      setAuditing(false);
    }
  };

  const copyFixPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    toast.success("Fix prompt copied to clipboard");
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const severityColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'destructive' as const;
      case 'HIGH': return 'destructive' as const;
      case 'MEDIUM': return 'secondary' as const;
      default: return 'outline' as const;
    }
  };

  const latestAudit = previousAudits?.[0];

  return (
    <div className="space-y-4">
      {/* Export Buttons */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            Export CIF for ChatGPT Audit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport('estimate')}
              disabled={!!exporting}
            >
              {exporting === 'estimate' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Export Estimate CIF (JSON)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport('actual')}
              disabled={!!exporting}
            >
              {exporting === 'actual' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Export Actual CIF (JSON)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport('full')}
              disabled={!!exporting}
            >
              {exporting === 'full' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Export Full Audit Pack (JSON)
            </Button>
          </div>
          {(previousExports && previousExports.length > 0) && (
            <div className="mt-3 text-xs text-muted-foreground">
              {previousExports.length} previous export(s) saved
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Audit Button */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI CIF Auditor
            </CardTitle>
            <Button size="sm" onClick={handleAudit} disabled={auditing}>
              {auditing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Brain className="h-4 w-4 mr-1" />
              )}
              {auditing ? "Auditing..." : "Audit CIF with AI"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {auditResult ? (
            <div className="space-y-4">
              {/* Status banner */}
              <div className={`p-3 rounded-lg flex items-center gap-2 ${
                auditResult.audit_status === 'PASS'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-destructive/10 text-destructive'
              }`}>
                {auditResult.audit_status === 'PASS' ? (
                  <ShieldCheck className="h-5 w-5" />
                ) : (
                  <ShieldAlert className="h-5 w-5" />
                )}
                <span className="font-semibold text-sm">
                  Audit: {auditResult.audit_status}
                </span>
              </div>

              {/* Summary */}
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                {auditResult.summary}
              </div>

              {/* Issues */}
              {auditResult.issues && auditResult.issues.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Issues ({auditResult.issues.length})
                  </div>
                  {auditResult.issues.map((issue, i) => (
                    <div key={i} className="p-3 border rounded-lg space-y-1">
                      <div className="flex items-center gap-2">
                        {issue.severity?.toUpperCase() === 'CRITICAL' || issue.severity?.toUpperCase() === 'HIGH' ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                        ) : (
                          <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <Badge variant={severityColor(issue.severity)} className="text-xs">
                          {issue.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{issue.where}</span>
                      </div>
                      <p className="text-sm">{issue.problem}</p>
                      {issue.expected && (
                        <p className="text-xs text-muted-foreground">
                          Expected: <span className="text-foreground">{issue.expected}</span>
                        </p>
                      )}
                      {issue.found && (
                        <p className="text-xs text-muted-foreground">
                          Found: <span className="text-foreground">{issue.found}</span>
                        </p>
                      )}
                      {issue.fix && (
                        <p className="text-xs text-primary flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {issue.fix}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Fix Prompt */}
              {auditResult.lovable_fix_prompt && auditResult.lovable_fix_prompt.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Lovable Fix Prompt
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyFixPrompt(auditResult.lovable_fix_prompt!)}
                    >
                      {copiedPrompt ? (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 mr-1" />
                      )}
                      {copiedPrompt ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <pre className="p-3 rounded-lg bg-muted/50 text-xs whitespace-pre-wrap overflow-auto max-h-48 font-mono">
                    {auditResult.lovable_fix_prompt}
                  </pre>
                </div>
              )}
            </div>
          ) : latestAudit && latestAudit.audit_status !== 'pending' ? (
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">Last Audit Result</div>
              <div className={`p-3 rounded-lg flex items-center gap-2 ${
                latestAudit.audit_status === 'PASS'
                  ? 'bg-primary/10 text-primary'
                  : latestAudit.audit_status === 'error'
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-destructive/10 text-destructive'
              }`}>
                {latestAudit.audit_status === 'PASS' ? (
                  <ShieldCheck className="h-5 w-5" />
                ) : latestAudit.audit_status === 'error' ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <ShieldAlert className="h-5 w-5" />
                )}
                <span className="font-semibold text-sm">
                  {latestAudit.audit_status === 'error' ? 'Audit Error' : `Audit: ${latestAudit.audit_status}`}
                </span>
                <span className="text-xs ml-auto">
                  {new Date(latestAudit.created_at).toLocaleDateString()}
                </span>
              </div>
              {latestAudit.summary_text && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">{latestAudit.summary_text}</div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Run the AI auditor to validate CIF calculations, detect anomalies, and get a fix prompt if issues are found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
