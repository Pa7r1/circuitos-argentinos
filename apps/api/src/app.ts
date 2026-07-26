import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Config } from './config.js';
import type { Db } from './db/index.js';
import { DomainError, errorHandler, unauthorized } from './lib/errors.js';
import { adminRepository } from './modules/admin/repository.js';
import { adminRoutes } from './modules/admin/routes.js';
import { adminService } from './modules/admin/service.js';
import { authRepository } from './modules/auth/repository.js';
import { authRoutes } from './modules/auth/routes.js';
import { authService } from './modules/auth/service.js';
import { circuitsRepository } from './modules/circuits/repository.js';
import { circuitsRoutes, mediaRoutes } from './modules/circuits/routes.js';
import { circuitsService } from './modules/circuits/service.js';

declare module 'fastify' {
  interface FastifyInstance {
    requireUser: (request: FastifyRequest) => Promise<void>;
    requireAdmin: (request: FastifyRequest) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: 'user' | 'admin'; name: string };
    user: { sub: string; role: 'user' | 'admin'; name: string };
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

  // La lista de métodos va explícita: el default de @fastify/cors es GET/HEAD/POST,
  // así que el navegador bloqueaba PATCH y DELETE en el preflight y el panel de
  // administración no podía publicar ni archivar cuando la web vive en otro
  // dominio que la API (en desarrollo no se nota, el proxy de vite evita el CORS).
  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['content-type', 'authorization'],
    maxAge: 86_400,
  });
  await app.register(jwt, { secret: config.JWT_SECRET });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(multipart, {
    attachFieldsToBody: 'keyValues',
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 20 },
  });

  async function verificarToken(request: FastifyRequest): Promise<void> {
    try {
      await request.jwtVerify();
    } catch {
      throw unauthorized('Token inválido o vencido');
    }
  }

  /** Cualquier cuenta con sesión válida (usuario o admin). */
  app.decorate('requireUser', verificarToken);

  /**
   * Solo administradores. Verificar la firma no alcanza: un token de usuario
   * común también está bien firmado, así que hay que exigir el rol.
   */
  app.decorate('requireAdmin', async (request: FastifyRequest) => {
    await verificarToken(request);
    if (request.user.role !== 'admin') {
      throw new DomainError(403, 'PROHIBIDO', 'Necesitás permisos de administrador');
    }
  });

  const circuitsRepo = circuitsRepository(db);
  const adminRepo = adminRepository(db);
  const auth = authService(authRepository(db));
  const circuits = circuitsService(circuitsRepo);

  // fuera de /api/v1: las URLs de las fotos guardadas son /media/:id/:archivo
  await app.register(mediaRoutes(circuits));

  await app.register(
    async (v1) => {
      v1.get('/health', async () => ({ status: 'ok' }));
      await v1.register(authRoutes(config, auth), { prefix: '/auth' });
      await v1.register(circuitsRoutes(circuits));
      await v1.register(adminRoutes(adminService(config, adminRepo, () => auth.countUsers())));
    },
    { prefix: '/api/v1' },
  );

  return app;
}
