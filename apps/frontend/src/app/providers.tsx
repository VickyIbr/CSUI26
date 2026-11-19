import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/features/auth/AuthProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
      <AuthProvider>
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
