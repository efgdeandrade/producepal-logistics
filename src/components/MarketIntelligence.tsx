import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { TrendingUp, TrendingDown, Minus, Search, Loader2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

interface ProductAnalysis {
  productCode: string;
  productName: string;
  currentPrice: number;
  retailPriceFound?: number;
  calculatedWholesale?: number;
  marketLow: number;
  marketAverage: number;
  marketHigh: number;
  position: 'UNDERPRICED' | 'COMPETITIVE' | 'OVERPRICED';
  priceOpportunity: number;
  recommendation: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceScore?: number;
  sources: string;
  sourceUrl?: string;
  importSource?: 'usa' | 'nld' | 'other' | 'mixed';
  seasonalFactor?: 'high_season' | 'low_season';
  supplyDemandIndex?: number;
  conversionNote?: string;
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

  const getConfidenceBadge = (confidence: string, score?: number) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      HIGH: { variant: 'default', icon: TrendingUp },
      MEDIUM: { variant: 'secondary', icon: TrendingUp },
      LOW: { variant: 'outline', icon: AlertTriangle },
    };
    const config = variants[confidence] || variants.MEDIUM;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {confidence}
        {score !== undefined && ` (${(score * 100).toFixed(0)}%)`}
      </Badge>
    );
  };

  const getSeasonalBadge = (factor?: string) => {
    if (!factor) return null;
    const isHighSeason = factor === 'high_season';
    return (
      <Badge variant={isHighSeason ? 'default' : 'secondary'} className="gap-1 text-xs">
        {isHighSeason ? '☀️ High Season' : '🌙 Low Season'}
      </Badge>
    );
  };

  const getImportSourceBadge = (source?: string) => {
    if (!source) return null;
    const sources: Record<string, string> = {
      usa: '🇺🇸 USA',
      nld: '🇳🇱 NLD',
      other: '🌎 Other',
      mixed: '🌐 Mixed',
    };
    return <Badge variant="outline" className="text-xs">{sources[source] || source}</Badge>;
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
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">Market Intelligence for Curaçao</p>
                    <p className="text-sm">{analysis.overallInsights}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      💡 <strong>Pricing Note:</strong> Retail prices found online are converted to wholesale estimates by dividing by 1.40 
                      (standard 40% retail markup in Curaçao). This allows accurate wholesale-to-wholesale comparison.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Price Comparison Table */}
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Your CIF</TableHead>
                      <TableHead>Market Retail</TableHead>
                      <TableHead>Calc. Wholesale</TableHead>
                      <TableHead>Market Range</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Opportunity</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.marketAnalysis.map((item) => (
                      <TableRow key={item.productCode}>
                        <TableCell className="font-medium">
                          <div>{item.productName}</div>
                          <div className="text-xs text-muted-foreground">{item.productCode}</div>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {getSeasonalBadge(item.seasonalFactor)}
                            {getImportSourceBadge(item.importSource)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono">Cg {item.currentPrice.toFixed(2)}</div>
                          <div className="text-xs text-muted-foreground">Your CIF</div>
                        </TableCell>
                        <TableCell>
                          {item.retailPriceFound ? (
                            <>
                              <div className="font-mono">Cg {item.retailPriceFound.toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">Found online</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.calculatedWholesale ? (
                            <>
                              <div className="font-semibold font-mono">Cg {item.calculatedWholesale.toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">÷ 1.40</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">Estimated</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-1">
                            <div className="font-mono">Low: Cg {item.marketLow.toFixed(2)}</div>
                            <div className="font-mono font-semibold">Avg: Cg {item.marketAverage.toFixed(2)}</div>
                            <div className="font-mono">High: Cg {item.marketHigh.toFixed(2)}</div>
                          </div>
                        </TableCell>
                        <TableCell>{getPositionBadge(item.position)}</TableCell>
                        <TableCell>
                          <span className={item.priceOpportunity > 0 ? 'text-green-600 font-semibold font-mono' : 'text-red-600 font-mono'}>
                            {item.priceOpportunity > 0 ? '+' : ''}Cg {item.priceOpportunity.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {item.sourceUrl ? (
                            <a 
                              href={item.sourceUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              View source →
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">{item.sources}</span>
                          )}
                        </TableCell>
                        <TableCell>{getConfidenceBadge(item.confidence, item.confidenceScore)}</TableCell>
                      </TableRow>
                    )))}
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
                        <div>
                          <h4 className="font-semibold">{item.productName}</h4>
                          {item.conversionNote && (
                            <p className="text-xs text-muted-foreground mt-1">{item.conversionNote}</p>
                          )}
                        </div>
                        {getPositionBadge(item.position)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{item.recommendation}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="italic">Sources: {item.sources}</span>
                        {item.sourceUrl && (
                          <a 
                            href={item.sourceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            View →
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
