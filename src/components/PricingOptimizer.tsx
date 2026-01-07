import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Slider } from './ui/slider';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '../hooks/use-toast';
import { Sparkles, TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';

interface PricingRecommendation {
  id: string;
  product_code: string;
  product_name: string;
  current_wholesale_price: number;
  current_retail_price: number;
  recommended_wholesale_price: number;
  recommended_retail_price: number;
  expected_profit_impact: number;
  expected_margin_change: number;
  reasoning: string;
  confidence_score: string;
  risks?: string;
  customerTieringSuggestion?: string;
  data_sources?: any;
}

interface PricingOptimizerProps {
  products?: string[];
}

export function PricingOptimizer({ products }: PricingOptimizerProps) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<PricingRecommendation[]>([]);
  const [previewPrices, setPreviewPrices] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const analyzePricing = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pricing-optimizer', {
        body: {
          products,
          analysisType: 'full',
          includeMarketData: true
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to analyze pricing');
      }

      setRecommendations(data.recommendations || []);
      
      // Initialize preview prices
      const initialPrices: Record<string, number> = {};
      data.recommendations?.forEach((rec: PricingRecommendation) => {
        initialPrices[rec.id] = rec.recommended_wholesale_price;
      });
      setPreviewPrices(initialPrices);

      toast({
        title: 'Analysis Complete',
        description: `Found ${data.recommendations?.length || 0} pricing opportunities`,
      });
    } catch (error: any) {
      console.error('Pricing analysis error:', error);
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Failed to analyze pricing',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const applyRecommendation = async (rec: PricingRecommendation) => {
    try {
      // Update product prices
      const { error: updateError } = await supabase
        .from('products')
        .update({
          wholesale_price_xcg_per_unit: rec.recommended_wholesale_price,
          retail_price_xcg_per_unit: rec.recommended_retail_price,
          updated_at: new Date().toISOString()
        })
        .eq('code', rec.product_code);

      if (updateError) throw updateError;

      // Update recommendation status
      const { error: statusError } = await supabase
        .from('pricing_recommendations')
        .update({
          status: 'applied',
          applied_at: new Date().toISOString()
        })
        .eq('id', rec.id);

      if (statusError) throw statusError;

      toast({
        title: 'Pricing Updated',
        description: `${rec.product_name} pricing applied. Expected +Cg ${rec.expected_profit_impact?.toFixed(2)}/week`,
      });

      // Refresh recommendations
      setRecommendations(prev => prev.filter(r => r.id !== rec.id));
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const dismissRecommendation = async (rec: PricingRecommendation) => {
    try {
      const { error } = await supabase
        .from('pricing_recommendations')
        .update({ status: 'rejected' })
        .eq('id', rec.id);

      if (error) throw error;

      setRecommendations(prev => prev.filter(r => r.id !== rec.id));
      
      toast({
        title: 'Recommendation Dismissed',
        description: `Dismissed pricing suggestion for ${rec.product_name}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const calculatePreviewImpact = (rec: PricingRecommendation, newPrice: number) => {
    const currentMargin = rec.current_wholesale_price > 0 
      ? ((rec.current_wholesale_price - (rec.current_wholesale_price * 0.7)) / rec.current_wholesale_price) * 100
      : 0;
    
    const newMargin = newPrice > 0
      ? ((newPrice - (rec.current_wholesale_price * 0.7)) / newPrice) * 100
      : 0;
    
    return {
      marginChange: newMargin - currentMargin,
      priceChange: ((newPrice - rec.current_wholesale_price) / rec.current_wholesale_price) * 100
    };
  };

  const topOpportunities = recommendations.filter(r => (r.expected_profit_impact || 0) > 0).slice(0, 5);
  const priceAdjustments = recommendations.filter(r => (r.expected_profit_impact || 0) <= 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Pricing Optimizer
            </CardTitle>
            <Button onClick={analyzePricing} disabled={loading}>
              {loading ? 'Analyzing...' : 'Analyze Pricing'}
            </Button>
          </div>
        </CardHeader>

        {recommendations.length > 0 && (
          <CardContent className="space-y-6">
            {/* Top Opportunities */}
            {topOpportunities.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Top Pricing Opportunities
                </h3>
                <div className="space-y-4">
                  {topOpportunities.map((rec) => (
                    <Card key={rec.id} className="border-l-4 border-l-green-500">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold">{rec.product_name}</h4>
                            <p className="text-sm text-muted-foreground">{rec.product_code}</p>
                          </div>
                          <Badge variant="default" className="bg-green-600">
                            +Cg {rec.expected_profit_impact?.toFixed(2)}/week
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <span className="text-sm text-muted-foreground">Current Wholesale</span>
                            <p className="text-lg font-semibold">Cg {rec.current_wholesale_price?.toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Recommended</span>
                            <p className="text-lg font-semibold text-green-600">
                              Cg {rec.recommended_wholesale_price?.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {/* Price Preview Slider */}
                        <div className="mb-4 p-3 bg-muted rounded-lg">
                          <label className="text-sm font-medium mb-2 block">Preview Price Impact</label>
                          <Slider
                            min={rec.current_wholesale_price * 0.8}
                            max={rec.current_wholesale_price * 1.3}
                            step={0.05}
                            value={[previewPrices[rec.id] || rec.recommended_wholesale_price]}
                            onValueChange={(val) => setPreviewPrices(prev => ({ ...prev, [rec.id]: val[0] }))}
                          />
                          <div className="text-sm mt-2 flex justify-between">
                            <span>At Cg {(previewPrices[rec.id] || rec.recommended_wholesale_price).toFixed(2)}:</span>
                            <span className={
                              calculatePreviewImpact(rec, previewPrices[rec.id] || rec.recommended_wholesale_price).priceChange > 0 
                                ? 'text-green-600' 
                                : 'text-red-600'
                            }>
                              {calculatePreviewImpact(rec, previewPrices[rec.id] || rec.recommended_wholesale_price).priceChange > 0 ? '+' : ''}
                              {calculatePreviewImpact(rec, previewPrices[rec.id] || rec.recommended_wholesale_price).priceChange.toFixed(1)}% price change
                            </span>
                          </div>
                        </div>

                        <div className="mb-4 text-sm space-y-2">
                          <div>
                            <strong>Reasoning:</strong>
                            <p className="text-muted-foreground mt-1">{rec.reasoning}</p>
                          </div>
                          {rec.risks && (
                            <div className="flex gap-2">
                              <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                              <div>
                                <strong>Risks:</strong>
                                <p className="text-muted-foreground">{rec.risks}</p>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Badge variant={rec.confidence_score === 'HIGH' ? 'default' : 'secondary'}>
                              {rec.confidence_score} Confidence
                            </Badge>
                            {rec.data_sources && (
                              <span className="text-xs text-muted-foreground">
                                Based on {rec.data_sources.orderCount} orders
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button onClick={() => applyRecommendation(rec)} variant="default" size="sm">
                            <DollarSign className="h-4 w-4 mr-1" />
                            Apply Recommendation
                          </Button>
                          <Button onClick={() => dismissRecommendation(rec)} variant="ghost" size="sm">
                            Dismiss
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Price Adjustments Needed */}
            {priceAdjustments.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-orange-600" />
                  Price Adjustments Recommended
                </h3>
                <div className="space-y-4">
                  {priceAdjustments.map((rec) => (
                    <Card key={rec.id} className="border-l-4 border-l-orange-500">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold">{rec.product_name}</h4>
                            <p className="text-sm text-muted-foreground">{rec.product_code}</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{rec.reasoning}</p>
                        <div className="flex gap-2">
                          <Button onClick={() => applyRecommendation(rec)} variant="outline" size="sm">
                            Apply
                          </Button>
                          <Button onClick={() => dismissRecommendation(rec)} variant="ghost" size="sm">
                            Dismiss
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}

        {!loading && recommendations.length === 0 && (
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Click "Analyze Pricing" to get AI-powered pricing recommendations</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
