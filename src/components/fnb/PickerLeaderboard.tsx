import { Trophy, Medal, Clock, Package, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PickerStats {
  picker_name: string;
  orders_completed: number;
  avg_pick_time_minutes: number;
  items_picked: number;
  is_active: boolean;
}

interface PickerLeaderboardProps {
  stats: PickerStats[];
  currentPickerName?: string;
}

export function PickerLeaderboard({ stats, currentPickerName }: PickerLeaderboardProps) {
  // Sort by orders completed descending
  const sorted = [...stats].sort((a, b) => b.orders_completed - a.orders_completed);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-5 w-5 text-amber-500" />;
      case 1:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 2:
        return <Medal className="h-5 w-5 text-amber-700" />;
      default:
        return <span className="w-5 text-center font-bold text-muted-foreground">{index + 1}</span>;
    }
  };

  if (stats.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No picker activity today yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((picker, index) => (
        <div
          key={picker.picker_name}
          className={cn(
            'flex items-center gap-4 p-4 rounded-xl border transition-all',
            picker.picker_name === currentPickerName
              ? 'bg-primary/10 border-primary'
              : 'bg-card border-border',
            picker.is_active && 'ring-2 ring-green-500 ring-offset-2'
          )}
        >
          {/* Rank */}
          <div className="shrink-0 w-8 flex justify-center">
            {getRankIcon(index)}
          </div>

          {/* Name & Status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold truncate">{picker.picker_name}</span>
              {picker.is_active && (
                <span className="shrink-0 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
              {picker.picker_name === currentPickerName && (
                <span className="text-xs text-primary font-medium">(You)</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-muted-foreground" title="Orders completed">
              <Package className="h-4 w-4" />
              <span className="font-bold text-foreground">{picker.orders_completed}</span>
            </div>
            
            <div className="flex items-center gap-1 text-muted-foreground" title="Avg. pick time">
              <Clock className="h-4 w-4" />
              <span className="font-medium">{picker.avg_pick_time_minutes.toFixed(0)}m</span>
            </div>
            
            <div className="flex items-center gap-1 text-muted-foreground" title="Items picked">
              <TrendingUp className="h-4 w-4" />
              <span className="font-medium">{picker.items_picked}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
