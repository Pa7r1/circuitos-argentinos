import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile('../../.env');
} catch {
  // en docker/CI las variables llegan por entorno
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL no definida');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
});
