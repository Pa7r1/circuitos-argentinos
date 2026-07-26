import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { CircuitsService } from './service.js';

const listQuerySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    radius_m: z.coerce.number().int().positive().max(200_000).default(50_000),
    discipline: z.string().max(50).optional(),
    province: z.string().max(50).optional(),
  })
  .refine((q) => (q.lat === undefined) === (q.lon === undefined), {
    message: 'lat y lon deben enviarse juntos o ninguno',
  });

export function circuitsRoutes(service: CircuitsService) {
  return async function routes(app: FastifyInstance): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.get('/circuits', { schema: { querystring: listQuerySchema } }, async (request) => {
      const { lat, lon, radius_m, discipline, province } = request.query;
      return service.list({ lat, lon, radiusM: radius_m, discipline, province });
    });

    typed.get(
      '/circuits/:slug',
      { schema: { params: z.object({ slug: z.string().min(1).max(200) }) } },
      async (request) => service.detail(request.params.slug),
    );
  };
}
