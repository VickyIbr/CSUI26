import { Outlet } from 'react-router';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { PageContainer } from '@/components/patterns/PageContainer';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export function AppLayout() {
  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div id="main-content" tabIndex={-1} className="flex-1 p-4 md:p-6">
          <PageContainer>
            <Outlet />
          </PageContainer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}


