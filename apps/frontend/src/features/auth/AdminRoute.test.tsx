import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AdminRoute } from '@/features/auth/AdminRoute';
import { AuthProvider } from '@/features/auth/AuthProvider';
import AuthCallbackPage from '@/features/auth/AuthCallbackPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { useAuth } from '@/features/auth/useAuth';

const actualUseAuthRef = vi.hoisted(() => ({ current: null as null | typeof useAuth }));

vi.mock('@/features/auth/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/auth/useAuth')>();
  actualUseAuthRef.current = actual.useAuth;
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

describe('AdminRoute', () => {
  it('renders children for admin users', () => {
    (useAuth as any).mockReturnValue({ user: { isAdmin: true, isWhitelisted: true }, loading: false });
    render(
      <MemoryRouter>
        <AdminRoute>
          <div>admin content</div>
        </AdminRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText('admin content')).toBeInTheDocument();
  });

  it('redirects non-admin users', () => {
    (useAuth as any).mockReturnValue({ user: { isAdmin: false, isWhitelisted: true }, loading: false });
    render(
      <MemoryRouter initialEntries={['/programs']}>
        <AdminRoute>
          <div>admin content</div>
        </AdminRoute>
      </MemoryRouter>,
    );
    expect(screen.queryByText('admin content')).not.toBeInTheDocument();
  });

  it('does not redirect back to /login when initial /auth/me fails slower than /auth/callback on mobile', async () => {
    (useAuth as any).mockImplementation(() => actualUseAuthRef.current!());
    window.history.replaceState({}, '', '/auth/callback?ticket=ST-MOBILE-1');
    sessionStorage.clear();

    let cookieSet = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/auth/callback')) {
        await new Promise((r) => setTimeout(r, 360));
        cookieSet = true;
        return new Response(
          JSON.stringify({
            data: {
              success: true,
              redirect: '/',
              user: { nama: 'Mobile User', npm: '2606888572', isAdmin: true, isWhitelisted: true, isSuperAdmin: true },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/api/v1/auth/me')) {
        const hasCookieAtRequestStart = cookieSet;
        if (!hasCookieAtRequestStart) {
          await new Promise((r) => setTimeout(r, 40));
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({
            data: { nama: 'Mobile User', npm: '2606888572', isAdmin: true, isWhitelisted: true, isSuperAdmin: true },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;

    try {
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/auth/callback?ticket=ST-MOBILE-1']}>
            <Routes>
              <Route path="/login" element={<div>login page</div>} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <div>protected dashboard</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>,
      );

      await waitFor(
        () => {
          expect(screen.getByText('protected dashboard')).toBeInTheDocument();
        },
        { timeout: 2500 },
      );
      expect(screen.queryByText('login page')).not.toBeInTheDocument();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});