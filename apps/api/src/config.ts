import { z } from 'zod';

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
