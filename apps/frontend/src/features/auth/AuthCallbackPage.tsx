import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/patterns/ErrorState';
import { useAuth } from '@/features/auth/useAuth';
import type { AuthUser } from '@/features/auth/types';

type CallbackState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done' };

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { refresh, setSessionUser } = useAuth();
  const [ticket] = useState(() => new URLSearchParams(window.location.search).get('ticket'));
  const [state, setState] = useState<CallbackState>(() =>
    ticket
      ? { status: 'loading' }
      : { status: 'error', message: 'Login ticket not found in URL.' },
  );

  useEffect(() => {
    if (!ticket) return;

    const storageKey = `cas_ticket_${ticket}`;

    // Already fully processed - refresh session state then navigate
    if (sessionStorage.getItem(storageKey) === 'done') {
      void refresh().finally(() => {
        navigate('/', { replace: true });
      });
      return;
    }

    // Already in progress (StrictMode double-mount) - skip
    if (sessionStorage.getItem(storageKey) === 'processing') {
      return;
    }

    sessionStorage.setItem(storageKey, 'processing');
    window.history.replaceState({}, '', window.location.pathname);

    (async () => {
      try {
        const res = await fetch(`/api/v1/auth/callback?ticket=${encodeURIComponent(ticket)}`, {
          credentials: 'include',
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          redirect?: string;
          data?: { redirect?: string; user?: AuthUser };
        };
        if (res.status === 403 && (body.redirect || body.data?.redirect)) {
          if (body.data?.user) {
            setSessionUser(body.data.user);
          } else {
            await refresh();
          }
          sessionStorage.setItem(storageKey, 'done');
          setState({ status: 'done' });
          navigate(body.redirect ?? body.data?.redirect ?? '/access-denied', { replace: true });
          return;
        }
        if (!res.ok) {
          throw new Error(body.error ?? 'Login failed to process.');
        }
        if (body.data?.user) {
          setSessionUser(body.data.user);
        } else {
          await refresh();
        }
        sessionStorage.setItem(storageKey, 'done');
        setState({ status: 'done' });
        const redirect = body.data?.redirect ?? '/';
        navigate(redirect, { replace: true });
      } catch (err) {
        sessionStorage.removeItem(storageKey);
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Login failed to process.',
        });
      }
    })();
  }, [ticket, navigate, refresh, setSessionUser]);

  if (state.status === 'done') return null;

  if (state.status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Processing login</CardTitle>
            <CardDescription>Connecting your SSO-UI account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4">
        <ErrorState title="Login failed" message={state.message} />
        <Link
          to="/login"
          className="inline-flex text-sm font-medium text-foreground underline underline-offset-4"
        >
          Back to login page
        </Link>
      </div>
    </main>
  );
}
