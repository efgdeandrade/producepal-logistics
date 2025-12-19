import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Scale, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeightVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectedWeight: number;
  onVerify: (verifiedWeight: number) => void;
  isLoading?: boolean;
}

const VARIANCE_THRESHOLD = 0.1; // 10% variance threshold

export function WeightVerificationDialog({
  open,
  onOpenChange,
  expectedWeight,
  onVerify,
  isLoading,
}: WeightVerificationDialogProps) {
  const [weight, setWeight] = useState('');

  const numericWeight = parseFloat(weight) || 0;
  const variance = expectedWeight > 0 
    ? Math.abs(numericWeight - expectedWeight) / expectedWeight 
    : 0;
  const hasVariance = variance > VARIANCE_THRESHOLD;
  const isValid = numericWeight > 0;

  const handleVerify = () => {
    if (isValid) {
      onVerify(numericWeight);
      setWeight('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Verify Order Weight
          </DialogTitle>
          <DialogDescription>
            Weigh the complete order and enter the total weight in kilograms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Expected Weight */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Expected Weight</div>
            <div className="text-2xl font-bold">{expectedWeight.toFixed(2)} kg</div>
          </div>

          {/* Weight Input */}
          <div className="space-y-2">
            <Label htmlFor="verified-weight">Actual Weight (kg)</Label>
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

          {/* Variance Warning */}
          {isValid && hasVariance && (
            <div className={cn(
              'p-4 rounded-lg flex items-start gap-3',
              'bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800'
            )}>
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-amber-800 dark:text-amber-200">
                  Weight Variance Detected
                </div>
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  Difference: {(variance * 100).toFixed(1)}% ({(numericWeight - expectedWeight).toFixed(2)} kg)
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Please double-check the order contents before proceeding.
                </div>
              </div>
            </div>
          )}

          {/* Match indicator */}
          {isValid && !hasVariance && (
            <div className="p-4 rounded-lg flex items-center gap-3 bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-800 dark:text-green-200">
                Weight matches expected range
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setWeight('');
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            disabled={!isValid || isLoading}
            className={cn(
              hasVariance && 'bg-amber-600 hover:bg-amber-700'
            )}
          >
            {isLoading ? 'Verifying...' : hasVariance ? 'Complete Anyway' : 'Complete Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
