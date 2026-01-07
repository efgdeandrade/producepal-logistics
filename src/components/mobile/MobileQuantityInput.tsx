import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileQuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
}

export function MobileQuantityInput({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  unit,
  className
}: MobileQuantityInputProps) {
  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    onChange(Number(newValue.toFixed(2)));
  };

  const handleIncrement = () => {
    const newValue = Math.min(max, value + step);
    onChange(Number(newValue.toFixed(2)));
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-12 w-12 rounded-full shrink-0 touch-manipulation"
        onClick={handleDecrement}
        disabled={value <= min}
      >
        <Minus className="h-5 w-5" />
      </Button>
      
      <div className="flex-1 flex items-center justify-center gap-2">
        <span className="text-2xl font-semibold tabular-nums min-w-[3ch] text-center">
          {value}
        </span>
        {unit && (
          <span className="text-base text-muted-foreground">{unit}</span>
        )}
      </div>
      
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-12 w-12 rounded-full shrink-0 touch-manipulation"
        onClick={handleIncrement}
        disabled={value >= max}
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  );
}
