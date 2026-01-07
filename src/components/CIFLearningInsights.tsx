import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { supabase } from "../integrations/supabase/client";
import { toast } from "sonner";
import { Brain, TrendingUp, AlertCircle, Lightbulb, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";

export function CIFLearningInsights() {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<any>(null);
  const [patterns, setPatterns] = useState<any[]>([]);

  const runLearningEngine = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cif-learning-engine');
      
      if (error) throw error;
      
      setInsights(data.ai_insights);
      setPatterns(data.patterns || []);
      
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

  return (
    <div className="space-y-6">
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
        </CardHeader>
      </Card>

      {insights && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Analysis Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{insights.summary}</p>
            </CardContent>
          </Card>

          {/* Top Variance Products */}
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

          {/* Root Causes */}
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

          {/* Recommendations */}
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

          {/* Product Adjustments */}
          {insights.product_adjustments && insights.product_adjustments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Product-Specific Adjustments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {insights.product_adjustments.map((adj: any, index: number) => {
                    const currentFactor = typeof adj.current_factor === 'number' ? adj.current_factor : 1.0;
                    const recommendedFactor = typeof adj.recommended_factor === 'number' ? adj.recommended_factor : 1.0;
                    
                    return (
                      <div key={index} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">{adj.product_code || 'Unknown Product'}</h4>
                          <Badge variant="outline">
                            {currentFactor.toFixed(3)} → {recommendedFactor.toFixed(3)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{adj.reasoning || 'No reasoning provided'}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Concerning Patterns */}
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

      {/* Learning Patterns Table */}
      {patterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Learning Patterns Database</CardTitle>
            <CardDescription>
              Statistical patterns extracted from historical data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {patterns.map((pattern, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{pattern.pattern_key.replace('product_', '')}</h4>
                      <p className="text-xs text-muted-foreground">{pattern.pattern_type}</p>
                    </div>
                    {getConfidenceBadge(pattern.confidence_score)}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Sample Size:</span>
                      <div className="font-medium">{pattern.sample_size || 0}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Avg Variance:</span>
                      <div className="font-medium">
                        {typeof pattern.avg_variance_percentage === 'number' 
                          ? pattern.avg_variance_percentage.toFixed(2) 
                          : '0.00'}%
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Std Deviation:</span>
                      <div className="font-medium">
                        {typeof pattern.std_deviation === 'number' 
                          ? pattern.std_deviation.toFixed(2) 
                          : '0.00'}%
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Adjustment Factor:</span>
                      <div className="font-medium">
                        {typeof pattern.adjustment_factor === 'number' 
                          ? pattern.adjustment_factor.toFixed(3) 
                          : '1.000'}x
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!insights && !loading && (
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