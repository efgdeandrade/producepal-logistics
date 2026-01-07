import { useState, useEffect } from 'react';
import { User, Package, Timer, Activity, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivePicker {
  id: string;
  picker_name: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  pick_start_time: string;
  items_count: number;
  items_picked: number;
}

interface LivePickerStatusCardsProps {
  activePickers: ActivePicker[];
  idlePickers?: string[];
}

function formatElapsedTime(startTime: string): string {
  const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getTimeStatus(startTime: string): 'fast' | 'normal' | 'slow' {
  const minutes = (Date.now() - new Date(startTime).getTime()) / 60000;
  if (minutes < 3) return 'fast';
  if (minutes < 7) return 'normal';
  return 'slow';
}

export function LivePickerStatusCards({ activePickers, idlePickers = [] }: LivePickerStatusCardsProps) {
  const [, forceUpdate] = useState(0);

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (activePickers.length === 0 && idlePickers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No active pickers right now</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active Pickers */}
      {activePickers.length > 0 && (
        <div className="grid gap-3">
          {activePickers.map((picker) => {
            const timeStatus = getTimeStatus(picker.pick_start_time);
            const progress = picker.items_count > 0 
              ? Math.round((picker.items_picked / picker.items_count) * 100)
              : 0;

            return (
              <div
                key={picker.id}
                className={cn(
                  'p-4 rounded-xl border-2 bg-card transition-all',
                  timeStatus === 'fast' && 'border-green-500 bg-green-500/5',
                  timeStatus === 'normal' && 'border-blue-500 bg-blue-500/5',
                  timeStatus === 'slow' && 'border-amber-500 bg-amber-500/5 animate-pulse'
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      timeStatus === 'fast' && 'bg-green-500 text-white',
                      timeStatus === 'normal' && 'bg-blue-500 text-white',
                      timeStatus === 'slow' && 'bg-amber-500 text-white'
                    )}>
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-lg">{picker.picker_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Order #{picker.order_number}
                      </p>
                    </div>
                  </div>
                  
                  <div className={cn(
                    'flex items-center gap-1 px-3 py-1.5 rounded-full font-mono text-lg font-bold',
                    timeStatus === 'fast' && 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                    timeStatus === 'normal' && 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
                    timeStatus === 'slow' && 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                  )}>
                    <Timer className="h-4 w-4" />
                    {formatElapsedTime(picker.pick_start_time)}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">{picker.customer_name}</span>
                  <span className="font-medium">
                    {picker.items_picked}/{picker.items_count} items
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      'h-full transition-all duration-300',
                      timeStatus === 'fast' && 'bg-green-500',
                      timeStatus === 'normal' && 'bg-blue-500',
                      timeStatus === 'slow' && 'bg-amber-500'
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Idle Pickers */}
      {idlePickers.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
            <Pause className="h-3 w-3" /> Idle Pickers
          </p>
          <div className="flex flex-wrap gap-2">
            {idlePickers.map((name) => (
              <div
                key={name}
                className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm flex items-center gap-1.5"
              >
                <div className="w-2 h-2 rounded-full bg-gray-400" />
                {name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
