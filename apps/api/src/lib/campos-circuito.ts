/**
 * Validación de entrada de un circuito, compartida por el panel y por las
 * propuestas de la comunidad.
 *
 * Vive fuera de `modules/admin` porque la usan dos módulos: duplicarla
 * garantizaba que dentro de unos meses cada lado validara distinto, y los dos
 * escriben en la misma tabla con las mismas restricciones.
 */
import { z } from 'zod';
import { ACCESS_TYPES, DIFFICULTIES, resolveExternalMap } from '@circuitos/shared';
import { badRequest } from './errors.js';

export const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'formato HH:MM');
export const scheduleSchema = z.object({
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
export const externalMapUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((url) => resolveExternalMap(url) !== null, 'no parece un enlace http(s) válido');

export const latSchema = z.coerce.number().min(-90).max(90);
export const lonSchema = z.coerce.number().min(-180).max(180);

export const createFieldsSchema = z
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
export function validarAlta(fields: z.infer<typeof createFieldsSchema>, tieneGpx: boolean): void {
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

/** Extrae los campos del multipart (attachFieldsToBody: 'keyValues'). */
export function parseMultipartFields(body: unknown): {
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

export function parseSchedulesField(fields: Record<string, unknown>): void {
  if (typeof fields.schedules === 'string') {
    try {
      fields.schedules = JSON.parse(fields.schedules);
    } catch {
      throw badRequest('HORARIOS_INVALIDOS', 'El campo schedules debe ser JSON válido');
    }
  }
}
