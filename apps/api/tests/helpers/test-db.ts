import postgres from 'postgres';
import { runMigrations } from '../../src/db/migrate.js';

try {
  process.loadEnvFile('../../.env');
} catch {
  // variables por entorno (CI)
}

const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) throw new Error('DATABASE_URL no definida (necesaria para tests de integración)');

const TEST_DB = 'circuitos_test';

/** Crea una base de test limpia (drop + create) y aplica las migraciones. */
export async function createCleanTestDb(): Promise<string> {
  const admin = postgres(baseUrl!, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${TEST_DB}`);
  } finally {
    await admin.end();
  }
  const testUrl = new URL(baseUrl!);
  testUrl.pathname = `/${TEST_DB}`;
  await runMigrations(testUrl.toString());
  return testUrl.toString();
}
