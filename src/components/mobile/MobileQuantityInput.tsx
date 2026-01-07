import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';

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
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setInputValue(value.toString());
    }
  }, [value, isEditing]);

  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    onChange(Number(newValue.toFixed(2)));
  };

  const handleIncrement = () => {
    const newValue = Math.min(max, value + step);
    onChange(Number(newValue.toFixed(2)));
  };

  const handleTapToEdit = () => {
    setInputValue(value.toString());
    setIsEditing(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    commitValue();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitValue();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setInputValue(value.toString());
    }
  };

  const commitValue = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(Number(clamped.toFixed(2)));
    }
    setIsEditing(false);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-full shrink-0 touch-manipulation"
        onClick={handleDecrement}
        disabled={value <= min}
      >
        <Minus className="h-4 w-4" />
      </Button>
      
      <div className="flex items-center justify-center gap-1.5 min-w-0">
        {isEditing ? (
          <Input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            className="h-10 text-xl font-semibold text-center tabular-nums w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            min={min}
            max={max}
            step={step}
          />
        ) : (
          <button
            type="button"
            onClick={handleTapToEdit}
            className="text-xl font-semibold tabular-nums min-w-[3ch] text-center py-2 px-2 rounded-md hover:bg-muted/50 active:bg-muted transition-colors touch-manipulation"
          >
            {value}
          </button>
        )}
        {unit && (
          <span className="text-sm text-muted-foreground">{unit}</span>
        )}
      </div>
      
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-full shrink-0 touch-manipulation"
        onClick={handleIncrement}
        disabled={value >= max}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
