import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Brain, Loader2, AlertTriangle, TrendingUp, Lightbulb,
  Download, FileJson, ShieldCheck, ShieldAlert, Copy, Check,
  XCircle, Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  generateAuditPack,
  saveAuditPackToStorage,
  computeInputHash,
  checkCifReadiness,
  type ExportType,
  type MissingFieldEntry,
} from "@/lib/cifAuditPack";
import { CIF_ENGINE_VERSION } from "@/lib/cifEngine";

interface CifAIAuditorProps {
  cifVersionId?: string;
  orderId?: string;
}

interface AuditIssue {
  severity: string;
  code?: string;
  where?: any;
  problem: string;
  expected?: string;
  found?: string;
  impact?: string;
  how_to_verify?: string;
  fix?: string;
}

interface AuditResult {
  audit_status: string;
  engine_version?: string;
  input_hash?: string;
  issues: AuditIssue[];
  summary: string;
  fix_prompt?: string;
}

const FIELD_LABELS: Record<string, string> = {
  case_pack: "Pack Size",
  weight_case_kg: "Weight/Case (kg)",
  length_cm: "Length (cm)",
  width_cm: "Width (cm)",
  height_cm: "Height (cm)",
  supplier_cost_usd_per_case: "Cost USD/Case",
};

// DB column mapping for product fixes
const FIELD_TO_DB_COLUMN: Record<string, string> = {
  case_pack: "pack_size",
  weight_case_kg: "weight", // stored as grams in DB
  length_cm: "length_cm",
  width_cm: "width_cm",
  height_cm: "height_cm",
  supplier_cost_usd_per_case: "price_usd",
};

export function CifAIAuditor({ cifVersionId, orderId }: CifAIAuditorProps) {
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState<ExportType | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Readiness check modal state
  const [showReadinessModal, setShowReadinessModal] = useState(false);
  const [missingFieldsData, setMissingFieldsData] = useState<MissingFieldEntry[]>([]);
  const [fieldFixes, setFieldFixes] = useState<Record<string, Record<string, string>>>({});
  const [pendingExportType, setPendingExportType] = useState<ExportType | null>(null);
  const [savingFixes, setSavingFixes] = useState(false);

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

  const runReadinessCheck = async (type: ExportType): Promise<boolean> => {
    if (!orderId) return false;
    const { ready, missingFields } = await checkCifReadiness(orderId);
    if (!ready && missingFields.length > 0) {
      setMissingFieldsData(missingFields);
      setPendingExportType(type);
      // Initialize fix values
      const fixes: Record<string, Record<string, string>> = {};
      missingFields.forEach(m => {
        fixes[m.product_id] = {};
        m.missing.forEach(f => { fixes[m.product_id][f] = ''; });
      });
      setFieldFixes(fixes);
      setShowReadinessModal(true);
      return false;
    }
    return true;
  };

  const handleSaveFixes = async () => {
    setSavingFixes(true);
    try {
      for (const entry of missingFieldsData) {
        const fixes = fieldFixes[entry.product_id];
        if (!fixes) continue;

        const updateData: Record<string, any> = {};
        for (const [field, value] of Object.entries(fixes)) {
          const numVal = parseFloat(value);
          if (isNaN(numVal) || numVal <= 0) continue;

          const dbCol = FIELD_TO_DB_COLUMN[field];
          if (!dbCol) continue;

          if (field === 'weight_case_kg') {
            // DB stores weight in grams
            updateData[dbCol] = numVal * 1000;
          } else {
            updateData[dbCol] = numVal;
          }
        }

        if (Object.keys(updateData).length > 0 && entry.product_id) {
          const { error } = await supabase
            .from("products")
            .update(updateData)
            .eq("id", entry.product_id);
          if (error) {
            console.error(`Failed to update product ${entry.product_code}:`, error);
            toast.error(`Failed to update ${entry.product_code}`);
          }
        }
      }

      toast.success("Product data updated. Re-checking readiness...");
      setShowReadinessModal(false);

      // Re-run export with pending type
      if (pendingExportType) {
        await handleExport(pendingExportType);
      }
    } catch (err) {
      console.error("Save fixes error:", err);
      toast.error("Failed to save fixes");
    } finally {
      setSavingFixes(false);
    }
  };

  const handleExport = async (type: ExportType) => {
    if (!orderId) return;

    // Readiness check
    const ready = await runReadinessCheck(type);
    if (!ready) return;

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
      a.download = `cif_${type}_${orderId.slice(0, 8)}_${CIF_ENGINE_VERSION}_${Date.now()}.json`;
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
    if (!orderId) {
      toast.error("No order to audit");
      return;
    }

    // Readiness check
    const ready = await runReadinessCheck('full');
    if (!ready) return;

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

      const inputHash = await computeInputHash(pack);

      // Check cache
      const { data: cached } = await supabase
        .from("cif_audits")
        .select("*")
        .eq("input_hash", inputHash)
        .maybeSingle();

      if (cached && (cached.audit_status === 'PASS' || cached.audit_status === 'FAIL')) {
        setAuditResult({
          audit_status: cached.audit_status,
          engine_version: cached.engine_version,
          input_hash: cached.input_hash,
          issues: (cached.issues_json as any) || [],
          summary: cached.summary_text || '',
          fix_prompt: cached.fix_prompt || '',
        });
        toast.info("Showing cached audit result");
        setAuditing(false);
        return;
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke("audit-cif-pack", {
        body: {
          audit_pack: pack,
          input_hash: inputHash,
          options: {
            mode: "strict",
            rounding_tolerance_usd: 0.02,
            rounding_tolerance_xcg: 0.05,
            max_issues: 50,
          },
          context: {
            app: "FUIK",
            department: "IMPORT",
            module: "CIF",
            engine_version: CIF_ENGINE_VERSION,
          },
        },
      });

      if (error) throw error;

      const result = data as AuditResult;
      setAuditResult(result);

      // Save to cif_audits
      const { error: insertError } = await supabase.from("cif_audits").insert({
        import_order_id: orderId,
        cif_version_id: cifVersionId || orderId,
        engine_version: CIF_ENGINE_VERSION,
        input_hash: inputHash,
        audit_status: result.audit_status || 'ERROR',
        issues_json: (result.issues || []) as any,
        summary_text: result.summary || '',
        fix_prompt: result.fix_prompt || '',
        model_used: 'google/gemini-2.5-flash',
        created_by: user?.email || user?.id || null,
      } as any);

      if (insertError && !insertError.message?.includes('duplicate')) {
        console.error("Failed to save audit:", insertError);
      }

      queryClient.invalidateQueries({ queryKey: ["cif-audits", orderId] });

      if (result.audit_status === 'PASS') {
        toast.success("CIF audit passed ✓");
      } else if (result.audit_status === 'FAIL') {
        toast.warning(`CIF audit FAIL — ${(result.issues || []).length} issues found`);
      } else {
        toast.error(`CIF audit returned: ${result.audit_status}`);
      }
    } catch (err) {
      console.error("Audit failed:", err);
      toast.error("AI audit failed. Please try again.");

      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("cif_audits").insert({
          import_order_id: orderId!,
          cif_version_id: cifVersionId || orderId!,
          engine_version: CIF_ENGINE_VERSION,
          input_hash: `error_${Date.now()}`,
          audit_status: 'ERROR',
          summary_text: err instanceof Error ? err.message : 'Unknown error',
          issues_json: [] as any,
          fix_prompt: '',
          model_used: 'google/gemini-2.5-flash',
          created_by: user?.email || user?.id || null,
        } as any);
      } catch { /* ignore */ }
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
      {/* Engine Version Label */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-xs font-mono">
          Engine {CIF_ENGINE_VERSION}
        </Badge>
      </div>

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
                  : auditResult.audit_status === 'ERROR'
                    ? 'bg-muted text-muted-foreground'
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
                {auditResult.engine_version && (
                  <span className="text-xs ml-auto opacity-60">
                    Engine {auditResult.engine_version}
                  </span>
                )}
              </div>

              {/* Summary */}
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                {auditResult.summary}
              </div>

              {/* Issues Table */}
              {auditResult.issues && auditResult.issues.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Issues ({auditResult.issues.length})
                  </div>
                  {auditResult.issues.map((issue, i) => (
                    <div key={i} className="p-3 border rounded-lg space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {issue.severity?.toUpperCase() === 'CRITICAL' || issue.severity?.toUpperCase() === 'HIGH' ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                        ) : (
                          <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <Badge variant={severityColor(issue.severity)} className="text-xs">
                          {issue.severity}
                        </Badge>
                        {issue.code && (
                          <span className="text-xs font-mono text-muted-foreground">{issue.code}</span>
                        )}
                        {typeof issue.where === 'string' && (
                          <span className="text-xs text-muted-foreground">{issue.where}</span>
                        )}
                        {typeof issue.where === 'object' && issue.where?.method && (
                          <span className="text-xs text-muted-foreground">
                            {issue.where.method}{issue.where.product_id ? ` / ${issue.where.product_id.slice(0, 8)}` : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{issue.problem}</p>
                      {issue.expected && (
                        <p className="text-xs text-muted-foreground">
                          Expected: <span className="text-foreground font-mono">{issue.expected}</span>
                        </p>
                      )}
                      {issue.found && (
                        <p className="text-xs text-muted-foreground">
                          Found: <span className="text-foreground font-mono">{issue.found}</span>
                        </p>
                      )}
                      {issue.impact && (
                        <p className="text-xs text-muted-foreground">
                          Impact: <span className="text-foreground">{issue.impact}</span>
                        </p>
                      )}
                      {issue.fix && (
                        <p className="text-xs text-primary flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 shrink-0" />
                          {issue.fix}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Fix Prompt */}
              {auditResult.fix_prompt && auditResult.fix_prompt.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Lovable Fix Prompt
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyFixPrompt(auditResult.fix_prompt!)}
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
                    {auditResult.fix_prompt}
                  </pre>
                </div>
              )}
            </div>
          ) : latestAudit ? (
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">Last Audit Result</div>
              <div className={`p-3 rounded-lg flex items-center gap-2 ${
                latestAudit.audit_status === 'PASS'
                  ? 'bg-primary/10 text-primary'
                  : latestAudit.audit_status === 'ERROR'
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-destructive/10 text-destructive'
              }`}>
                {latestAudit.audit_status === 'PASS' ? (
                  <ShieldCheck className="h-5 w-5" />
                ) : (
                  <ShieldAlert className="h-5 w-5" />
                )}
                <span className="font-semibold text-sm">
                  {latestAudit.audit_status === 'ERROR' ? 'Audit Error' : `Audit: ${latestAudit.audit_status}`}
                </span>
                <span className="text-xs ml-auto">
                  {latestAudit.engine_version} · {new Date(latestAudit.created_at).toLocaleDateString()}
                </span>
              </div>
              {latestAudit.summary_text && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">{latestAudit.summary_text}</div>
              )}
              {latestAudit.fix_prompt && latestAudit.fix_prompt.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Fix Prompt</div>
                  <pre className="p-3 rounded-lg bg-muted/50 text-xs whitespace-pre-wrap overflow-auto max-h-32 font-mono">
                    {latestAudit.fix_prompt}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Run the AI auditor to validate CIF calculations, detect anomalies, and get a fix prompt if issues are found.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Readiness Check Modal */}
      <Dialog open={showReadinessModal} onOpenChange={setShowReadinessModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              CIF Readiness Check Failed
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The following products are missing required fields for CIF calculation. 
              Fill in the values below to proceed with export.
            </p>
            {missingFieldsData.map((entry) => (
              <Card key={entry.product_id} className="border-destructive/30">
                <CardHeader className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{entry.product_code}</span>
                    <span className="text-xs text-muted-foreground truncate">{entry.product_name}</span>
                  </div>
                </CardHeader>
                <CardContent className="py-2 px-3 space-y-2">
                  {entry.missing.map((field) => (
                    <div key={field} className="flex items-center gap-2">
                      <Label className="text-xs w-32 shrink-0">{FIELD_LABELS[field] || field}</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        className="h-8 text-sm"
                        placeholder="0"
                        value={fieldFixes[entry.product_id]?.[field] || ''}
                        onChange={(e) => {
                          setFieldFixes(prev => ({
                            ...prev,
                            [entry.product_id]: {
                              ...prev[entry.product_id],
                              [field]: e.target.value,
                            },
                          }));
                        }}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReadinessModal(false)}>Cancel</Button>
            <Button onClick={handleSaveFixes} disabled={savingFixes}>
              {savingFixes ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Fix &amp; Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
