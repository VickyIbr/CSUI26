import type { FastifyInstance } from 'fastify';
import { adminOnly, blockUnauthorized } from '../middleware/auth.js';
import * as repo from '../db/repository.js';
import { CourseCreateSchema, CourseUpdateSchema } from '../schemas/index.js';

export function parsePaging(query: Record<string, unknown>, defaultLimit = 20) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export async function courseRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/courses', async (req) => {
    const query = req.query as {
      search?: string;
      sks?: string;
      program?: string;
      semester?: string;
      page?: string;
      limit?: string;
    };
    const { page, limit, offset } = parsePaging(query);
    const filters = {
      search: query.search,
      sks: query.sks ? Number(query.sks) : undefined,
      program: query.program,
      semester: query.semester,
    };
    const [results, total] = await Promise.all([
      repo.searchCourses({ ...filters, limit, offset }),
      repo.countCourses(filters),
    ]);
    return { data: results, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  });

  fastify.post('/api/v1/courses', { preHandler: [blockUnauthorized(), adminOnly()] }, async (req, reply) => {
    const body = CourseCreateSchema.parse(req.body);
    const program = await repo.getProgramById(body.programId);
    if (!program) return reply.code(404).send({ error: 'Program not found' });
    const course = await repo.createCourse(body.programId, body.semester, body.course);
    return reply.code(201).send({ data: course });
  });

  fastify.put('/api/v1/courses/:id', { preHandler: [blockUnauthorized(), adminOnly()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = CourseUpdateSchema.parse(req.body);
    if (body.programId) {
      const program = await repo.getProgramById(body.programId);
      if (!program) return reply.code(404).send({ error: 'Program not found' });
    }
    const course = await repo.updateCourse(Number(id), body);
    if (!course) return reply.code(404).send({ error: 'Course not found' });
    return { data: course };
  });

  fastify.delete('/api/v1/courses/:id', { preHandler: [blockUnauthorized(), adminOnly()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const course = await repo.deleteCourse(Number(id));
    if (!course) return reply.code(404).send({ error: 'Course not found' });
    return { data: course };
  });
}
