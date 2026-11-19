import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { RouteFallback } from '@/app/RouteFallback';
import AccessDeniedPage from '@/features/auth/AccessDeniedPage';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <RouteFallback label="Memeriksa sesi" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.isWhitelisted) return <AccessDeniedPage />;
  return <>{children}</>;
}
