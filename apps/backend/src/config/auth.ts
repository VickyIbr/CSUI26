import type { FastifyRequest } from 'fastify';
import './env.js';

const DEFAULT_SECRET = 'csui-zenith-dev-secret-change-in-prod';
const rawSecret = process.env.JWT_SECRET || DEFAULT_SECRET;

// Prevent using default secret in production
if (process.env.NODE_ENV === 'production' && rawSecret === DEFAULT_SECRET) {
  throw new Error('SECURITY ERROR: JWT_SECRET must be set in production environment');
}

function normalizeOrigin(value?: string): string | undefined {
  const trimmed = value?.trim().replace(/\/+$/, '');
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function isVercelRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL === '1' || Boolean(env.VERCEL_ENV);
}

export function resolveFrontendUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = normalizeOrigin(env.FRONTEND_URL);
  if (explicit) return explicit;

  if (isVercelRuntime(env)) {
    if (env.VERCEL_ENV === 'development') {
      return 'http://localhost:3000';
    }
    const host =
      env.VERCEL_ENV === 'production'
        ? env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL
        : env.VERCEL_BRANCH_URL || env.VERCEL_URL;
    const resolved = normalizeOrigin(host);
    if (resolved) return resolved;
  }

  return 'http://localhost:5173';
}

export function resolveServiceUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.SERVICE_URL?.trim();
  if (explicit) return explicit;
  return `${resolveFrontendUrl(env)}/auth/callback`;
}

export function resolveAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = (env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const origins = new Set(configured);
  if (isVercelRuntime(env)) {
    if (env.VERCEL_ENV === 'development') {
      origins.add('http://localhost:3000');
    }
    for (const candidate of [
      env.VERCEL_URL,
      env.VERCEL_BRANCH_URL,
      env.VERCEL_PROJECT_PRODUCTION_URL,
      env.FRONTEND_URL,
    ]) {
      const normalized = normalizeOrigin(candidate);
      if (normalized) origins.add(normalized);
    }
  }

  return Array.from(origins);
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(',')[0]?.trim();
}

export function resolveRequestFrontendUrl(
  req: Pick<FastifyRequest, 'headers'>,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = normalizeOrigin(env.FRONTEND_URL);
  if (explicit) return explicit;

  if (isVercelRuntime(env)) {
    const host = firstHeaderValue(req.headers['x-forwarded-host']) || firstHeaderValue(req.headers.host);
    const proto =
      firstHeaderValue(req.headers['x-forwarded-proto']) ||
      (env.VERCEL_ENV === 'development' ? 'http' : 'https');

    if (host && (proto === 'http' || proto === 'https')) {
      const candidate = `${proto}://${host.replace(/\/+$/, '')}`;
      if (resolveAllowedOrigins(env).includes(candidate)) {
        return candidate;
      }
    }
  }

  return resolveFrontendUrl(env);
}

export function resolveRequestServiceUrl(
  req: Pick<FastifyRequest, 'headers'>,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = env.SERVICE_URL?.trim();
  if (explicit) return explicit;
  return `${resolveRequestFrontendUrl(req, env)}/auth/callback`;
}

export const JWT_SECRET = rawSecret;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export const FRONTEND_URL = resolveFrontendUrl();
export const SERVICE_URL = resolveServiceUrl();
export const ADMIN_NPM_LIST = (process.env.ADMIN_NPM_LIST || '').split(',').map(s => s.trim()).filter(Boolean);