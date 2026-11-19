import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, ADMIN_NPM_LIST } from '../config/auth.js';
import * as repo from '../db/repository.js';
import type { Member } from '../schemas/index.js';
import { createTtlCache } from '../lib/cache.js';

const memberAuthCache = createTtlCache<AuthUser>(30_000);

export function invalidateMemberAuthCache(npm?: string): void {
  if (npm) memberAuthCache.delete(npm);
  else memberAuthCache.clear();
}

export interface AuthUser {
  nama: string;
  npm?: string;
  nip?: string;
  role?: string;
  kd_org?: string;
  email?: string;
  isAdmin: boolean;
  isWhitelisted: boolean; // true jika NPM ada di DB members
  org?: { faculty: string; studyProgram: string; programType: string };
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

function extractToken(req: FastifyRequest): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  const cookies = (req as any).cookies;
  if (cookies && cookies.token) return cookies.token;
  return null;
}

async function toUser(payload: any, useCache = false): Promise<AuthUser> {
  if (useCache && payload?.npm) {
    const cached = memberAuthCache.get(payload.npm);
    if (cached) return cached;
  }

  const memberFromDB = payload.npm ? await repo.getMemberByNpm(payload.npm) : null;
  const isWhitelisted = !!memberFromDB;
  const roleFromDB = memberFromDB?.role || 'user';
  
  // Determine admin status from DB role (current) or JWT payload (fallback)
  const isAdmin = isWhitelisted && (roleFromDB === 'admin' || ADMIN_NPM_LIST.includes(payload.npm || ''));

  const result: AuthUser = {
    nama: payload.nama,
    npm: payload.npm,
    nip: payload.nip,
    email: payload.email,
    kd_org: payload.kd_org,
    isAdmin,
    isWhitelisted,
  };

  if (isWhitelisted) {
    result.role = roleFromDB;
  }

  if (useCache && payload?.npm) {
    memberAuthCache.set(payload.npm, result);
  }

  return result;
}

async function attachUserFromToken(req: FastifyRequest, token: string, useCache = false): Promise<void> {
  const payload = jwt.verify(token, JWT_SECRET) as any;
  req.user = await toUser(payload, useCache);
}

export function blockUnauthorized() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const token = extractToken(req);
    if (!token) return reply.code(401).send({ error: 'Unauthorized' });
    try {
      await attachUserFromToken(req, token, false);
    } catch {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  };
}

export function optionalAuth() {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const token = extractToken(req);
    if (!token) return;
    try {
      await attachUserFromToken(req, token, true);
    } catch {
      // Ignore invalid or expired tokens so public reads fall back to unauthenticated view
    }
  };
}

export function serializeMemberForViewer(
  member: Member,
  user?: AuthUser,
): Omit<Member, 'email' | 'role'> | Member {
  if (user?.isWhitelisted) return member;
  const { email: _email, role: _role, ...publicMember } = member;
  return publicMember;
}

export function adminOnly() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user?.isAdmin) {
      return reply.code(403).send({ error: 'Forbidden: admin only' });
    }
  };
}

export function requireWhitelisted() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user?.isWhitelisted) {
      return reply.code(403).send({ error: 'Forbidden: NPM not registered as member' });
    }
  };
}

export function signToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}