import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  href?: string;
  loading?: boolean;
}

export function StatCard({ label, value, icon: Icon, description, href, loading }: StatCardProps) {
  const body = (
    <CardContent className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0 space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="font-mono text-3xl font-bold tabular-nums text-foreground">{value}</p>
        )}
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </div>
    </CardContent>
  );

  if (!href) return <Card>{body}</Card>;

  return (
    <Card className={cn('transition-colors hover:bg-muted/40')}>
      <Link to={href} className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        {body}
      </Link>
    </Card>
  );
}

