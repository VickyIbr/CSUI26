import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { RouteFallback } from '@/app/RouteFallback';
import { AppProviders } from '@/app/providers';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { AdminRoute } from '@/features/auth/AdminRoute';

import AccessDeniedPage from '@/features/auth/AccessDeniedPage';
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const AuthCallbackPage = lazy(() => import('@/features/auth/AuthCallbackPage'));
const ProgramsPage = lazy(() => import('@/features/programs/ProgramsPage'));
const CoursesPage = lazy(() => import('@/features/courses/CoursesPage'));
const MembersPage = lazy(() => import('@/features/members/MembersPage'));
const AchievementsPage = lazy(() => import('@/features/achievements/AchievementsPage'));
const MyProfilePage = lazy(() => import('@/features/members/MyProfilePage'));
const NotFoundPage = lazy(() => import('@/app/NotFoundPage'));

export function AppRoutes() {
  return (
    <AppProviders>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/access-denied" element={<AccessDeniedPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/my-profile" replace />} />
            <Route path="programs" element={<AdminRoute><ProgramsPage /></AdminRoute>} />
            <Route path="courses" element={<AdminRoute><CoursesPage /></AdminRoute>} />
            <Route path="members" element={<AdminRoute><MembersPage /></AdminRoute>} />
            <Route path="achievements" element={<AdminRoute><AchievementsPage /></AdminRoute>} />
            <Route path="my-profile" element={<MyProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </AppProviders>
  );
}

