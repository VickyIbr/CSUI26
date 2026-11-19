import type { ReactNode } from 'react';
import { ErrorState } from '@/components/patterns/ErrorState';

interface ListStateProps {
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  onRetry?: () => void;
  empty: ReactNode;
  skeleton?: ReactNode;
  children: ReactNode;
}

export function ListState({
  loading,
  error,
  isEmpty,
  onRetry,
  empty,
  skeleton,
  children,
}: ListStateProps) {
  if (loading) return <>{skeleton}</>;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (isEmpty) return <>{empty}</>;
  return <>{children}</>;
}
