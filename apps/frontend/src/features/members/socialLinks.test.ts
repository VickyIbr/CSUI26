import { describe, expect, it } from 'vitest';

import { getSocialLinkHref, normalizeSocialLink } from './socialLinks';

describe('normalizeSocialLink', () => {
  it('returns empty for empty input', () => {
    expect(normalizeSocialLink('github', '')).toBe('');
    expect(normalizeSocialLink('github', '   ')).toBe('');
  });

  it('normalizes usernames', () => {
    expect(normalizeSocialLink('instagram', 'johndoe')).toBe('https://instagram.com/johndoe');
    expect(normalizeSocialLink('github', '@johndoe')).toBe('https://github.com/johndoe');
    expect(normalizeSocialLink('linkedin', 'johndoe')).toBe('https://linkedin.com/in/johndoe');
    expect(normalizeSocialLink('line', 'johndoe')).toBe('https://line.me/ti/p/~johndoe');
  });

  it('preserves and upgrades full URLs', () => {
    expect(normalizeSocialLink('github', 'https://github.com/johndoe')).toBe('https://github.com/johndoe');
    expect(normalizeSocialLink('github', 'http://github.com/johndoe')).toBe('https://github.com/johndoe');
    expect(normalizeSocialLink('photo', 'http://localhost:9000/zenith-media/a.webp')).toBe('http://localhost:9000/zenith-media/a.webp');
    expect(normalizeSocialLink('photo', '/images/achievements/ioai.png')).toBe('/images/achievements/ioai.png');
  });

  it('prepends https or http for localhost to URL-like values', () => {
    expect(normalizeSocialLink('linkedin', 'linkedin.com/in/johndoe')).toBe('https://linkedin.com/in/johndoe');
    expect(normalizeSocialLink('photo', 'localhost:9000/zenith-media/a.webp')).toBe('http://localhost:9000/zenith-media/a.webp');
  });
});

describe('getSocialLinkHref', () => {
  it('returns null for empty input', () => {
    expect(getSocialLinkHref('github', '')).toBeNull();
  });

  it('returns normalized href for usernames', () => {
    expect(getSocialLinkHref('github', 'johndoe')).toBe('https://github.com/johndoe');
  });
});