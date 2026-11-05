/**
 * Worker del sitio. Los pedidos HTTP los siguen resolviendo los assets estáticos
 * (incluido el fallback SPA de `wrangler.jsonc`); el único código propio es el cron.
 *
 * Por qué existe: la API vive en el plan gratuito de Render, que la duerme a los
 * 15 minutos sin tráfico, y despertarla le cuesta casi un minuto al primer
 * visitante. El cron le pega al health cada 10 minutos y así nunca llega a dormirse.
 * El health no consulta la base a propósito: Neon también cobra por estar despierta
 * y su arranque en frío es de un segundo, no de un minuto.
 *
 * Los tipos van a mano para no sumar `@cloudflare/workers-types` por cuatro campos.
 */

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** Origen de la API, sin `/api/v1`. Lo pasa el workflow de despliegue. */
  API_URL: string;
}

interface ScheduledController {
  cron: string;
  scheduledTime: number;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

/** Render puede tardar casi un minuto en levantar si igual se durmió. */
const TIEMPO_MAXIMO_MS = 90_000;

async function despertarApi(apiUrl: string): Promise<void> {
  const respuesta = await fetch(`${apiUrl}/api/v1/health`, {
    headers: { 'user-agent': 'circuitos-keep-alive' },
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  });
  // tirar el error hace que la corrida figure como fallida en el panel de Cloudflare
  if (!respuesta.ok) throw new Error(`health respondió ${respuesta.status}`);
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },

  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(despertarApi(env.API_URL));
  },
};
