import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Config } from '../../config.js';
import { notFound } from '../../lib/errors.js';
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

const slugParams = z.object({ slug: z.string().min(1).max(200) });

export function circuitsRoutes(service: CircuitsService, config: Config) {
  return async function routes(app: FastifyInstance): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    // público: es lo que se ve en el mapa sin tener cuenta
    typed.get('/circuits', { schema: { querystring: listQuerySchema } }, async (request) => {
      const { lat, lon, radius_m, discipline, province } = request.query;
      return service.list({ lat, lon, radiusM: radius_m, discipline, province });
    });

    // la ficha completa exige sesión: el registro es el peaje para acceder al detalle,
    // y se controla acá porque hacerlo solo en el frontend sería decorativo
    typed.get(
      '/circuits/:slug',
      { preHandler: app.requireUser, schema: { params: slugParams } },
      async (request) => service.detail(request.params.slug),
    );

    // descarga del GPX original para Strava, Relive o el GPS
    typed.get(
      '/circuits/:slug/gpx',
      { preHandler: app.requireUser, schema: { params: slugParams } },
      async (request, reply) => {
        const circuit = await service.detail(request.params.slug);
        const file = path.join(config.GPX_DIR, `${circuit.slug}.gpx`);
        try {
          await stat(file);
        } catch {
          throw notFound('Este circuito no tiene archivo GPX disponible');
        }
        return reply
          .header('content-type', 'application/gpx+xml')
          .header('content-disposition', `attachment; filename="${circuit.slug}.gpx"`)
          .send(createReadStream(file));
      },
    );
  };
}
