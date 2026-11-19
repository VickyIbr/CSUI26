import { Loader2 } from 'lucide-react';

export function RouteFallback({ label = 'Loading page' }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground"
      aria-live="polite"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

