import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Config } from './config.js';
import type { Db } from './db/index.js';
import { errorHandler, unauthorized } from './lib/errors.js';
import { adminRepository } from './modules/admin/repository.js';
import { adminRoutes } from './modules/admin/routes.js';
import { adminService } from './modules/admin/service.js';
import { authRoutes } from './modules/auth/routes.js';
import { circuitsRepository } from './modules/circuits/repository.js';
import { circuitsRoutes } from './modules/circuits/routes.js';
import { circuitsService } from './modules/circuits/service.js';

declare module 'fastify' {
  interface FastifyInstance {
    requireAdmin: (request: FastifyRequest) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: 'admin' };
    user: { sub: string; role: 'admin' };
  }
}

export async function buildApp(config: Config, db: Db): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'test' ? 'warn' : 'info',
      redact: ['req.headers.authorization', 'password'],
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);

  // CORS_ORIGIN admite varios orígenes separados por coma (ej: dominio + localhost)
  await app.register(cors, { origin: config.CORS_ORIGIN.split(',') });
  await app.register(jwt, { secret: config.JWT_SECRET });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(multipart, {
    attachFieldsToBody: 'keyValues',
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 20 },
  });

  await mkdir(config.MEDIA_DIR, { recursive: true });
  await mkdir(config.GPX_DIR, { recursive: true });
  // en prod Caddy sirve /media directo del volumen; esto cubre dev y fallback
  await app.register(fastifyStatic, {
    root: path.resolve(config.MEDIA_DIR),
    prefix: '/media/',
  });

  app.decorate('requireAdmin', async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw unauthorized('Token inválido o vencido');
    }
  });

  const circuitsRepo = circuitsRepository(db);
  const adminRepo = adminRepository(db);

  await app.register(
    async (v1) => {
      v1.get('/health', async () => ({ status: 'ok' }));
      await v1.register(authRoutes(config), { prefix: '/auth' });
      await v1.register(circuitsRoutes(circuitsService(circuitsRepo)));
      await v1.register(adminRoutes(adminService(config, adminRepo)));
    },
    { prefix: '/api/v1' },
  );

  return app;
}
