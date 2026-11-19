import { AlertTriangle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/useAuth';

export default function AccessDeniedPage() {
  const { logout } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle aria-hidden="true" className="size-5" />
          </div>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            Your SSO-UI account is not registered as a member. Please contact an administrator to get access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" className="w-full" onClick={() => void logout()}>
            <LogOut aria-hidden="true" />
            Log out and try again
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
