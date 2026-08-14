import { z } from 'zod';

/**
 * Una variable definida pero vacía vale lo mismo que no definida.
 *
 * Los paneles guardan `''` cuando dejás el campo en blanco (y `VAR=` en un .env
 * hace lo mismo), y con la cadena vacía ni `.optional()` ni `.default()` entran:
 * el valor existe, así que se valida, falla, y **el proceso no arranca**. Pasó de
 * verdad en Render con `RESEND_API_KEY` en blanco: la API quedó sin desplegar con
 * un `Too small: expected string to have >=1 characters` que no dice nada de esto.
 *
 * Solo se aplica a lo opcional. Si falta una obligatoria —la base, el secreto del
 * token, la credencial del admin— que el arranque falle es exactamente lo que se
 * quiere.
 */
const vacioEsIndefinido = (valor: unknown) =>
  typeof valor === 'string' && valor.trim() === '' ? undefined : valor;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().startsWith('postgres'),
  PORT: z.coerce.number().int().positive().default(3000),
  // varios orígenes separados por coma (ej: dominio propio + subdominio de respaldo).
  // Se recortan los espacios: un origen con espacio adelante no coincide con
  // ninguno real y el navegador lo rechaza sin dejar rastro en el servidor.
  CORS_ORIGIN: z
    .string()
    .transform((valor) =>
      valor
        .split(',')
        .map((origen) => origen.trim())
        .filter(Boolean),
    )
    .refine((origenes) => origenes.length > 0, 'debe tener al menos un origen'),
  ADMIN_USER: z.string().min(1),
  ADMIN_PASSWORD_HASH: z.string().startsWith('$2', 'debe ser un hash bcrypt'),
  JWT_SECRET: z.string().min(32, 'mínimo 32 caracteres'),

  /*
   * Correo saliente (hoy solo para recuperar la contraseña). Es opcional a
   * propósito: sin la clave, el enlace se escribe en el log en vez de enviarse,
   * y así el flujo se puede probar entero en desarrollo sin dar de alta ninguna
   * cuenta de correo. En producción tiene que estar.
   */
  RESEND_API_KEY: z.preprocess(vacioEsIndefinido, z.string().min(1).optional()),
  EMAIL_FROM: z.preprocess(
    vacioEsIndefinido,
    z.string().default('Circuitos Argentinos <no-responder@makkem.com>'),
  ),
  /** Base para armar el enlace del correo. Es el sitio, no la API. */
  APP_URL: z.preprocess(vacioEsIndefinido, z.string().url().default('http://localhost:5173')),
});

export type Config = z.infer<typeof envSchema>;

/** Valida el entorno al arranque (fail-fast): si falta algo el proceso no arranca. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuración de entorno inválida:\n${detail}`);
  }
  return parsed.data;
}
