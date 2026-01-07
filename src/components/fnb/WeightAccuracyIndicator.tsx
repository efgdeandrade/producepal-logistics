import { useMemo } from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface WeightAccuracyIndicatorProps {
  expectedWeight: number;
  actualWeight: number;
  unit?: string;
  size?: 'sm' | 'md';
}

export function WeightAccuracyIndicator({
  expectedWeight,
  actualWeight,
  unit = 'kg',
  size = 'md',
}: WeightAccuracyIndicatorProps) {
  const { variance, variancePercent, status, color, bgColor, borderColor } = useMemo(() => {
    if (expectedWeight === 0) {
      return {
        variance: actualWeight,
        variancePercent: 0,
        status: 'neutral' as const,
        color: 'text-muted-foreground',
        bgColor: 'bg-muted',
        borderColor: 'border-muted',
      };
    }

    const diff = actualWeight - expectedWeight;
    const percent = Math.abs((diff / expectedWeight) * 100);

    // Determine status based on variance percentage
    let status: 'perfect' | 'acceptable' | 'warning' | 'over' | 'short';
    let color: string;
    let bgColor: string;
    let borderColor: string;

    if (percent <= 2) {
      status = 'perfect';
      color = 'text-green-600 dark:text-green-400';
      bgColor = 'bg-green-50 dark:bg-green-950';
      borderColor = 'border-green-400';
    } else if (percent <= 5) {
      status = 'acceptable';
      color = 'text-green-600 dark:text-green-400';
      bgColor = 'bg-green-50 dark:bg-green-950';
      borderColor = 'border-green-400';
    } else if (percent <= 10) {
      status = diff > 0 ? 'over' : 'short';
      color = 'text-amber-600 dark:text-amber-400';
      bgColor = 'bg-amber-50 dark:bg-amber-950';
      borderColor = 'border-amber-400';
    } else {
      status = diff > 0 ? 'over' : 'short';
      color = 'text-orange-600 dark:text-orange-400';
      bgColor = 'bg-orange-50 dark:bg-orange-950';
      borderColor = 'border-orange-400';
    }

    return {
      variance: diff,
      variancePercent: percent,
      status,
      color,
      bgColor,
      borderColor,
    };
  }, [expectedWeight, actualWeight]);

  const ringSize = size === 'sm' ? 36 : 44;
  const strokeWidth = size === 'sm' ? 3 : 4;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Progress based on how close to expected (100% = perfect match)
  // Clamp between 0-100%
  const accuracy = expectedWeight > 0 
    ? Math.max(0, Math.min(100, 100 - variancePercent))
    : 100;
  const offset = circumference - (accuracy / 100) * circumference;

  const getStrokeColor = () => {
    if (accuracy >= 95) return '#22c55e'; // green-500
    if (accuracy >= 90) return '#84cc16'; // lime-500
    if (accuracy >= 80) return '#eab308'; // yellow-500
    return '#f97316'; // orange-500
  };

  if (expectedWeight === 0) return null;

  return (
    <div className={cn(
      'flex items-center gap-2 px-2 py-1 rounded-lg border',
      bgColor,
      borderColor,
    )}>
      {/* Mini Ring */}
      <div className="relative" style={{ width: ringSize, height: ringSize }}>
        <svg
          width={ringSize}
          height={ringSize}
          className="-rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          {/* Progress circle */}
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke={getStrokeColor()}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-300"
          />
        </svg>
        {/* Center icon or percentage */}
        <div className="absolute inset-0 flex items-center justify-center">
          {status === 'perfect' ? (
            <CheckCircle className={cn('h-4 w-4', color)} />
          ) : (
            <span className={cn('text-xs font-bold', color)}>
              {Math.round(accuracy)}%
            </span>
          )}
        </div>
      </div>

      {/* Variance info */}
      <div className="flex flex-col">
        <span className={cn('text-xs font-medium flex items-center gap-1', color)}>
          {variance > 0 ? (
            <>
              <TrendingUp className="h-3 w-3" />
              +{variance.toFixed(2)} {unit}
            </>
          ) : variance < 0 ? (
            <>
              <TrendingDown className="h-3 w-3" />
              {variance.toFixed(2)} {unit}
            </>
          ) : (
            <>
              <CheckCircle className="h-3 w-3" />
              Exact
            </>
          )}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {status === 'perfect' && 'Perfect!'}
          {status === 'acceptable' && 'Acceptable'}
          {status === 'over' && 'Over-picked'}
          {status === 'short' && 'Under-picked'}
        </span>
      </div>
    </div>
  );
}
