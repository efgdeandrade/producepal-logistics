import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface ChartSkeletonProps {
  height?: number;
  showHeader?: boolean;
  showLegend?: boolean;
}

export function ChartSkeleton({
  height = 300,
  showHeader = true,
  showLegend = true,
}: ChartSkeletonProps) {
  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
      )}
      <CardContent>
        <div style={{ height }} className="relative">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-8" />
            ))}
          </div>
          
          {/* Chart area */}
          <div className="ml-12 h-full pb-8 flex items-end gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end">
                <Skeleton 
                  className="w-full rounded-t" 
                  style={{ height: `${30 + Math.random() * 60}%` }} 
                />
              </div>
            ))}
          </div>
          
          {/* X-axis labels */}
          <div className="absolute bottom-0 left-12 right-0 flex justify-between">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-8" />
            ))}
          </div>
        </div>
        
        {showLegend && (
          <div className="flex gap-4 mt-4 justify-center">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-3 w-3 rounded" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
