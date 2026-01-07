import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Scale, AlertTriangle, CheckCircle, XCircle, Package } from 'lucide-react';
import { cn } from '../../lib/utils';

interface OrderItem {
  id: string;
  productName: string;
  productCode: string;
  quantity: number;
  pickedQuantity: number;
  expectedWeight: number;
  isWeightBased: boolean;
  weightUnit?: string;
}

interface WeightVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectedWeight: number;
  orderItems?: OrderItem[];
  onVerify: (verifiedWeight: number) => void;
  isLoading?: boolean;
}

const VARIANCE_THRESHOLD = 0.10; // 10% variance threshold

export function WeightVerificationDialog({
  open,
  onOpenChange,
  expectedWeight,
  orderItems = [],
  onVerify,
  isLoading,
}: WeightVerificationDialogProps) {
  const [weight, setWeight] = useState('');
  const [showItemBreakdown, setShowItemBreakdown] = useState(false);

  const numericWeight = parseFloat(weight) || 0;
  
  // Calculate variance
  const variance = expectedWeight > 0 
    ? (numericWeight - expectedWeight) / expectedWeight 
    : 0;
  const absVariance = Math.abs(variance);
  const hasVariance = absVariance > VARIANCE_THRESHOLD;
  const isValid = numericWeight > 0;
  
  // Determine status
  const status = useMemo(() => {
    if (!isValid) return 'pending';
    if (absVariance <= 0.05) return 'perfect'; // Within 5%
    if (absVariance <= VARIANCE_THRESHOLD) return 'acceptable'; // Within 10%
    return 'warning'; // Over 10%
  }, [isValid, absVariance]);

  // Calculate progress ring values
  const progressPercentage = expectedWeight > 0 
    ? Math.min((numericWeight / expectedWeight) * 100, 150) 
    : 0;
  
  const ringColor = {
    pending: 'stroke-muted-foreground',
    perfect: 'stroke-green-500',
    acceptable: 'stroke-emerald-400',
    warning: 'stroke-amber-500',
  }[status];

  const handleVerify = () => {
    if (isValid) {
      onVerify(numericWeight);
      setWeight('');
      setShowItemBreakdown(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setWeight('');
    setShowItemBreakdown(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Weight Verification
          </DialogTitle>
          <DialogDescription>
            Weigh the complete order and verify against expected weight.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Weight Comparison Visualization */}
          <div className="flex items-center justify-center gap-6">
            {/* Progress Ring */}
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted/20"
                />
                {/* Progress circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(progressPercentage / 100) * 352} 352`}
                  className={cn('transition-all duration-500', ringColor)}
                />
              </svg>
              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {status === 'pending' ? (
                  <Scale className="h-8 w-8 text-muted-foreground" />
                ) : status === 'perfect' || status === 'acceptable' ? (
                  <CheckCircle className="h-8 w-8 text-green-500" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                )}
                <span className="text-xs text-muted-foreground mt-1">
                  {isValid ? `${Math.round(progressPercentage)}%` : 'Enter weight'}
                </span>
              </div>
            </div>

            {/* Weight Stats */}
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Expected</div>
                <div className="text-2xl font-bold">{expectedWeight.toFixed(2)} kg</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Actual</div>
                <div className={cn(
                  'text-2xl font-bold',
                  status === 'perfect' && 'text-green-600 dark:text-green-400',
                  status === 'acceptable' && 'text-emerald-600 dark:text-emerald-400',
                  status === 'warning' && 'text-amber-600 dark:text-amber-400',
                )}>
                  {isValid ? `${numericWeight.toFixed(2)} kg` : '-- kg'}
                </div>
              </div>
              {isValid && (
                <div>
                  <Badge 
                    variant={status === 'warning' ? 'destructive' : 'secondary'}
                    className={cn(
                      status === 'perfect' && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                      status === 'acceptable' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
                    )}
                  >
                    {variance > 0 ? '+' : ''}{(variance * 100).toFixed(1)}%
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Weight Input */}
          <div className="space-y-2">
            <Label htmlFor="verified-weight">Enter Actual Weight (kg)</Label>
            <Input
              id="verified-weight"
              type="number"
              step="0.01"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0.00"
              className="h-14 text-2xl text-center font-bold"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValid) handleVerify();
              }}
            />
          </div>

          {/* Status Messages */}
          {isValid && (
            <div className={cn(
              'p-3 rounded-lg flex items-start gap-3',
              status === 'perfect' && 'bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800',
              status === 'acceptable' && 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800',
              status === 'warning' && 'bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800',
            )}>
              {status === 'perfect' ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                  <div>
                    <div className="font-medium text-green-800 dark:text-green-200">Perfect Match!</div>
                    <div className="text-sm text-green-700 dark:text-green-300">
                      Weight is within 5% of expected.
                    </div>
                  </div>
                </>
              ) : status === 'acceptable' ? (
                <>
                  <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-medium text-emerald-800 dark:text-emerald-200">Acceptable</div>
                    <div className="text-sm text-emerald-700 dark:text-emerald-300">
                      Weight is within tolerance ({(VARIANCE_THRESHOLD * 100).toFixed(0)}%).
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-amber-800 dark:text-amber-200">
                      Weight Variance Detected
                    </div>
                    <div className="text-sm text-amber-700 dark:text-amber-300">
                      Difference: {(numericWeight - expectedWeight).toFixed(2)} kg ({variance > 0 ? '+' : ''}{(variance * 100).toFixed(1)}%)
                    </div>
                    <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Please verify all items are included before proceeding.
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Item Breakdown Toggle */}
          {orderItems.length > 0 && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => setShowItemBreakdown(!showItemBreakdown)}
              >
                <Package className="h-4 w-4 mr-2" />
                {showItemBreakdown ? 'Hide' : 'Show'} Item Breakdown ({orderItems.length} items)
              </Button>

              {showItemBreakdown && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border divide-y">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.productName}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.pickedQuantity} × {item.isWeightBased ? `${item.weightUnit || 'kg'}` : 'units'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{item.expectedWeight.toFixed(2)} kg</div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/50 font-medium">
                    <span>Total</span>
                    <span>{expectedWeight.toFixed(2)} kg</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            disabled={!isValid || isLoading}
            className={cn(
              status === 'warning' && 'bg-amber-600 hover:bg-amber-700'
            )}
          >
            {isLoading ? 'Completing...' : (
              status === 'warning' ? 'Complete Anyway' : 'Complete Order'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
