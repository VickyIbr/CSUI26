import type { FastifyInstance } from 'fastify';
import {
  adminOnly,
  blockUnauthorized,
  optionalAuth,
  serializeMemberForViewer,
} from '../middleware/auth.js';
import * as repo from '../db/repository.js';
import { MemberCreateSchema, MemberUpdateSchema } from '../schemas/index.js';
import { parsePaging } from './courses.js';

export async function memberRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/members', { preHandler: [optionalAuth()] }, async (req) => {
    const query = req.query as {
      search?: string;
      major?: string;
      niche?: string;
      program?: string;
      page?: string;
      limit?: string;
    };
    const { page, limit, offset } = parsePaging(query);
    const filters = {
      search: query.search,
      major: query.major,
      niche: query.niche,
      program: query.program,
    };
    const [results, total] = await Promise.all([
      repo.getAllMembers({ ...filters, limit, offset }),
      repo.countMembers(filters),
    ]);
    return {
      data: results.map((member) => serializeMemberForViewer(member, req.user)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  });

  fastify.get('/api/v1/members/:npm', { preHandler: [optionalAuth()] }, async (req, reply) => {
    const { npm } = req.params as { npm: string };
    const member = await repo.getMemberByNpm(npm);
    if (!member) return reply.code(404).send({ error: 'Member not found' });
    return { data: serializeMemberForViewer(member, req.user) };
  });

  fastify.post('/api/v1/members', { preHandler: [blockUnauthorized(), adminOnly()] }, async (req, reply) => {
    const body = MemberCreateSchema.parse(req.body);
    const existing = await repo.getMemberByNpm(body.npm);
    if (existing) return reply.code(409).send({ error: 'Member exists' });
    const member = await repo.createMember(body);
    return reply.code(201).send({ data: member });
  });

  fastify.put('/api/v1/members/:npm', { preHandler: [blockUnauthorized(), adminOnly()] }, async (req, reply) => {
    const { npm } = req.params as { npm: string };
    const body = MemberUpdateSchema.parse(req.body);
    const member = await repo.updateMember(npm, body);
    if (!member) return reply.code(404).send({ error: 'Member not found' });
    return { data: member };
  });

  fastify.delete('/api/v1/members/:npm', { preHandler: [blockUnauthorized(), adminOnly()] }, async (req, reply) => {
    const { npm } = req.params as { npm: string };
    const deleted = await repo.deleteMember(npm);
    if (!deleted) return reply.code(404).send({ error: 'Member not found' });
    return { data: { npm } };
  });
}
