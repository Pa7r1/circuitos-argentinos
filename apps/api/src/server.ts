import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/index.js';

try {
  process.loadEnvFile('../../.env');
} catch {
  // en docker/CI las variables llegan por entorno
}

const config = loadConfig();
const { db, client } = createDb(config.DATABASE_URL);
const app = await buildApp(config, db);

app.addHook('onClose', async () => {
  await client.end();
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: config.PORT, host: '0.0.0.0' });
