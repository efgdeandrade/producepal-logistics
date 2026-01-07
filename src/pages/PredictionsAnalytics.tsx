import { useState, useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, TrendingDown, AlertTriangle, Target, BarChart3, ArrowLeft } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface WasteStats {
  customer_name: string;
  product_name: string;
  total_waste: number;
  total_deliveries: number;
  waste_percentage: number;
  recent_trend: 'up' | 'down' | 'stable';
}

interface PredictionAccuracy {
  customer_name: string;
  product_name: string;
  avg_accuracy: number;
  total_predictions: number;
  confidence: number;
}

const PredictionsAnalytics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [wasteStats, setWasteStats] = useState<WasteStats[]>([]);
  const [predictionAccuracy, setPredictionAccuracy] = useState<PredictionAccuracy[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(30); // days

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      const startDate = subDays(new Date(), dateRange).toISOString();

      // Fetch all customers and products for joins
      const { data: allCustomers } = await supabase.from('customers').select('id, name');
      const { data: allProducts } = await supabase.from('products').select('code, name');
      
      const customerMap = new Map(allCustomers?.map(c => [c.id, c.name]) || []);
      const productMap = new Map(allProducts?.map(p => [p.code, p.name]) || []);

      // Fetch waste statistics
      const { data: wasteData, error: wasteError } = await supabase
        .from('waste_records')
        .select('*')
        .gte('created_at', startDate);

      if (wasteError) throw wasteError;

      // Fetch deliveries and their items
      const { data: recentDeliveries } = await supabase
        .from('deliveries')
        .select('id, created_at')
        .gte('created_at', startDate);

      const deliveryIds = recentDeliveries?.map(d => d.id) || [];
      
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('delivery_items')
        .select('*')
        .in('delivery_id', deliveryIds);

      if (deliveryError) throw deliveryError;

      // Process waste statistics
      const wasteByCustomerProduct: { [key: string]: { waste: number; deliveries: number } } = {};
      
      (wasteData || []).forEach(record => {
        const customerName = customerMap.get(record.customer_id) || 'Unknown';
        const productName = productMap.get(record.product_code) || record.product_code;
        const key = `${customerName}-${productName}`;
        if (!wasteByCustomerProduct[key]) {
          wasteByCustomerProduct[key] = { waste: 0, deliveries: 0 };
        }
        wasteByCustomerProduct[key].waste += record.waste_quantity;
      });

      (deliveryData || []).forEach(item => {
        const customerName = customerMap.get(item.customer_id) || 'Unknown';
        const productName = productMap.get(item.product_code) || item.product_code;
        const key = `${customerName}-${productName}`;
        if (!wasteByCustomerProduct[key]) {
          wasteByCustomerProduct[key] = { waste: 0, deliveries: 0 };
        }
        wasteByCustomerProduct[key].deliveries += item.planned_quantity;
      });

      const wasteStatsArray = Object.entries(wasteByCustomerProduct).map(([key, data]) => {
        const [customer_name, product_name] = key.split('-');
        return {
          customer_name: customer_name || 'Unknown',
          product_name: product_name || 'Unknown',
          total_waste: data.waste,
          total_deliveries: data.deliveries,
          waste_percentage: (data.waste / data.deliveries) * 100,
          recent_trend: 'stable' as const, // TODO: Calculate trend
        };
      }).sort((a, b) => b.waste_percentage - a.waste_percentage);

      setWasteStats(wasteStatsArray);

      // Fetch prediction accuracy
      const { data: predictionsData, error: predictionsError } = await supabase
        .from('predictions')
        .select('*')
        .gte('created_at', startDate)
        .not('actual_quantity', 'is', null);

      if (predictionsError) throw predictionsError;

      // Process prediction accuracy
      const accuracyByCustomerProduct: { [key: string]: { accuracies: number[]; confidences: number[] } } = {};
      
      (predictionsData || []).forEach(pred => {
        if (pred.accuracy_score !== null) {
          const customerName = customerMap.get(pred.customer_id) || 'Unknown';
          const productName = productMap.get(pred.product_code) || pred.product_code;
          const key = `${customerName}-${productName}`;
          if (!accuracyByCustomerProduct[key]) {
            accuracyByCustomerProduct[key] = { accuracies: [], confidences: [] };
          }
          accuracyByCustomerProduct[key].accuracies.push(pred.accuracy_score);
          if (pred.confidence_score) {
            accuracyByCustomerProduct[key].confidences.push(pred.confidence_score);
          }
        }
      });

      const accuracyArray = Object.entries(accuracyByCustomerProduct).map(([key, data]) => {
        const [customer_name, product_name] = key.split('-');
        const avgAccuracy = data.accuracies.reduce((a, b) => a + b, 0) / data.accuracies.length;
        const avgConfidence = data.confidences.length > 0 
          ? data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length 
          : 0;
        
        return {
          customer_name: customer_name || 'Unknown',
          product_name: product_name || 'Unknown',
          avg_accuracy: avgAccuracy * 100,
          total_predictions: data.accuracies.length,
          confidence: avgConfidence * 100,
        };
      }).sort((a, b) => b.avg_accuracy - a.avg_accuracy);

      setPredictionAccuracy(accuracyArray);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Target className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 90) return 'text-green-600';
    if (accuracy >= 75) return 'text-blue-600';
    if (accuracy >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <BarChart3 className="h-12 w-12 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      <main className="container py-8">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Predictions & Analytics</h1>
            <p className="text-muted-foreground">AI predictions, waste analysis, and performance metrics</p>
          </div>
        </div>

        <div className="grid gap-6 mb-6">
          {/* Date Range Selector */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-2">
                {[7, 14, 30, 60, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => setDateRange(days)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      dateRange === days
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {days} Days
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Waste Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Waste Analysis
              </CardTitle>
              <CardDescription>
                Track waste patterns and identify optimization opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {wasteStats.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No waste data available for this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-semibold">Customer</th>
                        <th className="text-left py-3 px-4 font-semibold">Product</th>
                        <th className="text-right py-3 px-4 font-semibold">Total Waste</th>
                        <th className="text-right py-3 px-4 font-semibold">Total Delivered</th>
                        <th className="text-right py-3 px-4 font-semibold">Waste %</th>
                        <th className="text-center py-3 px-4 font-semibold">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wasteStats.map((stat, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">{stat.customer_name}</td>
                          <td className="py-3 px-4">{stat.product_name}</td>
                          <td className="py-3 px-4 text-right font-medium text-orange-600">
                            {stat.total_waste}
                          </td>
                          <td className="py-3 px-4 text-right">{stat.total_deliveries}</td>
                          <td className="py-3 px-4 text-right">
                            <Badge variant={stat.waste_percentage > 10 ? 'destructive' : 'secondary'}>
                              {stat.waste_percentage.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {getTrendIcon(stat.recent_trend)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prediction Accuracy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-500" />
                Prediction Accuracy
              </CardTitle>
              <CardDescription>
                How well AI predictions match actual sales
              </CardDescription>
            </CardHeader>
            <CardContent>
              {predictionAccuracy.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No prediction data available for this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-semibold">Customer</th>
                        <th className="text-left py-3 px-4 font-semibold">Product</th>
                        <th className="text-right py-3 px-4 font-semibold">Predictions</th>
                        <th className="text-right py-3 px-4 font-semibold">Avg Accuracy</th>
                        <th className="text-right py-3 px-4 font-semibold">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictionAccuracy.map((pred, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">{pred.customer_name}</td>
                          <td className="py-3 px-4">{pred.product_name}</td>
                          <td className="py-3 px-4 text-right">{pred.total_predictions}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-bold text-lg ${getAccuracyColor(pred.avg_accuracy)}`}>
                              {pred.avg_accuracy.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-muted-foreground">
                            {pred.confidence.toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PredictionsAnalytics;
