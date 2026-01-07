import { Skeleton } from '../ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';

interface FormSkeletonProps {
  fields?: number;
  showCard?: boolean;
  showHeader?: boolean;
}

export function FormSkeleton({
  fields = 4,
  showCard = true,
  showHeader = true,
}: FormSkeletonProps) {
  const content = (
    <>
      {showHeader && (
        <div className="mb-6">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
      )}
      <div className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-6">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-20" />
      </div>
    </>
  );

  if (!showCard) {
    return <div className="p-4">{content}</div>;
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-20" />
      </CardFooter>
    </Card>
  );
}
