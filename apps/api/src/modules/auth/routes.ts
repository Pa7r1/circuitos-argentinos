import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AuthResponse, AuthUser, LoginResponse } from '@circuitos/shared';
import type { Config } from '../../config.js';
import type { AuthService } from './service.js';
import { verifyAdminCredentials } from './service.js';

/** Las puertas de entrada son el blanco de la fuerza bruta: límite propio y estricto. */
const RATE_LIMIT_ENTRADA = { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } };

const emailSchema = z.string().trim().toLowerCase().email().max(200);
const passwordSchema = z.string().min(8, 'mínimo 8 caracteres').max(200);

export function authRoutes(config: Config, service: AuthService) {
  return async function routes(app: FastifyInstance): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    function sign(user: AuthUser): string {
      return app.jwt.sign({ sub: user.id, role: user.role, name: user.name }, { expiresIn: '30d' });
    }

    // --- cuentas de usuario ---
    typed.post(
      '/register',
      {
        ...RATE_LIMIT_ENTRADA,
        schema: {
          body: z.object({
            name: z.string().trim().min(2, 'mínimo 2 caracteres').max(100),
            email: emailSchema,
            password: passwordSchema,
            discipline: z.string().max(50).optional(),
          }),
        },
      },
      async (request, reply): Promise<AuthResponse> => {
        const user = await service.register(request.body);
        return reply.status(201).send({ token: sign(user), user });
      },
    );

    typed.post(
      '/login',
      {
        ...RATE_LIMIT_ENTRADA,
        schema: { body: z.object({ email: emailSchema, password: z.string().min(1).max(200) }) },
      },
      async (request): Promise<AuthResponse> => {
        const user = await service.login(request.body.email, request.body.password);
        return { token: sign(user), user };
      },
    );

    typed.get(
      '/me',
      { preHandler: app.requireUser },
      async (request): Promise<AuthUser> => {
        const { sub, role, name } = request.user;
        // el admin por env no tiene fila en users
        if (role === 'admin' && sub === config.ADMIN_USER) {
          return { id: sub, name, email: '', role: 'admin', discipline: null };
        }
        return service.profile(sub);
      },
    );

    // --- puerta de servicio del admin único (credencial por variables de entorno) ---
    typed.post(
      '/admin/login',
      {
        ...RATE_LIMIT_ENTRADA,
        schema: {
          body: z.object({
            user: z.string().min(1).max(100),
            password: z.string().min(1).max(200),
          }),
        },
      },
      async (request): Promise<LoginResponse> => {
        const { user, password } = request.body;
        await verifyAdminCredentials(config, user, password);
        const token = app.jwt.sign({ sub: user, role: 'admin', name: user }, { expiresIn: '12h' });
        return { token };
      },
    );
  };
}
