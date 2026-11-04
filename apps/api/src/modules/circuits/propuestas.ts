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

/**
 * Las fotos van de a un pedido, así que el límite de las altas no les sirve: con el
 * mismo cubo de cinco, el primer circuito con sus tres fotos se comía casi todo el
 * día y al segundo le empezaban a fallar. Cinco propuestas por tres fotos cada una
 * son quince, que es el techo que corresponde a lo que ya se permite cargar.
 */
const RATE_LIMIT_FOTOS = { config: { rateLimit: { max: 15, timeWindow: '1 day' } } };

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
         *
         * El alta también corta la propuesta repetida: si esta persona ya tiene
         * una sin revisar con el mismo nombre, `create` tira PROPUESTA_DUPLICADA
         * (409) en vez de dejar dos filas. La comprobación vive en el servicio
         * porque la ruta no habla con la base.
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
        if (config.PROPUESTAS_EMAIL) {
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
        } else {
          request.log.warn({ circuito: parsed.data.name }, 'sin PROPUESTAS_EMAIL: la propuesta no se avisa');
        }

        return reply.status(201).send(creado);
      },
    );

    /** Las fotos van de a una, como en el panel: el multipart admite un archivo por pedido. */
    typed.post(
      '/circuits/propuestas/:id/media',
      {
        onRequest: app.requireUser,
        ...RATE_LIMIT_FOTOS,
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
        const result = await service.addMediaDePropuesta(request.params.id, request.user.sub, file);
        /*
         * El cuerpo va sí o sí: el cliente trata una respuesta sin JSON (que no sea
         * 204) como un build sin VITE_API_URL y falla con un mensaje que no tiene
         * nada que ver. Además la `url` es lo que la vista necesita para mostrar la
         * foto recién subida.
         */
        return reply.status(201).send(result);
      },
    );
  };
}
