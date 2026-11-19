import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import {
  isVercelRuntime,
  resolveAllowedOrigins,
  resolveFrontendUrl,
  resolveRequestFrontendUrl,
  resolveRequestServiceUrl,
  resolveServiceUrl,
} from '../config/auth.js';

const VERCEL_ENV_KEYS = [
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_BRANCH_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'FRONTEND_URL',
  'SERVICE_URL',
  'ALLOWED_ORIGINS',
] as const;

describe('Vercel auth & origin config helpers', () => {
  it('preserves local non-Vercel defaults when env vars are unset', () => {
    const env: NodeJS.ProcessEnv = {};
    expect(isVercelRuntime(env)).toBe(false);
    expect(resolveFrontendUrl(env)).toBe('http://localhost:5173');
    expect(resolveServiceUrl(env)).toBe('http://localhost:5173/auth/callback');
    expect(resolveAllowedOrigins(env)).toEqual(['http://localhost:5173']);
  });

  it('honors explicit VPS/local env overrides and normalizes trailing slashes', () => {
    const env: NodeJS.ProcessEnv = {
      FRONTEND_URL: 'https://zenith.example.ac.id///',
      SERVICE_URL: 'https://zenith.example.ac.id/auth/callback',
      ALLOWED_ORIGINS: 'https://zenith.example.ac.id/, https://admin.example.ac.id',
    };
    expect(isVercelRuntime(env)).toBe(false);
    expect(resolveFrontendUrl(env)).toBe('https://zenith.example.ac.id');
    expect(resolveServiceUrl(env)).toBe('https://zenith.example.ac.id/auth/callback');
    expect(resolveAllowedOrigins(env)).toEqual([
      'https://zenith.example.ac.id',
      'https://admin.example.ac.id',
    ]);
  });

  it('resolves vercel dev runtime to http://localhost:3000', () => {
    const env: NodeJS.ProcessEnv = {
      VERCEL: '1',
      VERCEL_ENV: 'development',
    };
    expect(isVercelRuntime(env)).toBe(true);
    expect(resolveFrontendUrl(env)).toBe('http://localhost:3000');
    expect(resolveServiceUrl(env)).toBe('http://localhost:3000/auth/callback');
    expect(resolveAllowedOrigins(env)).toEqual(
      expect.arrayContaining(['http://localhost:5173', 'http://localhost:3000']),
    );
    expect(
      resolveRequestFrontendUrl({ headers: { host: 'localhost:3000' } }, env),
    ).toBe('http://localhost:3000');
  });

  it('resolves Vercel preview deployments dynamically for trusted hosts and rejects untrusted hosts', () => {
    const env: NodeJS.ProcessEnv = {
      VERCEL: '1',
      VERCEL_ENV: 'preview',
      VERCEL_URL: 'csui-zenith-abc123.vercel.app',
      VERCEL_BRANCH_URL: 'csui-zenith-git-feat.vercel.app',
    };

    expect(resolveFrontendUrl(env)).toBe('https://csui-zenith-git-feat.vercel.app');
    expect(resolveAllowedOrigins(env)).toEqual(
      expect.arrayContaining([
        'https://csui-zenith-abc123.vercel.app',
        'https://csui-zenith-git-feat.vercel.app',
      ]),
    );

    expect(
      resolveRequestFrontendUrl(
        {
          headers: {
            'x-forwarded-host': 'csui-zenith-abc123.vercel.app',
            'x-forwarded-proto': 'https',
          },
        },
        env,
      ),
    ).toBe('https://csui-zenith-abc123.vercel.app');

    expect(
      resolveRequestServiceUrl(
        {
          headers: {
            'x-forwarded-host': 'csui-zenith-abc123.vercel.app',
            'x-forwarded-proto': 'https',
          },
        },
        env,
      ),
    ).toBe('https://csui-zenith-abc123.vercel.app/auth/callback');

    expect(
      resolveRequestFrontendUrl(
        {
          headers: {
            'x-forwarded-host': 'evil.example.com',
            'x-forwarded-proto': 'https',
          },
        },
        env,
      ),
    ).toBe('https://csui-zenith-git-feat.vercel.app');

    expect(
      resolveRequestFrontendUrl(
        {
          headers: {
            'x-forwarded-host': 'csui-zenith-abc123.vercel.app',
            'x-forwarded-proto': 'javascript',
          },
        },
        env,
      ),
    ).toBe('https://csui-zenith-git-feat.vercel.app');
  });

  it('prefers VERCEL_PROJECT_PRODUCTION_URL in production and respects explicit FRONTEND_URL/SERVICE_URL', () => {
    const prodEnv: NodeJS.ProcessEnv = {
      VERCEL: '1',
      VERCEL_ENV: 'production',
      VERCEL_URL: 'csui-zenith-prod-hash.vercel.app',
      VERCEL_PROJECT_PRODUCTION_URL: 'zenith.cs.ui.ac.id',
    };
    expect(resolveFrontendUrl(prodEnv)).toBe('https://zenith.cs.ui.ac.id');
    expect(resolveServiceUrl(prodEnv)).toBe('https://zenith.cs.ui.ac.id/auth/callback');

    const pinnedEnv: NodeJS.ProcessEnv = {
      ...prodEnv,
      FRONTEND_URL: 'https://custom.cs.ui.ac.id',
      SERVICE_URL: 'https://custom.cs.ui.ac.id/auth/callback',
    };
    expect(
      resolveRequestFrontendUrl(
        { headers: { 'x-forwarded-host': 'csui-zenith-prod-hash.vercel.app', 'x-forwarded-proto': 'https' } },
        pinnedEnv,
      ),
    ).toBe('https://custom.cs.ui.ac.id');
    expect(
      resolveRequestServiceUrl(
        { headers: { 'x-forwarded-host': 'csui-zenith-prod-hash.vercel.app', 'x-forwarded-proto': 'https' } },
        pinnedEnv,
      ),
    ).toBe('https://custom.cs.ui.ac.id/auth/callback');
  });
});

describe('Fastify Vercel CORS and auth redirects', () => {
  const savedEnv = new Map<string, string | undefined>();
  const appsToClose: Array<ReturnType<typeof createApp>> = [];

  function setVercelEnv(overrides: Partial<Record<(typeof VERCEL_ENV_KEYS)[number], string | undefined>>) {
    for (const key of VERCEL_ENV_KEYS) {
      if (!savedEnv.has(key)) {
        savedEnv.set(key, process.env[key]);
      }
      const next = overrides[key];
      if (next === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = next;
      }
    }
  }

  afterEach(async () => {
    for (const app of appsToClose.splice(0)) {
      await app.close();
    }
    for (const [key, original] of savedEnv.entries()) {
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
    savedEnv.clear();
  });

  it('allows trusted Vercel preview origins via CORS and uses request origin for CAS login/logout', async () => {
    setVercelEnv({
      VERCEL: '1',
      VERCEL_ENV: 'preview',
      VERCEL_URL: 'zenith-deploy-123.vercel.app',
      VERCEL_BRANCH_URL: 'zenith-git-main.vercel.app',
    });

    const app = createApp();
    appsToClose.push(app);
    await app.ready();

    const allowedPreflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/auth/logout',
      headers: {
        origin: 'https://zenith-git-main.vercel.app',
        'access-control-request-method': 'POST',
      },
    });
    expect(allowedPreflight.statusCode).toBe(204);
    expect(allowedPreflight.headers['access-control-allow-origin']).toBe(
      'https://zenith-git-main.vercel.app',
    );
    expect(allowedPreflight.headers['access-control-allow-credentials']).toBe('true');

    const blockedPreflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/auth/logout',
      headers: {
        origin: 'https://evil.example.com',
        'access-control-request-method': 'POST',
      },
    });
    expect(blockedPreflight.headers['access-control-allow-origin']).toBeUndefined();

    const loginRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/login',
      headers: {
        'x-forwarded-host': 'zenith-deploy-123.vercel.app',
        'x-forwarded-proto': 'https',
      },
    });
    expect(loginRes.statusCode).toBe(302);
    expect(loginRes.headers.location).toBe(
      'https://sso.ui.ac.id/cas2/login?service=https%3A%2F%2Fzenith-deploy-123.vercel.app%2Fauth%2Fcallback',
    );

    const spoofedLoginRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/login',
      headers: {
        'x-forwarded-host': 'evil.example.com',
        'x-forwarded-proto': 'https',
      },
    });
    expect(spoofedLoginRes.statusCode).toBe(302);
    expect(spoofedLoginRes.headers.location).toBe(
      'https://sso.ui.ac.id/cas2/login?service=https%3A%2F%2Fzenith-git-main.vercel.app%2Fauth%2Fcallback',
    );

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        'x-forwarded-host': 'zenith-deploy-123.vercel.app',
        'x-forwarded-proto': 'https',
      },
    });
    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json()).toEqual({
      data: {
        logoutUrl:
          'https://sso.ui.ac.id/cas2/logout?url=https%3A%2F%2Fzenith-deploy-123.vercel.app',
      },
    });
  });
});
