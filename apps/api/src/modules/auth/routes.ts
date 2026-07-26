import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { LoginResponse } from '@circuitos/shared';
import type { Config } from '../../config.js';
import { verifyAdminCredentials } from './service.js';

export function authRoutes(config: Config) {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.withTypeProvider<ZodTypeProvider>().post(
      '/admin/login',
      {
        config: {
          // el login es el blanco de fuerza bruta: límite propio, más estricto
          rateLimit: { max: 5, timeWindow: '1 minute' },
        },
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
        const token = await app.jwt.sign({ sub: user, role: 'admin' }, { expiresIn: '12h' });
        return { token };
      },
    );
  };
}
