import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, TrendingUp, Package, DollarSign, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VolumetricWeightAlertProps {
  isChargedByVolumetric: boolean;
  weightGapKg: number;
  weightGapPercent: number;
  totalActualWeight: number;
  totalVolumetricWeight: number;
  totalChargeableWeight: number;
  orderItems: any[];
  freightCostPerKg: number;
  exchangeRate: number;
}

export function VolumetricWeightAlert({
  isChargedByVolumetric,
  weightGapKg,
  weightGapPercent,
  totalActualWeight,
  totalVolumetricWeight,
  totalChargeableWeight,
  orderItems,
  freightCostPerKg,
  exchangeRate
}: VolumetricWeightAlertProps) {
  const [isLoadingAdvisor, setIsLoadingAdvisor] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  if (!isChargedByVolumetric) {
    return null;
  }

  const getAISuggestions = async () => {
    setIsLoadingAdvisor(true);
    try {
      const palletConfig = {
        totalPallets: Math.ceil(totalChargeableWeight / 500),
        totalActualWeight,
        totalVolumetricWeight,
        totalChargeableWeight,
        limitingFactor: 'volumetric_weight',
        utilizationPercentage: (totalActualWeight / totalVolumetricWeight) * 100,
        heightUtilization: 85
      };

      const productData = orderItems.map(item => ({
        code: item.code,
        name: item.name,
        quantity: item.totalUnits,
        actualWeight: item.actualWeight,
        volumetricWeight: item.volumetricWeight,
        chargeableWeight: Math.max(item.actualWeight, item.volumetricWeight),
        weightType: item.volumetricWeight > item.actualWeight ? 'volumetric' : 'actual',
        costUSD: item.costPerUnit,
        wholesalePriceXCG: item.wholesalePriceXCG,
        retailPriceXCG: item.retailPriceXCG,
        profitPerUnit: item.wholesalePriceXCG - item.costPerUnit
      }));

      const { data, error } = await supabase.functions.invoke('volumetric-weight-advisor', {
        body: {
          orderItems: productData,
          palletConfiguration: palletConfig,
          freightCostPerKg,
          exchangeRate
        }
      });

      if (error) throw error;

      setAiSuggestions(data);
      setShowSuggestions(true);
      toast.success('AI recommendations generated successfully');
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
      toast.error('Failed to get AI recommendations');
    } finally {
      setIsLoadingAdvisor(false);
    }
  };

  return (
    <div className="space-y-4 mb-6">
      <Alert variant="destructive" className="border-orange-500 bg-orange-50">
        <AlertTriangle className="h-5 w-5 text-orange-600" />
        <AlertTitle className="text-orange-900 font-bold">
          ⚠️ Freight Charged by Volumetric Weight
        </AlertTitle>
        <AlertDescription className="text-orange-800">
          <div className="space-y-2 mt-2">
            <p className="font-semibold">
              You're paying for <span className="text-red-600">{weightGapKg.toFixed(2)} kg of "air"</span>
            </p>
            <div className="grid grid-cols-3 gap-4 text-sm mt-3">
              <div className="bg-white/50 p-2 rounded">
                <p className="text-gray-600">Actual Weight (incl. pallets)</p>
                <p className="font-bold">{totalActualWeight.toFixed(2)} kg</p>
              </div>
              <div className="bg-white/50 p-2 rounded">
                <p className="text-gray-600">Volumetric Weight (incl. pallets)</p>
                <p className="font-bold text-orange-600">{totalVolumetricWeight.toFixed(2)} kg</p>
              </div>
              <div className="bg-white/50 p-2 rounded">
                <p className="text-gray-600">Charged Weight</p>
                <p className="font-bold text-red-600">{totalChargeableWeight.toFixed(2)} kg</p>
              </div>
            </div>
            <p className="text-sm mt-3">
              <strong>Extra cost:</strong> {weightGapKg.toFixed(2)} kg × ${freightCostPerKg.toFixed(2)}/kg = 
              <span className="text-red-600 font-bold"> ${(weightGapKg * freightCostPerKg).toFixed(2)}</span> wasted on air
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Gap: {weightGapPercent.toFixed(1)}% - This means you're paying {weightGapPercent.toFixed(1)}% more than the actual weight
            </p>
          </div>
        </AlertDescription>
      </Alert>

      <div className="flex justify-center">
        <Button 
          onClick={getAISuggestions}
          disabled={isLoadingAdvisor}
          size="lg"
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          <Lightbulb className="mr-2 h-5 w-5" />
          {isLoadingAdvisor ? 'Analyzing...' : 'Get AI Recommendations to Fix This'}
        </Button>
      </div>

      {showSuggestions && aiSuggestions && (
        <div className="space-y-4">
          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-purple-600" />
                Dito Advisor's Recommendations
              </CardTitle>
              <CardDescription>
                AI-powered suggestions to optimize your freight costs and pricing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiSuggestions.summary && (
                <div className="bg-white p-4 rounded-lg border border-purple-200">
                  <h4 className="font-semibold text-purple-900 mb-2">Summary</h4>
                  <p className="text-sm text-gray-700">{aiSuggestions.summary}</p>
                </div>
              )}

              {aiSuggestions.potentialSavings && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <DollarSign className="h-5 w-5 text-green-600 mb-2" />
                    <p className="text-xs text-gray-600">Potential Savings</p>
                    <p className="text-xl font-bold text-green-600">
                      ${aiSuggestions.potentialSavings.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <TrendingUp className="h-5 w-5 text-blue-600 mb-2" />
                    <p className="text-xs text-gray-600">Profit Increase</p>
                    <p className="text-xl font-bold text-blue-600">
                      +{aiSuggestions.profitIncrease?.toFixed(1) || 0}%
                    </p>
                  </div>
                </div>
              )}

              {aiSuggestions.productsToAdd && aiSuggestions.productsToAdd.length > 0 && (
                <div className="bg-white p-4 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    ✅ Products to ADD (Fill the Air with Profit)
                  </h4>
                  <div className="space-y-3">
                    {aiSuggestions.productsToAdd.map((suggestion: any, idx: number) => (
                      <div key={idx} className="bg-green-50 p-3 rounded border-l-4 border-green-500">
                        <p className="font-semibold text-green-900">{suggestion.productName}</p>
                        <p className="text-sm text-gray-700 mt-1">{suggestion.reason}</p>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                          <div>
                            <p className="text-gray-600">Suggested Qty</p>
                            <p className="font-bold">{suggestion.suggestedQuantity} units</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Weight Impact</p>
                            <p className="font-bold text-green-600">+{suggestion.weightImpact?.toFixed(1)} kg</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Profit Impact</p>
                            <p className="font-bold text-green-600">${suggestion.profitImpact?.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aiSuggestions.productsToRemove && aiSuggestions.productsToRemove.length > 0 && (
                <div className="bg-white p-4 rounded-lg border border-orange-200">
                  <h4 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    ⚠️ Products to REDUCE (Low Density Items)
                  </h4>
                  <div className="space-y-3">
                    {aiSuggestions.productsToRemove.map((suggestion: any, idx: number) => (
                      <div key={idx} className="bg-orange-50 p-3 rounded border-l-4 border-orange-500">
                        <p className="font-semibold text-orange-900">{suggestion.productName}</p>
                        <p className="text-sm text-gray-700 mt-1">{suggestion.reason}</p>
                        <div className="text-xs mt-2">
                          <p className="text-gray-600">Suggested action: {suggestion.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aiSuggestions.pricingRecommendations && (
                <div className="bg-white p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    💰 Pricing Adjustments to Protect Margins
                  </h4>
                  <p className="text-sm text-gray-700 mb-3">
                    {aiSuggestions.pricingRecommendations.overview}
                  </p>
                  {aiSuggestions.pricingRecommendations.productAdjustments?.map((adj: any, idx: number) => (
                    <div key={idx} className="bg-blue-50 p-3 rounded mt-2">
                      <p className="font-semibold text-blue-900">{adj.productName}</p>
                      <p className="text-sm text-gray-700">{adj.recommendation}</p>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        <div>
                          <p className="text-gray-600">Current CIF Impact</p>
                          <p className="font-bold">Cg {adj.currentCIF?.toFixed(2)}/unit</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Suggested Price</p>
                          <p className="font-bold text-blue-600">Cg {adj.suggestedPrice?.toFixed(2)}/unit</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {aiSuggestions.nextOrderStrategy && (
                <div className="bg-white p-4 rounded-lg border border-purple-200">
                  <h4 className="font-semibold text-purple-900 mb-3">
                    📋 Strategy for Next Order
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-700">
                    {aiSuggestions.nextOrderStrategy.map((tip: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-purple-600 font-bold">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
