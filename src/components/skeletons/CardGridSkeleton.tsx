import { Skeleton } from '../ui/skeleton';
import { Card, CardContent, CardHeader } from '../ui/card';

interface CardGridSkeletonProps {
  cards?: number;
  columns?: 2 | 3 | 4;
  showIcon?: boolean;
}

export function CardGridSkeleton({
  cards = 4,
  columns = 4,
  showIcon = true,
}: CardGridSkeletonProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid gap-4 ${gridCols[columns]}`}>
      {Array.from({ length: cards }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            {showIcon && <Skeleton className="h-4 w-4 rounded" />}
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
