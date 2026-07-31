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

  /*
   * Cabeceras de seguridad. Van a mano y no con helmet: son tres, y una API que
   * devuelve JSON no necesita el resto del paquete.
   *
   * La que importa de verdad es `nosniff`. `/media/:id/:archivo` sirve binarios
   * que subió alguien, con un `content-type` deducido de los primeros bytes del
   * archivo; sin esa cabecera el navegador puede ignorar ese tipo, olfatear el
   * contenido y tratarlo como otra cosa.
   */
  app.addHook('onSend', async (_request, reply) => {
    void reply.headers({
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      // nada de esta API tiene por qué mostrarse dentro de un iframe ajeno
      'x-frame-options': 'DENY',
    });
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

  const circuitsRepo = circuitsRepository(db);
  const adminRepo = adminRepository(db);
  const auth = authService(authRepository(db));
  const circuits = circuitsService(circuitsRepo);

  const prohibido = () =>
    new DomainError(403, 'PROHIBIDO', 'Necesitás permisos de administrador');

  /**
   * Solo administradores.
   *
   * Verificar la firma no alcanza: un token de usuario común también está bien
   * firmado. Pero mirar el rol del token TAMPOCO alcanza: el rol viaja adentro y
   * los tokens duran 30 días, así que quitarle el permiso a alguien en la base no
   * le cerraba la puerta hasta que su token venciera. El token dice quién sos; el
   * permiso lo decide la base, en el momento.
   *
   * Es una lectura de una columna por clave primaria y solo en los pedidos del
   * panel, que son un puñado por sesión.
   */
  app.decorate('requireAdmin', async (request: FastifyRequest) => {
    await verificarToken(request);
    if (request.user.role !== 'admin') throw prohibido();

    // el admin de rescate por variables de entorno no tiene fila en `users`:
    // su `sub` es el nombre de usuario, no un uuid
    if (request.user.sub === config.ADMIN_USER) return;

    if ((await auth.roleOf(request.user.sub)) !== 'admin') throw prohibido();
  });

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
