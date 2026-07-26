import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ACCESS_TYPES, CIRCUIT_STATUSES, DIFFICULTIES } from '@circuitos/shared';
import { badRequest } from '../../lib/errors.js';
import type { AdminService } from './service.js';

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'formato HH:MM');
const scheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  opens: timeSchema.nullish(),
  closes: timeSchema.nullish(),
  note: z.string().max(500).nullish(),
});

const createFieldsSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  discipline: z.string().min(1).max(50),
  province: z.string().min(1).max(50),
  locality: z.string().max(200).optional(),
  difficulty: z.enum(DIFFICULTIES),
  accessType: z.enum(ACCESS_TYPES),
  accessNotes: z.string().max(2000).optional(),
  schedules: z.array(scheduleSchema).max(7).optional(),
});

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
});

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
    // todas las rutas de este scope exigen JWT de admin
    app.addHook('preHandler', app.requireAdmin);

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
      if (!files.gpx) throw badRequest('GPX_FALTANTE', 'Falta el archivo GPX (campo "gpx")');
      parseSchedulesField(fields);
      const parsed = createFieldsSchema.safeParse(fields);
      if (!parsed.success) {
        const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        throw badRequest('VALIDACION', `Campos inválidos: ${detail}`);
      }
      const created = await service.create(parsed.data, files.gpx);
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
