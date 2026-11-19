import type { FastifyInstance } from 'fastify';
import { adminOnly, blockUnauthorized } from '../middleware/auth.js';
import * as repo from '../db/repository.js';
import { ProgramCreateSchema, ProgramUpdateSchema } from '../schemas/index.js';

export async function programRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/programs', async () => {
    return { data: await repo.getAllPrograms() };
  });

  fastify.get('/api/v1/programs/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const program = await repo.getProgramById(id);
    if (!program) return reply.code(404).send({ error: 'Program not found' });
    return { data: program };
  });

  fastify.get('/api/v1/semesters', async (req) => {
    const { program } = req.query as { program?: string };
    return { data: await repo.getAllSemesters(program) };
  });

  fastify.post('/api/v1/programs', { preHandler: [blockUnauthorized(), adminOnly()] }, async (req, reply) => {
    const body = ProgramCreateSchema.parse(req.body);
    const existing = await repo.getProgramById(body.id);
    if (existing) return reply.code(409).send({ error: 'Program exists' });
    const program = await repo.createProgram(body);
    return reply.code(201).send({ data: program });
  });

  fastify.put('/api/v1/programs/:id', { preHandler: [blockUnauthorized(), adminOnly()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = ProgramUpdateSchema.parse(req.body);
    const program = await repo.updateProgram(id, body);
    if (!program) return reply.code(404).send({ error: 'Program not found' });
    return { data: program };
  });

  fastify.delete('/api/v1/programs/:id', { preHandler: [blockUnauthorized(), adminOnly()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if ((await repo.countMembers({ program: id })) > 0) {
      return reply.code(409).send({ error: 'Program has members' });
    }
    const deleted = await repo.deleteProgram(id);
    if (!deleted) return reply.code(404).send({ error: 'Program not found' });
    return { data: { id } };
  });
}
