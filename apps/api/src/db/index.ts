import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export function createDb(url: string) {
  const client = postgres(url, {
    onnotice: () => {},
    // Neon suspende la base a los 5 minutos sin consultas y corta las conexiones
    // abiertas. Con el default (`idle_timeout: 0`, nunca cerrar) el pool se queda
    // con sockets muertos, y desde que el cron mantiene la API despierta todo el
    // día, el primer pedido después de cada pausa los encontraría. Cerrarlas antes
    // que Neon y renovarlas cada media hora evita reusar una que ya no existe.
    idle_timeout: 60,
    max_lifetime: 60 * 30,
    connect_timeout: 15,
    // el contenedor gratuito de Render tiene 512 MB y una sola instancia
    max: 5,
  });
  return { db: drizzle(client, { schema }), client };
}

export type Db = ReturnType<typeof createDb>['db'];
