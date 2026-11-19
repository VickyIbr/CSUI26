import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading data">
      {Array.from({ length: rows }).map((_, index) => (
        <Card key={index}>
          <CardContent className="space-y-2 py-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading data">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardContent className="space-y-3 py-4">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
