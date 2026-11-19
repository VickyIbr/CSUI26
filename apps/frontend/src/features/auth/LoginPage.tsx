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
        <CardHeader className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            CSUI · Studio
          </p>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Zenith
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Sign in with your SSO-UI account to manage your Zenith profile, showcase your work, and explore the community.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <Button type="button" className="w-full" onClick={login}>
            Sign in with SSO-UI
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Only registered Zenith accounts can access this panel.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

