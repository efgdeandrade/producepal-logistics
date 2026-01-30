import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FilterType } from '@/hooks/useDreInbox';

interface DreFilterChipsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  unreadCount: number;
  pendingOrderCount: number;
  escalatedCount: number;
}

const filters: { id: FilterType; label: string; countKey?: keyof DreFilterChipsProps }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread', countKey: 'unreadCount' },
  { id: 'pending_order', label: 'Pending Orders', countKey: 'pendingOrderCount' },
  { id: 'escalated', label: 'Escalated', countKey: 'escalatedCount' },
  { id: 'today_orders', label: "Today's Orders" },
];

export function DreFilterChips({ 
  activeFilter, 
  onFilterChange,
  unreadCount,
  pendingOrderCount,
  escalatedCount
}: DreFilterChipsProps) {
  const getCounts = (filter: typeof filters[0]) => {
    switch (filter.id) {
      case 'unread': return unreadCount;
      case 'pending_order': return pendingOrderCount;
      case 'escalated': return escalatedCount;
      default: return null;
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const count = getCounts(filter);
        const isActive = activeFilter === filter.id;
        
        return (
          <Button
            key={filter.id}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              'h-8 px-3 rounded-full transition-all',
              isActive && 'shadow-md',
              filter.id === 'escalated' && count && count > 0 && !isActive && 'border-destructive text-destructive'
            )}
          >
            {filter.label}
            {count !== null && count > 0 && (
              <span className={cn(
                'ml-1.5 px-1.5 py-0.5 text-xs rounded-full',
                isActive 
                  ? 'bg-primary-foreground/20 text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              )}>
                {count}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
