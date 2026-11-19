import { FastifyInstance } from 'fastify';
import { getLoginUrl, getLogoutUrl, validateTicket, type CasUser } from '@zenith/sso-ui';
import { signToken, blockUnauthorized, requireWhitelisted, adminOnly, invalidateMemberAuthCache } from '../middleware/auth.js';
import {
  ADMIN_NPM_LIST,
  resolveRequestFrontendUrl,
  resolveRequestServiceUrl,
} from '../config/auth.js';
import * as repo from '../db/repository.js';
import { MemberUpdateSchema } from '../schemas/index.js';
import { createTtlCache } from '../lib/cache.js';

const validatedTicketCache = createTtlCache<CasUser>(60_000);
const inFlightTickets = new Map<string, Promise<CasUser>>();

async function resolveCasTicket(ticket: string, serviceUrl: string): Promise<CasUser> {
  const cacheKey = `${serviceUrl}::${ticket}`;
  const cached = validatedTicketCache.get(cacheKey);
  if (cached) return cached;

  const existing = inFlightTickets.get(cacheKey);
  if (existing) return existing;

  const promise = validateTicket(ticket, serviceUrl)
    .then((user) => {
      validatedTicketCache.set(cacheKey, user);
      return user;
    })
    .finally(() => {
      inFlightTickets.delete(cacheKey);
    });

  inFlightTickets.set(cacheKey, promise);
  return promise;
}

function getCookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    ...(maxAge ? { maxAge } : {}),
  };
}

export async function authRoutes(fastify: FastifyInstance) {

  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const json = body === '' ? {} : JSON.parse(body as string);
      done(null, json);
    } catch (err: any) {
      done(err, undefined);
    }
  });

  fastify.get('/api/v1/auth/login', async (req, reply) => {
    const loginUrl = getLoginUrl(resolveRequestServiceUrl(req));
    return reply.redirect(loginUrl);
  });

  fastify.get('/api/v1/auth/callback', async (req, reply) => {
    const { ticket } = req.query as { ticket?: string };
    if (!ticket) return reply.code(400).send({ error: 'Missing ticket' });
    try {
      const user = await resolveCasTicket(ticket, resolveRequestServiceUrl(req));
      const npm = user.npm;
      
      // Determine superadmin status first
      const isSuperAdmin = ADMIN_NPM_LIST.includes(npm || '');

      // Check if user's NPM exists in members table
      const memberFromDB = npm ? await repo.getMemberByNpm(npm) : null;
      const isWhitelisted = !!memberFromDB;

      // If superadmin, ensure DB role is 'admin' (sync)
      if (isSuperAdmin && isWhitelisted && memberFromDB?.role !== 'admin') {
        await repo.updateMemberRole(npm!, 'admin');
        invalidateMemberAuthCache(npm!);
      }

      // For whitelisted users, get role from DB; superadmin always admin
      const role = isSuperAdmin ? 'admin' : (isWhitelisted ? (memberFromDB?.role || 'user') : 'user');
      const isAdmin = isSuperAdmin || role === 'admin';

      const sessionUser = {
        username: user.username,
        nama: user.nama,
        npm: npm,
        nip: user.nip,
        role: role,
        kd_org: user.kd_org,
        email: user.email,
        isAdmin,
        isWhitelisted,
        isSuperAdmin,
        org: user.org,
      };
      const token = signToken(sessionUser);
      reply.setCookie('token', token, getCookieOptions(7 * 24 * 3600));
      
      // Return JSON instead of redirect to avoid race condition with cookie
      if (!isWhitelisted) {
        return reply.code(403).send({
          error: 'NPM not registered',
          redirect: '/access-denied',
          data: { redirect: '/access-denied', user: sessionUser },
        });
      }
      return reply.send({ data: { success: true, redirect: '/', user: sessionUser } });
    } catch (err: any) {
      return reply.code(401).send({ error: err.message || 'Authentication failed' });
    }
  });

  fastify.get('/api/v1/auth/me', { preHandler: [blockUnauthorized()] }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    return reply.send({ data: req.user });
  });

  // Endpoint for user to update their own profile
  fastify.put('/api/v1/members/me', { preHandler: [blockUnauthorized(), requireWhitelisted()] }, async (req, reply) => {
    const npm = req.user?.npm;
    if (!npm) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      // Lock role and npm at schema validation boundary
      const updates = MemberUpdateSchema.omit({ role: true }).parse(req.body);
      const member = await repo.updateMember(npm, updates);
      if (!member) return reply.code(404).send({ error: 'Member not found' });
      invalidateMemberAuthCache(npm);
      return { data: member };
    } catch (err: any) {
      if (err?.code === '23505' || err?.cause?.code === '23505') {
        return reply.code(409).send({ error: 'Email already in use' });
      }
      return reply.code(400).send({ error: err.message });
    }
  });

  // Admin: update role of a member
  fastify.put('/api/v1/members/:npm/role', { preHandler: [blockUnauthorized(), requireWhitelisted(), adminOnly()] }, async (req, reply) => {
    const { npm } = req.params as { npm: string };
    const { role } = req.body as { role: 'user' | 'admin' };
    
    if (!['user', 'admin'].includes(role)) {
      return reply.code(400).send({ error: 'Invalid role' });
    }

    // Check if target is superadmin (immutable)
    if (ADMIN_NPM_LIST.includes(npm)) {
      return reply.code(403).send({ error: 'Forbidden: superadmin role cannot be changed' });
    }

    const member = await repo.updateMemberRole(npm, role);
    if (!member) return reply.code(404).send({ error: 'Member not found or role change blocked' });
    invalidateMemberAuthCache(npm);
    return { data: member };
  });

  fastify.post('/api/v1/auth/logout', async (req, reply) => {
    reply.clearCookie('token', getCookieOptions());
    const logoutUrl = getLogoutUrl(resolveRequestFrontendUrl(req));
    return reply.send({ data: { logoutUrl } });
  });
}