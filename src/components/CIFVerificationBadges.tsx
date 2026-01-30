import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  TrendingUp,
  Package,
  DollarSign,
  Clock,
  Brain
} from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ValidationResult, MarginIssue } from '@/lib/cifValidator';

interface CIFVerificationBadgesProps {
  validationResult?: ValidationResult;
  freightVerification?: {
    valid: boolean;
    allocatedTotal: number;
    totalFreight: number;
    percentageDifference: number;
  };
  marginIssues?: MarginIssue[];
  stockItemsExcluded?: number;
  exchangeRate?: {
    rate: number;
    lastUpdated?: string;
    ageHours?: number;
  };
  learningApplied?: {
    productsAdjusted: number;
    totalProducts: number;
    avgConfidence?: number;
  };
  showCompact?: boolean;
}

export function CIFVerificationBadges({
  validationResult,
  freightVerification,
  marginIssues,
  stockItemsExcluded,
  exchangeRate,
  learningApplied,
  showCompact = false
}: CIFVerificationBadgesProps) {
  const hasErrors = validationResult && !validationResult.valid;
  const hasWarnings = validationResult && validationResult.warnings.length > 0;
  const hasMarginErrors = marginIssues?.some(m => m.severity === 'error');
  const hasMarginWarnings = marginIssues?.some(m => m.severity === 'warning');

  if (showCompact) {
    return (
      <TooltipProvider>
        <div className="flex flex-wrap gap-1.5">
          {/* Freight Verification */}
          {freightVerification && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant={freightVerification.valid ? 'default' : 'destructive'}
                  className="text-xs gap-1"
                >
                  {freightVerification.valid ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  Freight
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {freightVerification.valid 
                  ? `Freight verified: 100.00% allocated ($${freightVerification.totalFreight.toFixed(2)})`
                  : `Freight mismatch: ${freightVerification.percentageDifference.toFixed(2)}% difference`
                }
              </TooltipContent>
            </Tooltip>
          )}

          {/* Stock Items */}
          {stockItemsExcluded && stockItemsExcluded > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-xs gap-1">
                  <Package className="h-3 w-3" />
                  {stockItemsExcluded} stock
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {stockItemsExcluded} item{stockItemsExcluded > 1 ? 's' : ''} from stock excluded from CIF
              </TooltipContent>
            </Tooltip>
          )}

          {/* Exchange Rate */}
          {exchangeRate && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant={(exchangeRate.ageHours || 0) > 24 ? 'outline' : 'secondary'}
                  className="text-xs gap-1"
                >
                  <DollarSign className="h-3 w-3" />
                  {exchangeRate.rate.toFixed(2)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Exchange rate: {exchangeRate.rate.toFixed(4)}
                {exchangeRate.ageHours !== undefined && (
                  <span className="block text-xs">
                    Updated {exchangeRate.ageHours < 1 
                      ? 'just now' 
                      : `${Math.round(exchangeRate.ageHours)}h ago`}
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Learning Applied */}
          {learningApplied && learningApplied.productsAdjusted > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs gap-1 bg-purple-50 text-purple-700 border-purple-200">
                  <Brain className="h-3 w-3" />
                  {learningApplied.productsAdjusted} adjusted
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Learning patterns applied to {learningApplied.productsAdjusted} of {learningApplied.totalProducts} products
                {learningApplied.avgConfidence && (
                  <span className="block text-xs">
                    Avg confidence: {learningApplied.avgConfidence.toFixed(0)}%
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Validation Issues */}
          {hasErrors && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="text-xs gap-1">
                  <XCircle className="h-3 w-3" />
                  {validationResult.errors.length} error{validationResult.errors.length > 1 ? 's' : ''}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <ul className="list-disc pl-3 space-y-1">
                  {validationResult.errors.slice(0, 5).map((e, i) => (
                    <li key={i} className="text-xs">{e.message}</li>
                  ))}
                  {validationResult.errors.length > 5 && (
                    <li className="text-xs">...and {validationResult.errors.length - 5} more</li>
                  )}
                </ul>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Margin Issues */}
          {hasMarginErrors && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="text-xs gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Negative margin
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <ul className="list-disc pl-3 space-y-1">
                  {marginIssues?.filter(m => m.severity === 'error').slice(0, 5).map((m, i) => (
                    <li key={i} className="text-xs">
                      {m.productCode}: {m.type.replace(/_/g, ' ')} ({m.margin.toFixed(1)}%)
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // Full display mode
  return (
    <div className="space-y-3">
      {/* Status Badges */}
      <div className="flex flex-wrap gap-2">
        {/* Freight Verification */}
        {freightVerification && (
          <Badge 
            variant={freightVerification.valid ? 'default' : 'destructive'}
            className="gap-1.5"
          >
            {freightVerification.valid ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            Freight Verified: {freightVerification.valid 
              ? '100.00%' 
              : `${(100 - freightVerification.percentageDifference).toFixed(2)}%`} allocated
          </Badge>
        )}

        {/* Stock Items */}
        {stockItemsExcluded && stockItemsExcluded > 0 && (
          <Badge variant="secondary" className="gap-1.5 bg-amber-50 text-amber-700 border-amber-200">
            <Package className="h-3.5 w-3.5" />
            {stockItemsExcluded} item{stockItemsExcluded > 1 ? 's' : ''} from stock excluded
          </Badge>
        )}

        {/* Exchange Rate */}
        {exchangeRate && (
          <Badge 
            variant={(exchangeRate.ageHours || 0) > 24 ? 'outline' : 'secondary'}
            className="gap-1.5"
          >
            <DollarSign className="h-3.5 w-3.5" />
            Exchange Rate: {exchangeRate.rate.toFixed(2)}
            {exchangeRate.ageHours !== undefined && (
              <span className="text-muted-foreground ml-1">
                ({exchangeRate.ageHours < 1 
                  ? 'current' 
                  : `${Math.round(exchangeRate.ageHours)}h ago`})
              </span>
            )}
          </Badge>
        )}

        {/* Learning Applied */}
        {learningApplied && learningApplied.productsAdjusted > 0 && (
          <Badge variant="outline" className="gap-1.5 bg-purple-50 text-purple-700 border-purple-200">
            <Brain className="h-3.5 w-3.5" />
            Learning Applied: {learningApplied.productsAdjusted} products adjusted
            {learningApplied.avgConfidence && (
              <span className="text-purple-500">
                ({learningApplied.avgConfidence.toFixed(0)}% confidence)
              </span>
            )}
          </Badge>
        )}
      </div>

      {/* Validation Errors Alert */}
      {hasErrors && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{validationResult.errors.length} validation error{validationResult.errors.length > 1 ? 's' : ''}:</strong>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              {validationResult.errors.slice(0, 5).map((e, i) => (
                <li key={i} className="text-sm">{e.message}</li>
              ))}
              {validationResult.errors.length > 5 && (
                <li className="text-sm text-muted-foreground">
                  ...and {validationResult.errors.length - 5} more errors
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Validation Warnings Alert */}
      {hasWarnings && !hasErrors && (
        <Alert>
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription>
            <strong>{validationResult.warnings.length} warning{validationResult.warnings.length > 1 ? 's' : ''}:</strong>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              {validationResult.warnings.slice(0, 3).map((w, i) => (
                <li key={i} className="text-sm">{w.message}</li>
              ))}
              {validationResult.warnings.length > 3 && (
                <li className="text-sm text-muted-foreground">
                  ...and {validationResult.warnings.length - 3} more warnings
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Margin Issues Alert */}
      {hasMarginErrors && (
        <Alert variant="destructive">
          <TrendingUp className="h-4 w-4" />
          <AlertDescription>
            <strong>Negative margins detected!</strong> The following products are selling below cost:
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              {marginIssues?.filter(m => m.severity === 'error').map((m, i) => (
                <li key={i} className="text-sm">
                  {m.productName} ({m.productCode}): {m.margin.toFixed(1)}% {m.type.replace(/_/g, ' ')}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {hasMarginWarnings && !hasMarginErrors && (
        <Alert>
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription>
            <strong>Low margins on some products:</strong>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              {marginIssues?.filter(m => m.severity === 'warning').slice(0, 3).map((m, i) => (
                <li key={i} className="text-sm">
                  {m.productName}: {m.margin.toFixed(1)}% (target: {m.target}%)
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
