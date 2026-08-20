import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Config } from '../../config.js';
import {
  createFieldsSchema,
  parseMultipartFields,
  validarAlta,
} from '../../lib/campos-circuito.js';
import { enviarEmail } from '../../lib/email.js';
import { badRequest } from '../../lib/errors.js';
import type { AdminService } from '../admin/service.js';

/**
 * Circuitos propuestos por la comunidad.
 *
 * Vive en el módulo `circuits` y no en `admin` porque lo usa cualquier persona con
 * cuenta: el plugin de admin tiene un `onRequest` que exige rol de administrador
 * al tope, y una ruta acá adentro nacería cerrada para todo el mundo.
 *
 * Nada de lo que llega entra al mapa: el alta fuerza `status: 'propuesto'` y el
 * mapa solo devuelve `published`.
 */

/**
 * Un formulario público de escritura sin límite es una invitación. Cinco por día
 * alcanza de sobra para alguien que carga los circuitos que conoce, y corta el
 * envío automatizado. El `trustProxy` del servidor es lo que hace que el límite sea
 * por visitante y no un cubo único compartido detrás del proxy de Render.
 */
const RATE_LIMIT_PROPUESTAS = { config: { rateLimit: { max: 5, timeWindow: '1 day' } } };

/** Lo mínimo para poder devolver el llamado: no se valida el formato, que varía. */
const telefonoSchema = z.string().trim().min(6, 'teléfono demasiado corto').max(40);

export function propuestasRoutes(config: Config, service: AdminService) {
  return async function routes(app: FastifyInstance): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.post(
      '/circuits/propuestas',
      {
        /*
         * `onRequest` y no `preHandler`: es multipart, y `preHandler` corre después
         * de que Fastify leyó el cuerpo. Con el guard ahí, cualquiera sin cuenta
         * podía hacer bufferizar el archivo entero antes de recibir el 401.
         */
        onRequest: app.requireUser,
        ...RATE_LIMIT_PROPUESTAS,
      },
      async (request, reply) => {
        const { fields, files } = parseMultipartFields(request.body);

        const telefono = telefonoSchema.safeParse(fields.contactPhone);
        if (!telefono.success) {
          throw badRequest('SIN_TELEFONO', 'Dejanos un teléfono para poder contactarte');
        }

        const parsed = createFieldsSchema.safeParse(fields);
        if (!parsed.success) {
          throw badRequest('CAMPOS_INVALIDOS', parsed.error.issues[0]?.message ?? 'Datos inválidos');
        }
        validarAlta(parsed.data, files.gpx !== undefined);

        /*
         * El estado y el autor los pone el servidor, nunca el cuerpo del pedido:
         * si no, cualquiera con cuenta se publicaría el circuito solo.
         */
        const creado = await service.create(parsed.data, files.gpx ?? null, {
          status: 'propuesto',
          createdBy: request.user.sub,
          contactPhone: telefono.data,
        });

        /*
         * El aviso va después de guardar y no bloquea la respuesta: perder una
         * propuesta porque el correo falló sería el peor resultado posible.
         */
        void enviarEmail(
          config,
          request.log,
          config.PROPUESTAS_EMAIL,
          `Circuito propuesto: ${parsed.data.name}`,
          [
            `${request.user.name} propuso "${parsed.data.name}" (${parsed.data.locality ?? 'sin localidad'}).`,
            `Teléfono: ${telefono.data}`,
            '',
            `Revisalo en ${config.APP_URL}/admin`,
          ].join('\n'),
        ).catch((error: unknown) => request.log.error({ error }, 'no se pudo avisar la propuesta'));

        return reply.status(201).send(creado);
      },
    );

    /** Las fotos van de a una, como en el panel: el multipart admite un archivo por pedido. */
    typed.post(
      '/circuits/propuestas/:id/media',
      {
        onRequest: app.requireUser,
        ...RATE_LIMIT_PROPUESTAS,
        schema: { params: z.object({ id: z.uuid() }) },
      },
      async (request, reply) => {
        const { files } = parseMultipartFields(request.body);
        const file = Object.values(files)[0];
        if (!file) throw badRequest('IMAGEN_FALTANTE', 'Falta el archivo de imagen');

        /*
         * Solo sobre la propia propuesta y mientras siga sin revisar: sin esta
         * comprobación, cualquiera con cuenta podría pegarle fotos a un circuito
         * publicado ajeno con solo saber su id.
         */
        await service.addMediaDePropuesta(request.params.id, request.user.sub, file);
        return reply.status(201).send();
      },
    );
  };
}
