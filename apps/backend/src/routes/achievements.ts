import type { FastifyInstance } from 'fastify';
import { adminOnly, blockUnauthorized } from '../middleware/auth.js';
import * as repo from '../db/repository.js';
import { AchievementCreateSchema, AchievementUpdateSchema } from '../schemas/index.js';
import { parsePaging } from './courses.js';

export async function achievementRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/achievements', async (req) => {
    const query = req.query as {
      format?: string;
      search?: string;
      year?: string;
      featured?: string;
      page?: string;
      limit?: string;
    };

    if (query.format === 'grouped') {
      return { data: await repo.getGroupedAchievements() };
    }

    const { page, limit, offset } = parsePaging(query);
    const parsedYear = query.year !== undefined && query.year !== '' ? Number(query.year) : undefined;
    const isFeatured =
      query.featured === 'true' ? true : query.featured === 'false' ? false : undefined;
    const filters = {
      search: query.search,
      year: parsedYear !== undefined && Number.isFinite(parsedYear) ? parsedYear : undefined,
      isFeatured,
    };

    const [results, total] = await Promise.all([
      repo.getAllAchievements({ ...filters, limit, offset }),
      repo.countAchievements(filters),
    ]);

    return {
      data: results,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  });

  fastify.get('/api/v1/achievements/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const achievement = await repo.getAchievementById(id);
    if (!achievement) return reply.code(404).send({ error: 'Achievement not found' });
    return { data: achievement };
  });

  fastify.post('/api/v1/achievements', { preHandler: [blockUnauthorized(), adminOnly()] }, async (req, reply) => {
    const body = AchievementCreateSchema.parse(req.body);
    const existing = await repo.getAchievementById(body.id);
    if (existing) return reply.code(409).send({ error: 'Achievement exists' });
    const created = await repo.createAchievement(body);
    return reply.code(201).send({ data: created });
  });

  fastify.put('/api/v1/achievements/:id', { preHandler: [blockUnauthorized(), adminOnly()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = AchievementUpdateSchema.parse(req.body);
    const existing = await repo.getAchievementById(id);
    if (!existing) return reply.code(404).send({ error: 'Achievement not found' });

    const merged = { ...existing, ...body };
    if (merged.isFeatured) {
      AchievementCreateSchema.parse(merged);
    }

    const updated = await repo.updateAchievement(id, body);
    return { data: updated };
  });

  fastify.delete('/api/v1/achievements/:id', { preHandler: [blockUnauthorized(), adminOnly()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const deleted = await repo.deleteAchievement(id);
    if (!deleted) return reply.code(404).send({ error: 'Achievement not found' });
    return { data: { id } };
  });
}
