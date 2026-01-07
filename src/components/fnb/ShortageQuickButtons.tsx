import { Button } from '../ui/button';
import { XCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ShortageQuickButtonsProps {
  onSelect: (reason: string) => void;
  selectedReason?: string;
  disabled?: boolean;
  compact?: boolean;
}

const QUICK_REASONS = [
  { 
    value: 'out_of_stock', 
    label: 'Out of Stock', 
    shortLabel: 'No Stock',
    icon: XCircle,
    color: 'text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950'
  },
  { 
    value: 'quality_issue', 
    label: 'Quality Issue', 
    shortLabel: 'Quality',
    icon: AlertTriangle,
    color: 'text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950'
  },
  { 
    value: 'damaged', 
    label: 'Damaged/Waste', 
    shortLabel: 'Waste',
    icon: Trash2,
    color: 'text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950'
  },
];

export function ShortageQuickButtons({ 
  onSelect, 
  selectedReason, 
  disabled = false,
  compact = false 
}: ShortageQuickButtonsProps) {
  return (
    <div className={cn(
      "flex gap-1.5",
      compact ? "flex-wrap" : "flex-col sm:flex-row"
    )}>
      {QUICK_REASONS.map((reason) => {
        const Icon = reason.icon;
        const isSelected = selectedReason === reason.value;
        
        return (
          <Button
            key={reason.value}
            type="button"
            variant="outline"
            size={compact ? "sm" : "default"}
            className={cn(
              "flex-1 transition-all",
              reason.color,
              isSelected && "ring-2 ring-offset-1",
              compact ? "h-8 px-2 text-xs" : "h-10"
            )}
            onClick={() => onSelect(reason.value)}
            disabled={disabled}
          >
            <Icon className={cn("mr-1", compact ? "h-3 w-3" : "h-4 w-4")} />
            {compact ? reason.shortLabel : reason.label}
          </Button>
        );
      })}
    </div>
  );
}