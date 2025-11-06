import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Minus, Search, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductAnalysis {
  productCode: string;
  productName: string;
  currentPrice: number;
  marketLow: number;
  marketAverage: number;
  marketHigh: number;
  position: 'UNDERPRICED' | 'COMPETITIVE' | 'OVERPRICED';
  priceOpportunity: number;
  recommendation: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sources: string;
}

interface MarketAnalysis {
  marketAnalysis: ProductAnalysis[];
  overallInsights: string;
}

interface MarketIntelligenceProps {
  products: Array<{
    productCode: string;
    productName: string;
    cifPerUnit: number;
    quantity: number;
  }>;
}

export const MarketIntelligence = ({ products }: MarketIntelligenceProps) => {
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const analyzeMarketPrices = async () => {
    try {
      setLoading(true);
      
      const productInfo = products.map(p => ({
        productCode: p.productCode,
        productName: p.productName,
        currentCIFPrice: p.cifPerUnit,
        quantity: p.quantity
      }));

      const { data, error } = await supabase.functions.invoke('market-price-advisor', {
        body: { products: productInfo }
      });

      if (error) throw error;

      if (data.success) {
        setAnalysis(data.analysis);
        toast.success('Market analysis complete');
      } else {
        throw new Error(data.error || 'Failed to get market analysis');
      }
    } catch (error) {
      console.error('Error analyzing market prices:', error);
      toast.error('Failed to analyze market prices');
    } finally {
      setLoading(false);
    }
  };

  const getPositionBadge = (position: string) => {
    const variants = {
      UNDERPRICED: { variant: 'default' as const, icon: TrendingUp, color: 'text-green-600' },
      COMPETITIVE: { variant: 'secondary' as const, icon: Minus, color: 'text-yellow-600' },
      OVERPRICED: { variant: 'destructive' as const, icon: TrendingDown, color: 'text-red-600' }
    };
    
    const config = variants[position as keyof typeof variants];
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {position}
      </Badge>
    );
  };

  const getConfidenceBadge = (confidence: string) => {
    const variants = {
      HIGH: 'default' as const,
      MEDIUM: 'secondary' as const,
      LOW: 'outline' as const
    };
    
    return (
      <Badge variant={variants[confidence as keyof typeof variants]} className="text-xs">
        {confidence}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Market Price Intelligence
            </span>
            <Button 
              onClick={analyzeMarketPrices} 
              disabled={loading || products.length === 0}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing Market...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Check Market Prices
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!analysis && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">
                Click "Check Market Prices" to analyze current market conditions and competitive pricing
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                Searching market prices and analyzing competitive landscape...
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                This may take 30-60 seconds
              </p>
            </div>
          )}

          {analysis && !loading && (
            <div className="space-y-6">
              {/* Overall Insights */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Strategic Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{analysis.overallInsights}</p>
                </CardContent>
              </Card>

              {/* Price Comparison Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Your CIF</TableHead>
                      <TableHead className="text-right">Market Low</TableHead>
                      <TableHead className="text-right">Market Avg</TableHead>
                      <TableHead className="text-right">Market High</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead className="text-right">Opportunity</TableHead>
                      <TableHead>Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.marketAnalysis.map((item) => (
                      <TableRow key={item.productCode}>
                        <TableCell className="font-medium">
                          <div>
                            <div className="font-semibold">{item.productName}</div>
                            <div className="text-xs text-muted-foreground">{item.productCode}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          Cg {item.currentPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-600">
                          Cg {item.marketLow.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          Cg {item.marketAverage.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          Cg {item.marketHigh.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {getPositionBadge(item.position)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={item.priceOpportunity > 0 ? 'text-green-600 font-semibold' : item.priceOpportunity < 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
                            {item.priceOpportunity > 0 ? '+' : ''}Cg {item.priceOpportunity.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getConfidenceBadge(item.confidence)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Detailed Recommendations */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Detailed Recommendations</h3>
                {analysis.marketAnalysis.map((item) => (
                  <Card key={item.productCode} className="border-l-4" style={{
                    borderLeftColor: item.position === 'UNDERPRICED' ? 'rgb(22, 163, 74)' : 
                                     item.position === 'OVERPRICED' ? 'rgb(220, 38, 38)' : 
                                     'rgb(234, 179, 8)'
                  }}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold">{item.productName}</h4>
                        {getPositionBadge(item.position)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{item.recommendation}</p>
                      <p className="text-xs text-muted-foreground italic">Sources: {item.sources}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
