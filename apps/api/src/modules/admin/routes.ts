import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ACCESS_TYPES, CIRCUIT_STATUSES, DIFFICULTIES } from '@circuitos/shared';
import {
  createFieldsSchema,
  externalMapUrlSchema,
  latSchema,
  lonSchema,
  parseMultipartFields,
  parseSchedulesField,
  scheduleSchema,
  validarAlta,
} from '../../lib/campos-circuito.js';
import { badRequest } from '../../lib/errors.js';
import type { AdminService } from './service.js';

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
  rejectionReason: z.string().max(1000).nullable().optional(),
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

/**
 * Filtros de la lista del panel.
 *
 * `limit` tiene techo: sin él, un `?limit=100000` devuelve la tabla entera y
 * vuelve a ser el problema que la paginación viene a resolver. Los valores por
 * defecto hacen que un pedido sin querystring siga funcionando como antes.
 */
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  estado: z.enum(CIRCUIT_STATUSES).optional(),
  /*
   * Búsqueda por nombre. Se recorta y un `?q=` vacío vale lo mismo que no
   * mandarlo: el buscador del panel manda el campo aunque esté en blanco y no
   * tiene por qué recibir un 400 por eso.
   */
  q: z
    .string()
    .max(100)
    .optional()
    .transform((valor) => {
      const limpio = valor?.trim();
      return limpio ? limpio : undefined;
    }),
});

/**
 * Foto de un circuito para el panel.
 *
 * El nombre del archivo va como parámetro de ruta y no la URL entera como query:
 * así el `:id` viaja aparte y la pertenencia se puede comprobar contra la base
 * (`circuit_media.circuit_id = :id`) en vez de creerle a una cadena. El formato
 * queda acotado a lo que genera el propio servicio —marca de tiempo y extensión—,
 * así que ni barras ni puntos suspensivos entran.
 */
const mediaParamsSchema = z.object({
  id: z.uuid(),
  fileName: z.string().min(1).max(200).regex(/^[A-Za-z0-9._-]+$/),
});

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

    typed.get(
      '/admin/circuits',
      { schema: { querystring: listQuerySchema } },
      async (request) => {
        const { limit, offset, estado, q } = request.query;
        return service.list({ limit, offset, estado, q });
      },
    );

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

    /*
     * Borrado definitivo, separado del archivar de arriba a propósito: son dos
     * verbos distintos sobre el mismo recurso y este no se deshace. El servicio
     * exige que el circuito ya esté archivado o rechazado.
     *
     * No lleva guard propio: el `onRequest` del tope del plugin ya la protege.
     */
    typed.delete(
      '/admin/circuits/:id/definitivo',
      { schema: { params: idParamsSchema } },
      async (request, reply) => {
        await service.deleteForever(request.params.id);
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

    /*
     * Los bytes de una foto, sin importar en qué estado esté el circuito.
     *
     * `/media/:id/:archivo` es público y desde ahora sirve solo lo publicado, así
     * que el panel —que muestra borradores, propuestas y rechazados— pide por acá.
     * No lleva guard propio: el `onRequest` del tope del plugin ya la protege.
     */
    typed.get(
      '/admin/circuits/:id/media/:fileName',
      { schema: { params: mediaParamsSchema } },
      async (request, reply) => {
        const { id, fileName } = request.params;
        const { data, contentType } = await service.photo(id, fileName);
        return reply
          .header('content-type', contentType)
          // el nombre lleva la marca de tiempo de la subida: una URL siempre
          // devuelve la misma imagen. `private` porque la respuesta es con sesión
          // y no la puede guardar ningún caché compartido.
          .header('cache-control', 'private, max-age=31536000, immutable')
          .send(data);
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
