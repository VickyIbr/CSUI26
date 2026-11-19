import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Failed to load data', message, onRetry }: ErrorStateProps) {
  return (
    <Alert variant="destructive" className="items-start gap-2 px-3 py-2.5">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <span className="block">{message}</span>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={onRetry}
          >
            Try again
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

