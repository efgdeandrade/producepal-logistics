import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Brain, 
  Loader2, 
  Lightbulb, 
  AlertTriangle, 
  TrendingUp,
  DollarSign,
  Truck,
  Users,
  Gauge
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Opportunity {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  savings_potential?: string;
}

interface Warning {
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
}

interface Improvement {
  title: string;
  description: string;
  category: "freight" | "supplier" | "process" | "cost";
}

interface KeyMetrics {
  freight_efficiency_score: number;
  supplier_diversification_score: number;
  cost_management_score: number;
}

interface AIInsights {
  opportunities: Opportunity[];
  warnings: Warning[];
  improvements: Improvement[];
  summary: string;
  key_metrics: KeyMetrics;
}

export function ImportAIInsightsPanel() {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<AIInsights | null>(null);

  const generateInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-ai-insights");

      if (error) throw error;

      if (data?.insights) {
        setInsights(data.insights);
        toast.success("AI insights generated successfully");
      } else {
        throw new Error("No insights returned");
      }
    } catch (error: any) {
      console.error("Error generating insights:", error);
      toast.error("Failed to generate insights: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case "high":
        return <Badge className="bg-green-100 text-green-800 border-green-200">High Impact</Badge>;
      case "medium":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Medium Impact</Badge>;
      default:
        return <Badge variant="secondary">Low Impact</Badge>;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-blue-600" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "freight":
        return <Truck className="h-4 w-4" />;
      case "supplier":
        return <Users className="h-4 w-4" />;
      case "cost":
        return <DollarSign className="h-4 w-4" />;
      default:
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Import Insights
            </CardTitle>
            <CardDescription>
              AI-powered analysis of your import operations, costs, and optimization opportunities
            </CardDescription>
          </div>
          <Button onClick={generateInsights} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Generate Insights
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {insights && (
        <CardContent className="space-y-6">
          {/* Summary */}
          <Alert className="bg-primary/10 border-primary/20">
            <Brain className="h-4 w-4" />
            <AlertTitle>Executive Summary</AlertTitle>
            <AlertDescription>{insights.summary}</AlertDescription>
          </Alert>

          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
              <Gauge className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Freight Efficiency</p>
                <p className={`text-2xl font-bold ${getScoreColor(insights.key_metrics.freight_efficiency_score)}`}>
                  {insights.key_metrics.freight_efficiency_score}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
              <Users className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Supplier Diversification</p>
                <p className={`text-2xl font-bold ${getScoreColor(insights.key_metrics.supplier_diversification_score)}`}>
                  {insights.key_metrics.supplier_diversification_score}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
              <DollarSign className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Cost Management</p>
                <p className={`text-2xl font-bold ${getScoreColor(insights.key_metrics.cost_management_score)}`}>
                  {insights.key_metrics.cost_management_score}%
                </p>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {insights.warnings.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                Warnings ({insights.warnings.length})
              </h4>
              {insights.warnings.map((warning, index) => (
                <Alert 
                  key={index} 
                  variant={warning.severity === "critical" ? "destructive" : "default"}
                  className={warning.severity === "warning" ? "border-yellow-200 bg-yellow-50" : ""}
                >
                  {getSeverityIcon(warning.severity)}
                  <AlertTitle>{warning.title}</AlertTitle>
                  <AlertDescription>{warning.description}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* Opportunities */}
          {insights.opportunities.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-green-600" />
                Opportunities ({insights.opportunities.length})
              </h4>
              <div className="grid gap-3 md:grid-cols-2">
                {insights.opportunities.map((opp, index) => (
                  <div key={index} className="p-4 rounded-lg border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium">{opp.title}</h5>
                      {getImpactBadge(opp.impact)}
                    </div>
                    <p className="text-sm text-muted-foreground">{opp.description}</p>
                    {opp.savings_potential && (
                      <p className="text-sm font-medium text-green-600">
                        💰 {opp.savings_potential}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Improvements */}
          {insights.improvements.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Recommended Improvements ({insights.improvements.length})
              </h4>
              <div className="space-y-2">
                {insights.improvements.map((imp, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <div className="mt-0.5 p-1.5 rounded bg-muted">
                      {getCategoryIcon(imp.category)}
                    </div>
                    <div>
                      <h5 className="font-medium">{imp.title}</h5>
                      <p className="text-sm text-muted-foreground">{imp.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}

      {!insights && !loading && (
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Click "Generate Insights" to analyze your import operations</p>
            <p className="text-sm mt-2">
              AI will review CIF calculations, bills, and supplier data to find optimization opportunities
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
