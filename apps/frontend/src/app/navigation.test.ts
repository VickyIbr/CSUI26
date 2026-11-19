import { describe, expect, it } from 'vitest';
import { findNavItem, isNavItemActive, navItems } from '@/app/navigation';

describe('isNavItemActive', () => {
  const profile = navItems[0];

  it('aktif hanya untuk path persis saat end', () => {
    expect(isNavItemActive('/my-profile', profile)).toBe(true);
    expect(isNavItemActive('/programs', profile)).toBe(false);
  });

  it('aktif untuk child path', () => {
    const programs = navItems[1];
    expect(isNavItemActive('/programs', programs)).toBe(true);
    expect(isNavItemActive('/programs/123', programs)).toBe(true);
    expect(isNavItemActive('/courses', programs)).toBe(false);
  });
});

describe('findNavItem', () => {
  it('menemukan menu dari path', () => {
    expect(findNavItem('/courses')?.label).toBe('Courses');
    expect(findNavItem('/halaman-tidak-ada')).toBeUndefined();
  });
});
