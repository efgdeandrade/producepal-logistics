import { useState } from 'react';
import { ChevronDown, ChevronRight, Calculator, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CIFBreakdownProduct {
  productCode: string;
  productName: string;
  quantity: number;
  costPerUnit: number;
  totalCost: number;
  weight: number;
  weightContribution: number; // percentage
  costContribution: number; // percentage
  freightShare: number;
  cifUSD: number;
  cifXCG: number;
  cifPerUnit: number;
  wholesalePrice: number;
  retailPrice: number;
  wholesaleMargin: number;
  retailMargin: number;
  learningAdjustment?: {
    factor: number;
    confidence: number;
    source: string;
  };
}

interface CIFBreakdownPanelProps {
  products: CIFBreakdownProduct[];
  totalFreight: number;
  exchangeRate: number;
  distributionMethod: string;
  blendRatio?: number;
  totalWeight: number;
  totalCost: number;
}

export function CIFBreakdownPanel({
  products,
  totalFreight,
  exchangeRate,
  distributionMethod,
  blendRatio,
  totalWeight,
  totalCost,
}: CIFBreakdownPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  const toggleProduct = (code: string) => {
    setExpandedProducts(prev => ({
      ...prev,
      [code]: !prev[code]
    }));
  };

  const getMethodDescription = () => {
    switch (distributionMethod) {
      case 'byWeight':
      case 'proportional':
        return 'Freight allocated proportionally by weight contribution';
      case 'byCost':
      case 'valueBased':
        return 'Freight allocated proportionally by product cost';
      case 'equally':
        return 'Freight split equally across all products';
      case 'hybrid':
        return `Hybrid: ${Math.round((blendRatio || 0.5) * 100)}% weight + ${Math.round((1 - (blendRatio || 0.5)) * 100)}% cost`;
      case 'smartBlend':
        return `AI-optimized blend: ${Math.round((blendRatio || 0.7) * 100)}% weight + ${Math.round((1 - (blendRatio || 0.7)) * 100)}% cost`;
      case 'strategic':
        return 'Risk-adjusted allocation based on waste rate and velocity';
      case 'volumeOptimized':
        return 'Higher frequency products receive lower freight allocation';
      case 'customerTier':
        return 'Wholesale-heavy products get reduced freight allocation';
      default:
        return distributionMethod;
    }
  };

  const formatCurrency = (value: number, currency: 'USD' | 'XCG' = 'USD') => {
    const symbol = currency === 'USD' ? '$' : 'Cg';
    return `${symbol}${value.toFixed(2)}`;
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  return (
    <Card className="border-dashed">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                How was this calculated?
              </CardTitle>
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Summary Section */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Distribution Method:</span>
                <Badge variant="outline">{distributionMethod}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{getMethodDescription()}</p>
              
              <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Total Freight</div>
                  <div className="font-semibold text-sm">{formatCurrency(totalFreight)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Exchange Rate</div>
                  <div className="font-semibold text-sm">{exchangeRate.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Total Weight</div>
                  <div className="font-semibold text-sm">{totalWeight.toFixed(1)} kg</div>
                </div>
              </div>
            </div>

            {/* Per-Product Breakdown */}
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {products.map((product) => (
                  <div
                    key={product.productCode}
                    className="border rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleProduct(product.productCode)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        {expandedProducts[product.productCode] ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium text-sm">{product.productCode}</span>
                        <span className="text-muted-foreground text-xs truncate max-w-[150px]">
                          {product.productName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {formatCurrency(product.cifPerUnit, 'XCG')}/unit
                        </span>
                        {product.learningAdjustment && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="secondary" className="text-xs">
                                  AI {product.learningAdjustment.factor > 1 ? '+' : ''}
                                  {((product.learningAdjustment.factor - 1) * 100).toFixed(1)}%
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Confidence: {product.learningAdjustment.confidence}%</p>
                                <p>Source: {product.learningAdjustment.source}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </button>

                    {expandedProducts[product.productCode] && (
                      <div className="border-t bg-muted/30 p-3 space-y-3 text-sm">
                        {/* Step 1: Product Cost */}
                        <div className="flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                            1
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">Product Cost</div>
                            <div className="text-muted-foreground text-xs">
                              {product.quantity.toLocaleString()} units × {formatCurrency(product.costPerUnit)} = {formatCurrency(product.totalCost)}
                            </div>
                          </div>
                        </div>

                        {/* Step 2: Freight Share */}
                        <div className="flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                            2
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">Freight Share</div>
                            <div className="text-muted-foreground text-xs space-y-1">
                              <div>
                                {formatPercent(product.weightContribution)} of {formatCurrency(totalFreight)} = {formatCurrency(product.freightShare)}
                              </div>
                              {distributionMethod === 'byWeight' || distributionMethod === 'proportional' ? (
                                <div className="flex items-center gap-1">
                                  <Info className="h-3 w-3" />
                                  Weight contribution: {product.weight.toFixed(1)} kg of {totalWeight.toFixed(1)} kg total
                                </div>
                              ) : distributionMethod === 'byCost' || distributionMethod === 'valueBased' ? (
                                <div className="flex items-center gap-1">
                                  <Info className="h-3 w-3" />
                                  Cost contribution: {formatCurrency(product.totalCost)} of {formatCurrency(totalCost)} total
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Step 3: CIF Calculation */}
                        <div className="flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                            3
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">CIF USD</div>
                            <div className="text-muted-foreground text-xs">
                              {formatCurrency(product.totalCost)} + {formatCurrency(product.freightShare)} = {formatCurrency(product.cifUSD)}
                            </div>
                          </div>
                        </div>

                        {/* Step 4: Currency Conversion */}
                        <div className="flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                            4
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">CIF XCG</div>
                            <div className="text-muted-foreground text-xs">
                              {formatCurrency(product.cifUSD)} × {exchangeRate.toFixed(2)} = {formatCurrency(product.cifXCG, 'XCG')}
                            </div>
                          </div>
                        </div>

                        {/* Step 5: Per Unit */}
                        <div className="flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                            5
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">CIF per Unit</div>
                            <div className="text-muted-foreground text-xs">
                              {formatCurrency(product.cifXCG, 'XCG')} ÷ {product.quantity.toLocaleString()} = {formatCurrency(product.cifPerUnit, 'XCG')}/unit
                            </div>
                          </div>
                        </div>

                        {/* Learning Adjustment */}
                        {product.learningAdjustment && (
                          <div className="flex items-start gap-2">
                            <div className="w-4 h-4 rounded-full bg-warning text-warning-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                              AI
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">Learning Adjustment</div>
                              <div className="text-muted-foreground text-xs">
                                {product.learningAdjustment.factor > 1 ? '+' : ''}
                                {((product.learningAdjustment.factor - 1) * 100).toFixed(1)}% applied ({product.learningAdjustment.confidence}% confidence)
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Margins Summary */}
                        <div className="border-t pt-2 mt-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-xs text-muted-foreground">Wholesale Margin</div>
                              <div className={`font-semibold ${product.wholesaleMargin < 0 ? 'text-destructive' : product.wholesaleMargin < 5 ? 'text-warning' : 'text-success'}`}>
                                {formatCurrency(product.wholesaleMargin, 'XCG')} ({formatPercent((product.wholesaleMargin / product.cifPerUnit) * 100)})
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Retail Margin</div>
                              <div className={`font-semibold ${product.retailMargin < 0 ? 'text-destructive' : product.retailMargin < 10 ? 'text-warning' : 'text-success'}`}>
                                {formatCurrency(product.retailMargin, 'XCG')} ({formatPercent((product.retailMargin / product.cifPerUnit) * 100)})
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
