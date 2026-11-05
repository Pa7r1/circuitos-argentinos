import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../worker/index';

const API_URL = 'https://api.ejemplo.test';

function crearEnv(): Env & { assetsFetch: ReturnType<typeof vi.fn> } {
  const assetsFetch = vi.fn(async () => new Response('<html></html>', { status: 200 }));
  return { API_URL, ASSETS: { fetch: assetsFetch }, assetsFetch };
}

function crearContexto() {
  const pendientes: Promise<unknown>[] = [];
  return {
    ctx: { waitUntil: (p: Promise<unknown>) => void pendientes.push(p) },
    esperar: () => Promise.all(pendientes),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('worker del sitio', () => {
  it('el cron le pega al health de la API para que Render no la duerma', async () => {
    const fetchMock = vi.fn(async () => new Response('{"status":"ok"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { ctx, esperar } = crearContexto();

    worker.scheduled({ cron: '*/10 * * * *', scheduledTime: 0 }, crearEnv(), ctx);
    await esperar();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe(`${API_URL}/api/v1/health`);
  });

  it('una respuesta que no es 2xx marca la corrida como fallida', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('no-server', { status: 503 })),
    );
    const { ctx, esperar } = crearContexto();

    worker.scheduled({ cron: '*/10 * * * *', scheduledTime: 0 }, crearEnv(), ctx);

    await expect(esperar()).rejects.toThrow('503');
  });

  it('los pedidos HTTP los siguen respondiendo los assets, sin tocar la API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const env = crearEnv();
    const pedido = new Request('https://sitio.test/circuitos/algo');

    const respuesta = await worker.fetch(pedido, env);

    expect(respuesta.status).toBe(200);
    expect(env.assetsFetch).toHaveBeenCalledWith(pedido);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
