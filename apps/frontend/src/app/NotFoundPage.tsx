import { Link } from 'react-router';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Compass className="size-5" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-semibold text-foreground">Page not found</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        The URL you opened does not exist in this panel. Check the address or go back to the dashboard.
      </p>
      <Button asChild className="mt-5">
        <Link to="/">Back to Dashboard</Link>
      </Button>
    </div>
  );
}

