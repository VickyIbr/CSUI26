import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/useAuth';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  useEffect(() => {
    if (!loading && user) navigate(from, { replace: true });
  }, [loading, user, navigate, from]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-semibold" aria-hidden="true">
              CZ
            </span>
          </div>
          <CardTitle>CSUI Zenith</CardTitle>
          <CardDescription>
            Sign in with your SSO-UI account to manage study programs, courses, and members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" className="w-full" onClick={login}>
            Sign in with SSO-UI
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Only registered accounts can access this panel.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

