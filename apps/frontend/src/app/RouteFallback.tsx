import { Loader2 } from 'lucide-react';

export function RouteFallback({ label = 'Loading page' }: { label?: string }) {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground"
      aria-live="polite"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

