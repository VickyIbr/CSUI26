import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { GraduationCap, LogOut } from 'lucide-react';
import { isNavItemActive, navItems } from '@/app/navigation';
import { useAuth } from '@/features/auth/useAuth';
import { membersApi } from '@/features/members/api';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function initials(name?: string): string {
  if (!name) return 'CZ';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    if (!user?.npm) {
      setPhotoUrl('');
      return;
    }
    let mounted = true;
    membersApi
      .get(user.npm)
      .then((res) => {
        if (mounted) setPhotoUrl(res.data.foto?.url ?? '');
      })
      .catch(() => {
        if (mounted) setPhotoUrl('');
      });

    const handleProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ npm?: string; fotoUrl?: string }>).detail;
      if (detail?.npm && detail.npm !== user.npm) return;
      if (typeof detail?.fotoUrl === 'string') {
        setPhotoUrl(detail.fotoUrl);
      }
    };
    window.addEventListener('zenith:profile-updated', handleProfileUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('zenith:profile-updated', handleProfileUpdated);
    };
  }, [user?.npm]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/" aria-label="CSUI Zenith, ke Dashboard">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <GraduationCap className="size-4" aria-hidden="true" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">CSUI Zenith</span>
                  <span className="truncate text-xs text-muted-foreground">Admin panel</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                // Skip items requiring admin if user is not admin
                if (item.requireAdmin && !user?.isAdmin) return null;
                const active = isNavItemActive(pathname, item);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton isActive={active} tooltip={item.label} asChild>
                      <Link to={item.to} aria-current={active ? 'page' : undefined}>
                        <item.icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" aria-label="Menu akun">
                  <Avatar size="sm">
                    {photoUrl ? <AvatarImage src={photoUrl} alt={user?.nama ?? 'User'} /> : null}
                    <AvatarFallback>{initials(user?.nama)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">{user?.nama ?? 'User'}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.isAdmin ? 'Admin' : 'Members'}
                    </span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56">
                <DropdownMenuLabel>
                  <span className="block text-sm font-medium">{user?.nama ?? 'User'}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {user?.email ?? (user?.npm ? `NPM ${user.npm}` : '')}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void logout()}>
                  <LogOut aria-hidden="true" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
