import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ACCESS_TYPES, CIRCUIT_STATUSES, DIFFICULTIES, resolveExternalMap } from '@circuitos/shared';
import { badRequest } from '../../lib/errors.js';
import type { AdminService } from './service.js';

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'formato HH:MM');
const scheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  opens: timeSchema.nullish(),
  closes: timeSchema.nullish(),
  note: z.string().max(500).nullish(),
});

/**
 * Enlace a un recorrido de terceros. Se valida con el mismo catálogo que usa el
 * frontend, que además rechaza cualquier esquema que no sea http(s): el enlace lo
 * pega una persona y termina en un href.
 */
const externalMapUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((url) => resolveExternalMap(url) !== null, 'no parece un enlace http(s) válido');

const latSchema = z.coerce.number().min(-90).max(90);
const lonSchema = z.coerce.number().min(-180).max(180);

const createFieldsSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    discipline: z.string().min(1).max(50),
    province: z.string().min(1).max(50),
    locality: z.string().max(200).optional(),
    difficulty: z.enum(DIFFICULTIES),
    accessType: z.enum(ACCESS_TYPES),
    accessNotes: z.string().max(2000).optional(),
    schedules: z.array(scheduleSchema).max(7).optional(),
    externalMapUrl: externalMapUrlSchema.optional(),
    startLat: latSchema.optional(),
    startLon: lonSchema.optional(),
    distanceM: z.coerce.number().int().positive().max(1_000_000).optional(),
    elevationGainM: z.coerce.number().int().min(0).max(30_000).optional(),
  });

/**
 * Sin GPX no hay trazado, ni punto de partida, ni distancia: hay que mandarlos.
 * Se valida acá y no en el service porque es validación de entrada.
 */
function validarAlta(fields: z.infer<typeof createFieldsSchema>, tieneGpx: boolean): void {
  if (tieneGpx) return;
  if (!fields.externalMapUrl) {
    throw badRequest(
      'SIN_RECORRIDO',
      'Cargá el archivo GPX o el enlace al recorrido (Relive, Strava, Wikiloc…)',
    );
  }
  if (fields.startLat === undefined || fields.startLon === undefined) {
    throw badRequest('SIN_PUNTO', 'Sin GPX hay que marcar en el mapa dónde arranca el circuito');
  }
  if (fields.distanceM === undefined) {
    throw badRequest('SIN_DISTANCIA', 'Sin GPX hay que cargar la distancia del circuito');
  }
}

const updateBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  discipline: z.string().min(1).max(50).optional(),
  province: z.string().min(1).max(50).optional(),
  locality: z.string().max(200).nullable().optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  accessType: z.enum(ACCESS_TYPES).optional(),
  accessNotes: z.string().max(2000).nullable().optional(),
  status: z.enum(CIRCUIT_STATUSES).optional(),
  schedules: z.array(scheduleSchema).max(7).optional(),
  externalMapUrl: externalMapUrlSchema.nullable().optional(),
  distanceM: z.number().int().positive().max(1_000_000).optional(),
  elevationGainM: z.number().int().min(0).max(30_000).nullable().optional(),
  startLat: latSchema.optional(),
  startLon: lonSchema.optional(),
})
  .refine(
    (b) => (b.startLat === undefined) === (b.startLon === undefined),
    'startLat y startLon se mandan juntos o ninguno',
  );

const idParamsSchema = z.object({ id: z.uuid() });

/** Extrae los campos del multipart (attachFieldsToBody: 'keyValues'). */
function parseMultipartFields(body: unknown): {
  fields: Record<string, unknown>;
  files: Record<string, Buffer>;
} {
  if (typeof body !== 'object' || body === null) {
    throw badRequest('MULTIPART_INVALIDO', 'Se esperaba un formulario multipart');
  }
  const fields: Record<string, unknown> = {};
  const files: Record<string, Buffer> = {};
  for (const [key, value] of Object.entries(body)) {
    if (Buffer.isBuffer(value)) files[key] = value;
    else fields[key] = value;
  }
  return { fields, files };
}

function parseSchedulesField(fields: Record<string, unknown>): void {
  if (typeof fields.schedules === 'string') {
    try {
      fields.schedules = JSON.parse(fields.schedules);
    } catch {
      throw badRequest('HORARIOS_INVALIDOS', 'El campo schedules debe ser JSON válido');
    }
  }
}

export function adminRoutes(service: AdminService) {
  return async function routes(app: FastifyInstance): Promise<void> {
    /*
     * Todas las rutas de este scope exigen JWT de admin.
     *
     * Va en `onRequest` y no en `preHandler`: `preHandler` corre DESPUÉS de que
     * Fastify leyó el cuerpo, así que un anónimo podía hacernos bufferizar los
     * 5 MB de un multipart en memoria y recién entonces recibir el 401. Contra
     * el contenedor de 512 MB del plan gratuito eso es tirar la API sin tener
     * credenciales. Para verificar el token alcanzan las cabeceras.
     */
    app.addHook('onRequest', app.requireAdmin);

    // auditoría: toda acción admin deja rastro estructurado
    app.addHook('onResponse', (request, reply, done) => {
      request.log.info(
        {
          audit: true,
          adminUser: request.user?.sub,
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
        },
        'acción admin',
      );
      done();
    });

    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.get('/admin/stats', async () => service.stats());

    typed.get('/admin/circuits', async () => service.list());

    typed.get(
      '/admin/circuits/:id',
      { schema: { params: idParamsSchema } },
      async (request) => service.detail(request.params.id),
    );

    typed.post('/admin/circuits', async (request, reply) => {
      const { fields, files } = parseMultipartFields(request.body);
      parseSchedulesField(fields);
      const parsed = createFieldsSchema.safeParse(fields);
      if (!parsed.success) {
        const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        throw badRequest('VALIDACION', `Campos inválidos: ${detail}`);
      }
      validarAlta(parsed.data, files.gpx !== undefined);
      const created = await service.create(parsed.data, files.gpx ?? null);
      return reply.status(201).send(created);
    });

    typed.patch(
      '/admin/circuits/:id',
      { schema: { params: idParamsSchema, body: updateBodySchema } },
      async (request, reply) => {
        await service.update(request.params.id, request.body);
        return reply.status(204).send();
      },
    );

    // reemplazo del GPX como endpoint propio: PATCH queda JSON puro y el multipart vive acá
    typed.post(
      '/admin/circuits/:id/gpx',
      { schema: { params: idParamsSchema } },
      async (request, reply) => {
        const { files } = parseMultipartFields(request.body);
        if (!files.gpx) throw badRequest('GPX_FALTANTE', 'Falta el archivo GPX (campo "gpx")');
        await service.replaceGpx(request.params.id, files.gpx);
        return reply.status(204).send();
      },
    );

    typed.delete(
      '/admin/circuits/:id',
      { schema: { params: idParamsSchema } },
      async (request, reply) => {
        await service.archive(request.params.id);
        return reply.status(204).send();
      },
    );

    typed.delete(
      '/admin/circuits/:id/media',
      { schema: { params: idParamsSchema, body: z.object({ url: z.string().min(1).max(500) }) } },
      async (request, reply) => {
        await service.removeMedia(request.params.id, request.body.url);
        return reply.status(204).send();
      },
    );

    typed.post(
      '/admin/circuits/:id/media',
      { schema: { params: idParamsSchema } },
      async (request, reply) => {
        const { files } = parseMultipartFields(request.body);
        const file = Object.values(files)[0];
        if (!file) throw badRequest('IMAGEN_FALTANTE', 'Falta el archivo de imagen');
        const result = await service.addMedia(request.params.id, file);
        return reply.status(201).send(result);
      },
    );
  };
}
