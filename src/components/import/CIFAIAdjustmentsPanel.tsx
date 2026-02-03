import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Brain, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Check,
  X,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { useCIFLearning, type LearningAdjustment, type CategorizedPatterns, type LearningEngineSummary } from '@/hooks/useCIFLearning';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CIFAIAdjustmentsPanelProps {
  orderId?: string;
  productCodes?: string[];
  onAdjustmentApplied?: () => void;
}

export function CIFAIAdjustmentsPanel({ orderId, productCodes, onAdjustmentApplied }: CIFAIAdjustmentsPanelProps) {
  const { 
    loading, 
    categorizedPatterns, 
    summary, 
    triggerLearning, 
    applyAdjustment, 
    dismissAdjustment,
    fetchPatterns
  } = useCIFLearning();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [applyingProduct, setApplyingProduct] = useState<string | null>(null);
  const [localPatterns, setLocalPatterns] = useState<CategorizedPatterns>({
    autoApply: [],
    suggested: [],
    insufficientData: [],
  });
  const [localSummary, setLocalSummary] = useState<LearningEngineSummary | null>(null);

  // Fetch patterns on mount or when product codes change
  useEffect(() => {
    if (productCodes?.length) {
      fetchPatterns(productCodes);
    }
  }, [productCodes, fetchPatterns]);

  // Sync local state with hook state
  useEffect(() => {
    setLocalPatterns(categorizedPatterns);
  }, [categorizedPatterns]);

  useEffect(() => {
    setLocalSummary(summary);
  }, [summary]);

  const handleRefreshLearning = async () => {
    setIsRefreshing(true);
    const result = await triggerLearning();
    setIsRefreshing(false);
    
    if (result.success) {
      toast.success('Learning engine updated');
      if (result.categorized) {
        setLocalPatterns(result.categorized);
      }
      if (result.summary) {
        setLocalSummary(result.summary);
      }
    } else {
      toast.error('Failed to refresh learning data');
    }
  };

  const handleApplyAdjustment = async (productCode: string) => {
    setApplyingProduct(productCode);
    const success = await applyAdjustment(productCode);
    setApplyingProduct(null);
    
    if (success) {
      toast.success(`Adjustment for ${productCode} will now auto-apply`);
      onAdjustmentApplied?.();
    } else {
      toast.error('Failed to apply adjustment');
    }
  };

  const handleDismissAdjustment = async (productCode: string) => {
    setApplyingProduct(productCode);
    const success = await dismissAdjustment(productCode);
    setApplyingProduct(null);
    
    if (success) {
      toast.info(`Adjustment for ${productCode} dismissed`);
    } else {
      toast.error('Failed to dismiss adjustment');
    }
  };

  const formatAdjustment = (factor: number) => {
    const percentage = (factor - 1) * 100;
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${percentage.toFixed(1)}%`;
  };

  const getAdjustmentIcon = (factor: number) => {
    if (factor > 1) return <ArrowUp className="h-3 w-3 text-amber-500" />;
    if (factor < 1) return <ArrowDown className="h-3 w-3 text-emerald-500" />;
    return null;
  };

  const totalPatterns = 
    localPatterns.autoApply.length + 
    localPatterns.suggested.length + 
    localPatterns.insufficientData.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">AI Learning Adjustments</CardTitle>
              <CardDescription className="text-xs">
                Confidence-based estimate corrections
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefreshLearning}
            disabled={isRefreshing || loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        {localSummary && (
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-lg font-bold text-emerald-600">
                {localSummary.autoApplyCount}
              </div>
              <div className="text-[10px] text-muted-foreground">Auto-Apply</div>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="text-lg font-bold text-amber-600">
                {localSummary.suggestedCount}
              </div>
              <div className="text-[10px] text-muted-foreground">Suggested</div>
            </div>
            <div className="p-2 rounded-lg bg-muted">
              <div className="text-lg font-bold text-muted-foreground">
                {localSummary.insufficientDataCount}
              </div>
              <div className="text-[10px] text-muted-foreground">Needs Data</div>
            </div>
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <div className="text-lg font-bold text-rose-600">
                {localSummary.anomaliesDetected}
              </div>
              <div className="text-[10px] text-muted-foreground">Anomalies</div>
            </div>
          </div>
        )}

        {/* Auto-Applied Adjustments */}
        {localPatterns.autoApply.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Auto-Applied ({localPatterns.autoApply.length})</span>
              <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700">
                Confidence &gt;70%
              </Badge>
            </div>
            <div className="space-y-1">
              {localPatterns.autoApply.map(pattern => (
                <AdjustmentRow 
                  key={pattern.productCode}
                  pattern={pattern}
                  tier="auto_apply"
                  formatAdjustment={formatAdjustment}
                  getAdjustmentIcon={getAdjustmentIcon}
                />
              ))}
            </div>
          </div>
        )}

        {/* Suggested Adjustments */}
        {localPatterns.suggested.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span>Suggested ({localPatterns.suggested.length})</span>
                <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-700">
                  Confidence 50-70%
                </Badge>
              </div>
              <div className="space-y-2">
                {localPatterns.suggested.map(pattern => (
                  <SuggestedAdjustmentRow 
                    key={pattern.productCode}
                    pattern={pattern}
                    formatAdjustment={formatAdjustment}
                    getAdjustmentIcon={getAdjustmentIcon}
                    onApply={() => handleApplyAdjustment(pattern.productCode)}
                    onDismiss={() => handleDismissAdjustment(pattern.productCode)}
                    isLoading={applyingProduct === pattern.productCode}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Insufficient Data */}
        {localPatterns.insufficientData.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <HelpCircle className="h-4 w-4" />
                <span>Needs More Data ({localPatterns.insufficientData.length})</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {localPatterns.insufficientData.map(pattern => (
                  <Badge 
                    key={pattern.productCode} 
                    variant="outline" 
                    className="text-[10px] text-muted-foreground"
                  >
                    {pattern.productCode} ({pattern.sampleSize} samples)
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {totalPatterns === 0 && !loading && (
          <div className="text-center py-6 text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No learning patterns yet</p>
            <p className="text-xs">Enter actual costs to start building patterns</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-6">
            <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading patterns...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Sub-component for auto-applied adjustments
function AdjustmentRow({ 
  pattern, 
  tier,
  formatAdjustment, 
  getAdjustmentIcon 
}: { 
  pattern: LearningAdjustment;
  tier: string;
  formatAdjustment: (f: number) => string;
  getAdjustmentIcon: (f: number) => React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs">{pattern.productCode}</span>
        <div className="flex items-center gap-1">
          {getAdjustmentIcon(pattern.adjustmentFactor)}
          <span className={cn(
            "font-medium text-xs",
            pattern.adjustmentFactor > 1 ? "text-amber-600" : "text-emerald-600"
          )}>
            {formatAdjustment(pattern.adjustmentFactor)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Progress 
            value={pattern.confidence} 
            className="w-12 h-1.5" 
          />
          <span className="text-[10px] text-muted-foreground">
            {pattern.confidence.toFixed(0)}%
          </span>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {pattern.sampleSize} samples
        </Badge>
      </div>
    </div>
  );
}

// Sub-component for suggested adjustments with action buttons
function SuggestedAdjustmentRow({ 
  pattern, 
  formatAdjustment, 
  getAdjustmentIcon,
  onApply,
  onDismiss,
  isLoading
}: { 
  pattern: LearningAdjustment;
  formatAdjustment: (f: number) => string;
  getAdjustmentIcon: (f: number) => React.ReactNode;
  onApply: () => void;
  onDismiss: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="p-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">{pattern.productCode}</span>
          <div className="flex items-center gap-1">
            {getAdjustmentIcon(pattern.adjustmentFactor)}
            <span className={cn(
              "font-medium text-xs",
              pattern.adjustmentFactor > 1 ? "text-amber-600" : "text-emerald-600"
            )}>
              {formatAdjustment(pattern.adjustmentFactor)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Progress 
            value={pattern.confidence} 
            className="w-12 h-1.5" 
          />
          <span className="text-[10px] text-muted-foreground">
            {pattern.confidence.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-muted-foreground">
          Based on {pattern.sampleSize} historical orders
          {pattern.avgVariance && (
            <span className="ml-1">
              (avg variance: {pattern.avgVariance > 0 ? '+' : ''}{pattern.avgVariance.toFixed(1)}%)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-100"
            onClick={onDismiss}
            disabled={isLoading}
          >
            <X className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
            onClick={onApply}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Check className="h-3 w-3 mr-1" />
                Apply
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
