import { useLocation } from 'react-router';
import { findNavItem } from '@/app/navigation';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function AppHeader() {
  const { pathname } = useLocation();
  const current = findNavItem(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 md:px-4">
      <SidebarTrigger aria-label="Open or close menu" />
      <Separator orientation="vertical" className="mr-1 h-4" />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{current?.label ?? 'My Profile'}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  );
}
