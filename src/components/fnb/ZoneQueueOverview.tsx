import { MapPin, Clock, Package, Users } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

interface ZoneStats {
  zone_name: string;
  total_orders: number;
  queued_orders: number;
  in_progress_orders: number;
  completed_orders: number;
  avg_wait_minutes: number;
}

interface ZoneQueueOverviewProps {
  zones: ZoneStats[];
  onZoneClick?: (zoneName: string) => void;
}

const ZONE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'Willemstad': { bg: 'bg-blue-500/10', border: 'border-blue-500', text: 'text-blue-600' },
  'Otrobanda': { bg: 'bg-green-500/10', border: 'border-green-500', text: 'text-green-600' },
  'Punda': { bg: 'bg-purple-500/10', border: 'border-purple-500', text: 'text-purple-600' },
  'Pietermaai': { bg: 'bg-amber-500/10', border: 'border-amber-500', text: 'text-amber-600' },
  'Scharloo': { bg: 'bg-pink-500/10', border: 'border-pink-500', text: 'text-pink-600' },
  'Banda Abou': { bg: 'bg-cyan-500/10', border: 'border-cyan-500', text: 'text-cyan-600' },
  'Pickup': { bg: 'bg-slate-500/10', border: 'border-slate-500', text: 'text-slate-600' },
};

const DEFAULT_COLOR = { bg: 'bg-gray-500/10', border: 'border-gray-500', text: 'text-gray-600' };

export function ZoneQueueOverview({ zones, onZoneClick }: ZoneQueueOverviewProps) {
  if (zones.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No orders in queue</p>
      </div>
    );
  }

  // Sort by queued orders descending
  const sortedZones = [...zones].sort((a, b) => b.queued_orders - a.queued_orders);

  return (
    <div className="grid gap-3">
      {sortedZones.map((zone) => {
        const colors = ZONE_COLORS[zone.zone_name] || DEFAULT_COLOR;
        const isUrgent = zone.avg_wait_minutes > 10;
        
        return (
          <button
            key={zone.zone_name}
            onClick={() => onZoneClick?.(zone.zone_name)}
            className={cn(
              'p-4 rounded-xl border-2 text-left transition-all hover:shadow-md',
              colors.bg,
              colors.border,
              isUrgent && 'animate-pulse'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className={cn('h-5 w-5', colors.text)} />
                <span className="font-bold text-lg">{zone.zone_name}</span>
              </div>
              {isUrgent && (
                <Badge variant="destructive" className="animate-bounce">
                  Long Wait!
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-4 gap-3 text-center">
              {/* Queued */}
              <div className="p-2 rounded-lg bg-background/50">
                <div className="text-2xl font-bold text-foreground">
                  {zone.queued_orders}
                </div>
                <div className="text-xs text-muted-foreground">Queued</div>
              </div>

              {/* In Progress */}
              <div className="p-2 rounded-lg bg-background/50">
                <div className="text-2xl font-bold text-blue-500">
                  {zone.in_progress_orders}
                </div>
                <div className="text-xs text-muted-foreground">Picking</div>
              </div>

              {/* Completed */}
              <div className="p-2 rounded-lg bg-background/50">
                <div className="text-2xl font-bold text-green-500">
                  {zone.completed_orders}
                </div>
                <div className="text-xs text-muted-foreground">Done</div>
              </div>

              {/* Avg Wait */}
              <div className="p-2 rounded-lg bg-background/50">
                <div className={cn(
                  'text-2xl font-bold',
                  zone.avg_wait_minutes < 5 ? 'text-green-500' :
                  zone.avg_wait_minutes < 10 ? 'text-amber-500' : 'text-red-500'
                )}>
                  {zone.avg_wait_minutes.toFixed(0)}
                </div>
                <div className="text-xs text-muted-foreground">Min Wait</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
