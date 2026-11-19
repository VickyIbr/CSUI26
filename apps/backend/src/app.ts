import './config/env.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';

import * as repo from './db/repository.js';
import { resolveAllowedOrigins } from './config/auth.js';
import { authRoutes } from './routes/auth.js';
import { programRoutes } from './routes/programs.js';
import { courseRoutes } from './routes/courses.js';
import { memberRoutes } from './routes/members.js';
import { achievementRoutes } from './routes/achievements.js';
import { uploadRoutes } from './routes/upload.js';

export function createApp() {
  const fastify = Fastify({ logger: false });
  const ALLOWED_ORIGINS = resolveAllowedOrigins();

  fastify.register(cookie);
  fastify.register(cors, {
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    }),
  });

  fastify.setErrorHandler((err: any, _req, reply) => {
    if (err?.statusCode === 429) {
      return reply.code(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: err.message || 'Rate limit exceeded. Please try again later.',
      });
    }
    if (err?.code === '23505' || err?.cause?.code === '23505') {
      return reply.code(409).send({ error: 'Email already in use' });
    }
    if (err?.name === 'ZodError' || Array.isArray(err?.issues)) {
      return reply.code(400).send({ error: err.message });
    }
    const status = err?.statusCode && err.statusCode >= 400 ? err.statusCode : 400;
    return reply.code(status).send({ error: err?.message || 'Bad Request' });
  });

  fastify.get('/health', async () => {
    const [programs, members] = await Promise.all([repo.countPrograms(), repo.countMembers()]);
    return { status: 'ok', programs, members };
  });

  fastify.get('/healthz', async () => 'ok');

  fastify.register(programRoutes);
  fastify.register(courseRoutes);
  fastify.register(memberRoutes);
  fastify.register(achievementRoutes);
  fastify.register(uploadRoutes);
  fastify.register(authRoutes);

  return fastify;
}
