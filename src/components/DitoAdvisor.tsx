import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Package, Loader2, CheckCircle2, Brain, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ProductWeightData {
  code: string;
  name: string;
  quantity: number;
  actualWeight: number;
  volumetricWeight: number;
  chargeableWeight: number;
  weightType: 'actual' | 'volumetric';
  costUSD: number;
  wholesalePriceXCG: number;
  retailPriceXCG: number;
  profitPerUnit: number;
}

interface PalletConfiguration {
  totalPallets: number;
  totalActualWeight: number;
  totalVolumetricWeight: number;
  totalChargeableWeight: number;
  limitingFactor: 'actual_weight' | 'volumetric_weight' | 'balanced';
  utilizationPercentage: number;
  heightUtilization: number;
}

interface DitoAdvisorProps {
  orderItems: ProductWeightData[];
  palletConfiguration: PalletConfiguration;
  freightCostPerKg: number;
  exchangeRate: number;
  onApplySuggestion?: (productCode: string, quantity: number) => void;
  onApplyMethodRecommendation?: (method: 'proportional' | 'valueBased' | 'smartBlend', blendRatio?: number) => void;
}

interface Recommendation {
  analysisType: string;
  weightGap: number;
  gapPercentage: number;
  recommendations: {
    productsToAdd: Array<{
      productCode: string;
      productName: string;
      suggestedQuantity: number;
      reasoningScore: number;
      impactAnalysis: {
        weightAdded: number;
        volumeAdded: number;
        actualWeightAdded: number;
        volumetricWeightAdded: number;
        profitAdded: number;
        costAdded: number;
        newUtilization: number;
        newWeightGap: number;
        freightSavingsPercentage: number;
      };
      reasoning: string;
    }>;
    productsToRemove: Array<{
      productCode: string;
      productName: string;
      suggestedQuantity: number;
      profitImpact: number;
      reasoning: string;
    }>;
    warnings: string[];
    palletOptimizations: string[];
  };
  profitabilityAnalysis: {
    currentProfit: number;
    optimizedProfit: number;
    improvementPercentage: number;
    freightWasteReduction: number;
  };
  summary: string;
  // New unified advisor fields
  recommendedMethod?: 'proportional' | 'valueBased' | 'smartBlend';
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  blendRatio?: number;
  reasoning?: string[];
  learningAdjustments?: Array<{
    productCode: string;
    originalFactor: number;
    recommendedFactor: number;
    reasoning: string;
  }>;
  riskAlerts?: string[];
}

export const DitoAdvisor = ({ 
  orderItems, 
  palletConfiguration, 
  freightCostPerKg, 
  exchangeRate,
  onApplySuggestion,
  onApplyMethodRecommendation 
}: DitoAdvisorProps) => {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);

  const getOptimizationAdvice = async () => {
    try {
      setLoading(true);

      // Call the unified advisor
      const { data, error } = await supabase.functions.invoke('dito-unified-advisor', {
        body: {
          products: orderItems.map(item => ({
            code: item.code,
            name: item.name,
            quantity: item.quantity,
            actualWeight: item.actualWeight,
            volumetricWeight: item.volumetricWeight,
            costUSD: item.costUSD,
            wholesalePriceXCG: item.wholesalePriceXCG,
            retailPriceXCG: item.retailPriceXCG,
          })),
          totalFreight: freightCostPerKg * palletConfiguration.totalChargeableWeight,
          exchangeRate,
          palletConfig: {
            totalPallets: palletConfiguration.totalPallets,
            totalActualWeight: palletConfiguration.totalActualWeight,
            totalVolumetricWeight: palletConfiguration.totalVolumetricWeight,
            utilizationPercentage: palletConfiguration.utilizationPercentage,
          },
          includeWeightOptimization: true,
        }
      });

      if (error) throw error;

      if (data.success) {
        setRecommendation(data.recommendation);
        toast({
          title: 'Dito Advisor Analysis Complete',
          description: 'Review AI-powered optimization suggestions below',
        });
      } else {
        throw new Error(data.error || 'Failed to get recommendations');
      }
    } catch (error: any) {
      console.error('Error getting Dito Advisor recommendations:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to get optimization recommendations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getAnalysisColor = () => {
    if (!recommendation) return 'default';
    if (recommendation.analysisType === 'volumetric_limiting') return 'destructive';
    if (recommendation.analysisType === 'balanced') return 'default';
    return 'secondary';
  };

  const getAnalysisIcon = () => {
    if (!recommendation) return <Package className="h-4 w-4" />;
    if (recommendation.analysisType === 'volumetric_limiting') return <AlertTriangle className="h-4 w-4" />;
    if (recommendation.analysisType === 'balanced') return <CheckCircle2 className="h-4 w-4" />;
    return <TrendingUp className="h-4 w-4" />;
  };

  const getConfidenceColor = (confidence?: string) => {
    if (confidence === 'HIGH') return 'text-green-600';
    if (confidence === 'MEDIUM') return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Dito Advisor - Unified AI
            </CardTitle>
            <CardDescription>
              AI-powered recommendations for weight optimization and CIF method selection
            </CardDescription>
          </div>
          <Button 
            onClick={getOptimizationAdvice} 
            disabled={loading || orderItems.length === 0}
            size="sm"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Get AI Suggestions
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {recommendation && (
        <CardContent className="space-y-6">
          {/* CIF Method Recommendation - NEW */}
          {recommendation.recommendedMethod && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Recommended CIF Method</h4>
                  </div>
                  <Badge variant="outline" className={getConfidenceColor(recommendation.confidence)}>
                    {recommendation.confidence} Confidence
                  </Badge>
                </div>
                
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="default" className="text-lg capitalize">
                    {recommendation.recommendedMethod === 'smartBlend' 
                      ? `Smart Blend (${((recommendation.blendRatio || 0.7) * 100).toFixed(0)}% weight)`
                      : recommendation.recommendedMethod === 'proportional'
                        ? 'Proportional (by Weight)'
                        : 'Value-Based (by Cost)'
                    }
                  </Badge>
                  {onApplyMethodRecommendation && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onApplyMethodRecommendation(
                        recommendation.recommendedMethod!,
                        recommendation.blendRatio
                      )}
                    >
                      <Target className="mr-2 h-4 w-4" />
                      Apply Method
                    </Button>
                  )}
                </div>

                {recommendation.reasoning && recommendation.reasoning.length > 0 && (
                  <ul className="text-sm text-muted-foreground space-y-1 mb-3">
                    {recommendation.reasoning.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Learning Adjustments */}
                {recommendation.learningAdjustments && recommendation.learningAdjustments.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm font-medium mb-2">Learning-Based Adjustments:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {recommendation.learningAdjustments.slice(0, 4).map((adj, idx) => (
                        <div key={idx} className="text-xs bg-background/50 rounded p-2">
                          <span className="font-medium">{adj.productCode}</span>
                          <span className={`ml-2 ${adj.recommendedFactor > 1 ? 'text-red-600' : 'text-green-600'}`}>
                            {adj.recommendedFactor > 1 ? '+' : ''}{((adj.recommendedFactor - 1) * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Risk Alerts */}
          {recommendation.riskAlerts && recommendation.riskAlerts.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {recommendation.riskAlerts.map((alert, idx) => (
                    <li key={idx} className="text-sm">{alert}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Analysis Summary */}
          <Alert>
            <div className="flex items-start gap-3">
              {getAnalysisIcon()}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={getAnalysisColor()}>
                    {recommendation.analysisType.replace('_', ' ').toUpperCase()}
                  </Badge>
                  {recommendation.analysisType === 'volumetric_limiting' && (
                    <Badge variant="outline" className="text-orange-600">
                      Paying for {Math.abs(recommendation.weightGap).toFixed(2)} kg of "air"
                    </Badge>
                  )}
                </div>
                <AlertDescription className="text-sm">
                  {recommendation.summary}
                </AlertDescription>
              </div>
            </div>
          </Alert>

          {/* Weight Gap Analysis */}
          {recommendation.weightGap > 5 && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <h4 className="font-semibold text-sm">Weight Analysis</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Weight Gap:</span>
                  <span className="ml-2 font-bold text-orange-600">
                    {recommendation.weightGap.toFixed(2)} kg ({recommendation.gapPercentage.toFixed(1)}%)
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Wasted Freight Cost:</span>
                  <span className="ml-2 font-bold text-red-600">
                    ${(recommendation.weightGap * freightCostPerKg).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Products to ADD (Priority) */}
          {recommendation.recommendations.productsToAdd?.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <h4 className="font-semibold">Recommended Products to ADD</h4>
                <Badge variant="secondary" className="text-xs">Priority Suggestions</Badge>
              </div>
              
              <div className="space-y-3">
                {recommendation.recommendations.productsToAdd.map((product, idx) => (
                  <Card key={idx} className="border-green-200 bg-green-50/50">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h5 className="font-semibold">{product.productName}</h5>
                          <Badge variant="outline" className="mt-1">
                            Score: {product.reasoningScore}/100
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">
                            +{product.suggestedQuantity}
                          </div>
                          <div className="text-xs text-muted-foreground">units</div>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">
                        {product.reasoning}
                      </p>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Weight Added:</span>
                            <span className="font-semibold">
                              {product.impactAnalysis.actualWeightAdded.toFixed(2)} kg
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">New Gap:</span>
                            <span className="font-semibold text-green-600">
                              {product.impactAnalysis.newWeightGap.toFixed(2)} kg
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Freight Savings:</span>
                            <span className="font-semibold text-green-600">
                              {product.impactAnalysis.freightSavingsPercentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Additional Cost:</span>
                            <span className="font-semibold">
                              ${product.impactAnalysis.costAdded.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Additional Profit:</span>
                            <span className="font-semibold text-green-600">
                              Cg {product.impactAnalysis.profitAdded.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">New Utilization:</span>
                            <span className="font-semibold">
                              {product.impactAnalysis.newUtilization.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {onApplySuggestion && (
                        <Button 
                          size="sm" 
                          className="w-full mt-3"
                          onClick={() => onApplySuggestion(product.productCode, product.suggestedQuantity)}
                        >
                          Add {product.suggestedQuantity} units to order
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Products to REMOVE (Secondary) */}
          {recommendation.recommendations.productsToRemove?.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-orange-600" />
                <h4 className="font-semibold">Alternative: Products to Remove</h4>
                <Badge variant="outline" className="text-xs">If adding isn't feasible</Badge>
              </div>
              
              <div className="space-y-2">
                {recommendation.recommendations.productsToRemove.map((product, idx) => (
                  <Card key={idx} className="border-orange-200">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h5 className="font-semibold text-sm">{product.productName}</h5>
                          <p className="text-xs text-muted-foreground mt-1">
                            {product.reasoning}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-lg font-bold text-orange-600">
                            -{product.suggestedQuantity}
                          </div>
                          <div className="text-xs text-red-600">
                            -{product.profitImpact.toFixed(2)} Cg profit
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {recommendation.recommendations.warnings?.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {recommendation.recommendations.warnings.map((warning, idx) => (
                    <li key={idx} className="text-sm">{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Pallet Optimizations */}
          {recommendation.recommendations.palletOptimizations?.length > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Pallet Configuration Tips
              </h4>
              <ul className="space-y-1">
                {recommendation.recommendations.palletOptimizations.map((tip, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground">• {tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Profitability Summary */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-primary/5 rounded-lg">
            <div>
              <div className="text-xs text-muted-foreground">Current Profit</div>
              <div className="text-2xl font-bold">
                Cg {recommendation.profitabilityAnalysis.currentProfit.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Optimized Profit</div>
              <div className="text-2xl font-bold text-green-600">
                Cg {recommendation.profitabilityAnalysis.optimizedProfit.toFixed(2)}
              </div>
              {recommendation.profitabilityAnalysis.improvementPercentage > 0 && (
                <Badge variant="secondary" className="mt-1">
                  +{recommendation.profitabilityAnalysis.improvementPercentage.toFixed(1)}% improvement
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      )}

      {!recommendation && !loading && (
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p>Click "Get AI Suggestions" to analyze your order and receive optimization recommendations</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
};