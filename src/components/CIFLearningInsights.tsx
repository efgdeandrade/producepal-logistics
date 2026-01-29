import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Brain, TrendingUp, TrendingDown, AlertCircle, Lightbulb, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface LearningPattern {
  pattern_key: string;
  pattern_type: string;
  sample_size: number;
  avg_variance_percentage: number;
  std_deviation: number;
  adjustment_factor: number;
  confidence_score: number;
  last_calculated: string;
  season_quarter?: number;
}

export function CIFLearningInsights() {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<any>(null);
  const [patterns, setPatterns] = useState<LearningPattern[]>([]);
  const [existingPatterns, setExistingPatterns] = useState<LearningPattern[]>([]);

  // Load existing patterns on mount
  useEffect(() => {
    loadExistingPatterns();
  }, []);

  const loadExistingPatterns = async () => {
    try {
      const { data, error } = await supabase
        .from('cif_learning_patterns')
        .select('*')
        .order('confidence_score', { ascending: false });

      if (error) throw error;
      setExistingPatterns(data || []);
    } catch (error) {
      console.error('Error loading patterns:', error);
    }
  };

  const runLearningEngine = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cif-learning-engine');
      
      if (error) throw error;
      
      setInsights(data.ai_insights);
      setPatterns(data.patterns || []);
      
      // Reload existing patterns
      await loadExistingPatterns();
      
      toast.success(`Learning engine analyzed ${data.total_estimates} estimates and updated ${data.patterns_analyzed} patterns`);
    } catch (error: any) {
      console.error('Error running learning engine:', error);
      toast.error('Failed to run learning engine: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 75) return <Badge className="bg-green-50 text-green-700 border-green-200">High Confidence</Badge>;
    if (score >= 50) return <Badge variant="secondary">Medium Confidence</Badge>;
    return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Low Confidence</Badge>;
  };

  const getAdjustmentIndicator = (factor: number) => {
    const percentChange = (factor - 1) * 100;
    if (Math.abs(percentChange) < 2) {
      return <span className="text-muted-foreground">No adjustment needed</span>;
    }
    if (percentChange > 0) {
      return (
        <span className="text-red-600 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          +{percentChange.toFixed(1)}% (under-estimating)
        </span>
      );
    }
    return (
      <span className="text-green-600 flex items-center gap-1">
        <TrendingDown className="h-3 w-3" />
        {percentChange.toFixed(1)}% (over-estimating)
      </span>
    );
  };

  const activePatterns = existingPatterns.filter(p => p.confidence_score >= 50);
  const lowConfidencePatterns = existingPatterns.filter(p => p.confidence_score < 50);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                CIF Learning Engine
              </CardTitle>
              <CardDescription>
                AI-powered analysis that learns from actual vs estimated costs to improve future predictions
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={loadExistingPatterns} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={runLearningEngine} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    Run Analysis
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Active Patterns Summary */}
      {existingPatterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Active Learning Patterns
              <Badge variant="secondary">{activePatterns.length} products</Badge>
            </CardTitle>
            <CardDescription>
              These patterns are automatically applied to CIF calculations (confidence ≥ 50%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activePatterns.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No active patterns yet. Run the learning engine after entering actual costs for orders.
              </p>
            ) : (
              <div className="space-y-3">
                {activePatterns.slice(0, 10).map((pattern, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{pattern.pattern_key.replace('product_', '')}</h4>
                        <p className="text-xs text-muted-foreground">
                          {pattern.sample_size} samples · Last updated: {pattern.last_calculated ? new Date(pattern.last_calculated).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getConfidenceBadge(pattern.confidence_score)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Confidence</span>
                          <span>{pattern.confidence_score.toFixed(0)}%</span>
                        </div>
                        <Progress value={pattern.confidence_score} className="h-2" />
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Adjustment</div>
                        <div className="font-semibold text-sm">
                          {getAdjustmentIndicator(pattern.adjustment_factor)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Avg Variance:</span>
                        <div className={`font-medium ${pattern.avg_variance_percentage > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {pattern.avg_variance_percentage > 0 ? '+' : ''}{pattern.avg_variance_percentage.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Std Deviation:</span>
                        <div className="font-medium">{pattern.std_deviation.toFixed(1)}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Factor:</span>
                        <div className="font-medium">{pattern.adjustment_factor.toFixed(3)}x</div>
                      </div>
                    </div>
                  </div>
                ))}
                {activePatterns.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center">
                    + {activePatterns.length - 10} more patterns
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Insights */}
      {insights && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Analysis Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{insights.summary}</p>
              {insights.seasonal_insights && (
                <Alert className="mt-4">
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription>{insights.seasonal_insights}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {insights.top_variance_products && insights.top_variance_products.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Products with Highest Variance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights.top_variance_products.map((product: string) => (
                    <div key={product} className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">{product}</span>
                      <Badge variant="outline">Review Needed</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {insights.root_causes && insights.root_causes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Identified Root Causes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {insights.root_causes.map((cause: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-destructive mt-1">•</span>
                      <span>{cause}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {insights.recommendations && insights.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Actionable Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights.recommendations.map((rec: string, index: number) => (
                    <Alert key={index}>
                      <Lightbulb className="h-4 w-4" />
                      <AlertDescription>{rec}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {insights.concerning_patterns && insights.concerning_patterns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Concerning Patterns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights.concerning_patterns.map((pattern: string, index: number) => (
                    <Alert key={index} variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{pattern}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Low Confidence Patterns */}
      {lowConfidencePatterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-5 w-5" />
              Patterns Needing More Data
              <Badge variant="outline">{lowConfidencePatterns.length}</Badge>
            </CardTitle>
            <CardDescription>
              These patterns have low confidence and won't be applied until more data is collected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {lowConfidencePatterns.slice(0, 5).map((pattern, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">{pattern.pattern_key.replace('product_', '')}</span>
                  <span className="text-xs text-muted-foreground">
                    {pattern.sample_size} samples · {pattern.confidence_score.toFixed(0)}% confidence
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {existingPatterns.length === 0 && !insights && !loading && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Click "Run Analysis" to analyze historical CIF data and generate insights</p>
            <p className="text-sm mt-2">The AI will learn from past estimates vs actual costs to improve future predictions</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
