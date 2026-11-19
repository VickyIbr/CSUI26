import { BookOpen, GraduationCap, Trophy, Users, User, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  requireAdmin?: boolean;
}

export const navItems: NavItem[] = [
  { to: '/my-profile', label: 'My Profile', icon: User, end: true },
  { to: '/programs', label: 'Study Programs', icon: GraduationCap, requireAdmin: true },
  { to: '/courses', label: 'Courses', icon: BookOpen, requireAdmin: true },
  { to: '/members', label: 'Members', icon: Users, requireAdmin: true },
  { to: '/achievements', label: 'Achievements', icon: Trophy, requireAdmin: true },
];

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function findNavItem(pathname: string): NavItem | undefined {
  return navItems.find((item) => isNavItemActive(pathname, item));
}

