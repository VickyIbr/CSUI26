export type SocialPlatform = 'instagram' | 'line' | 'github' | 'linkedin' | 'photo';

function isUrlLike(value: string): boolean {
  return /[./:]/.test(value);
}

function cleanUsername(value: string): string {
  return value.replace(/^@+/, '').replace(/^\/+/, '').trim();
}

function isLocalHostUrl(value: string): boolean {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/|$)/i.test(value);
}

export function normalizeSocialLink(platform: SocialPlatform, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (platform === 'photo' && trimmed.startsWith('/')) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    if (platform === 'photo' || isLocalHostUrl(trimmed)) {
      return trimmed;
    }
    return trimmed.replace(/^http:\/\//i, 'https://');
  }

  if (isUrlLike(trimmed)) {
    const scheme = isLocalHostUrl(trimmed) ? 'http://' : 'https://';
    return `${scheme}${trimmed.replace(/^\/+/, '')}`;
  }

  const username = cleanUsername(trimmed);

  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${username}`;
    case 'github':
      return `https://github.com/${username}`;
    case 'linkedin':
      return `https://linkedin.com/in/${username}`;
    case 'line':
      return `https://line.me/ti/p/~${username}`;
    case 'photo':
      return `https://${username}`;
    default:
      return trimmed;
  }
}

export function getSocialLinkHref(platform: SocialPlatform, value: string): string | null {
  const normalized = normalizeSocialLink(platform, value);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' || url.protocol === 'http:' ? normalized : null;
  } catch {
    return null;
  }
}

export function openSocialLink(platform: SocialPlatform, value: string): boolean {
  const href = getSocialLinkHref(platform, value);
  if (!href) return false;
  window.open(href, '_blank', 'noopener,noreferrer');
  return true;
}

export function normalizeMemberSocials<T extends {
  instagram?: string;
  line?: string;
  github?: string;
  linkedin?: string;
  foto?: { url?: string };
}>(member: T): T {
  return {
    ...member,
    instagram: normalizeSocialLink('instagram', member.instagram ?? ''),
    line: normalizeSocialLink('line', member.line ?? ''),
    github: normalizeSocialLink('github', member.github ?? ''),
    linkedin: normalizeSocialLink('linkedin', member.linkedin ?? ''),
    foto: member.foto
      ? { ...member.foto, url: normalizeSocialLink('photo', member.foto.url ?? '') }
      : member.foto,
  };
}