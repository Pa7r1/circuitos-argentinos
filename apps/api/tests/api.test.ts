import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { CircuitDetail, CircuitSummary, LoginResponse } from '@circuitos/shared';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { createDb } from '../src/db/index.js';
import { runSeed } from '../src/db/seed.js';
import { createCleanTestDb } from './helpers/test-db.js';

const ADMIN_PASSWORD = 'clave-de-test-123';
const gpxFixture = readFileSync(path.join(import.meta.dirname, 'fixtures/track.gpx'));

/** Cuerpo multipart armado a mano para inyectar en fastify. */
function multipart(parts: { name: string; data: Buffer | string; filename?: string }[]): {
  payload: Buffer;
  headers: Record<string, string>;
} {
  const boundary = '----test-boundary-42';
  const chunks: Buffer[] = [];
  for (const part of parts) {
    const disposition = part.filename
      ? `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\nContent-Type: application/octet-stream\r\n`
      : `Content-Disposition: form-data; name="${part.name}"\r\n`;
    chunks.push(Buffer.from(`--${boundary}\r\n${disposition}\r\n`));
    chunks.push(Buffer.isBuffer(part.data) ? part.data : Buffer.from(part.data));
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

let app: FastifyInstance;
let client: ReturnType<typeof createDb>['client'];
let db: ReturnType<typeof createDb>['db'];
let token: string;
/** sesión de usuario común: la ficha ahora exige registro */
let userAuth: { authorization: string };

beforeAll(async () => {
  const testUrl = await createCleanTestDb();
  await runSeed(testUrl);

  const config: Config = {
    NODE_ENV: 'test',
    DATABASE_URL: testUrl,
    PORT: 0,
    CORS_ORIGIN: ['http://localhost:5173'],
    ADMIN_USER: 'admin',
    ADMIN_PASSWORD_HASH: bcrypt.hashSync(ADMIN_PASSWORD, 4),
    JWT_SECRET: 'secreto-de-test-suficientemente-largo-1234',
  };

  const created = createDb(testUrl);
  client = created.client;
  db = created.db;
  app = await buildApp(config, created.db);

  const registro = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { name: 'Lector', email: 'lector@ejemplo.com', password: 'password-de-prueba' },
  });
  userAuth = { authorization: `Bearer ${registro.json<{ token: string }>().token}` };
});

afterAll(async () => {
  await app?.close();
  await client?.end();
});

describe('health y públicos', () => {
  it('GET /health responde ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('GET /circuits lista solo publicados, respuesta liviana sin track', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/circuits' });
    expect(res.statusCode).toBe(200);
    const list = res.json<CircuitSummary[]>();
    expect(list.map((c) => c.slug)).toContain('quebrada-del-condor');
    expect(list[0]).not.toHaveProperty('track');
    expect(list[0]!.startPoint.type).toBe('Point');
  });

  it('GET /circuits con lat/lon devuelve metersAway y filtra por radio', async () => {
    const cerca = await app.inject({
      method: 'GET',
      url: '/api/v1/circuits?lat=-29.4131&lon=-66.8558&radius_m=50000',
    });
    const list = cerca.json<CircuitSummary[]>();
    expect(list[0]?.metersAway).toBeTypeOf('number');

    const lejos = await app.inject({
      method: 'GET',
      url: '/api/v1/circuits?lat=-34.6&lon=-58.4&radius_m=10000',
    });
    expect(lejos.json<CircuitSummary[]>()).toHaveLength(0);
  });

  it('GET /circuits rechaza lat sin lon', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/circuits?lat=-29.4' });
    expect(res.statusCode).toBe(400);
  });

  /**
   * Con la web y la API en dominios distintos, el navegador pide permiso antes de
   * cada PATCH o DELETE. El default de @fastify/cors solo habilita GET/HEAD/POST:
   * publicar y archivar morían en el preflight, sin llegar nunca al servidor.
   */
  it('el preflight de CORS habilita PATCH y DELETE para el panel', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/admin/circuits/00000000-0000-0000-0000-000000000000',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'PATCH',
        'access-control-request-headers': 'authorization,content-type',
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const metodos = String(res.headers['access-control-allow-methods']);
    expect(metodos).toContain('PATCH');
    expect(metodos).toContain('DELETE');
    expect(String(res.headers['access-control-allow-headers']).toLowerCase()).toContain(
      'authorization',
    );
  });

  it('GET /circuits/:slug devuelve la ficha completa con track', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/circuits/quebrada-del-condor',
      headers: userAuth,
    });
    expect(res.statusCode).toBe(200);
    const detail = res.json<CircuitDetail>();
    expect(detail.track.type).toBe('LineString');
    expect(detail.track.coordinates.length).toBeGreaterThanOrEqual(20);
    expect(detail.provinceName).toBe('La Rioja');
  });

  it('GET /circuits/:slug → 404 si no existe', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/circuits/no-existe',
      headers: userAuth,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).not.toHaveProperty('stack');
  });
});

describe('auth', () => {
  it('rechaza credenciales inválidas con 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/admin/login',
      payload: { user: 'admin', password: 'incorrecta' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('devuelve JWT con credenciales válidas', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/admin/login',
      payload: { user: 'admin', password: ADMIN_PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    token = res.json<LoginResponse>().token;
    expect(token.split('.')).toHaveLength(3);
  });

  it('las rutas admin sin token devuelven 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/circuits' });
    expect(res.statusCode).toBe(401);
  });
});

describe('flujo admin completo', () => {
  let circuitId: string;
  let circuitSlug: string;
  let fotoUrl: string;

  it('crea un circuito desde un GPX (multipart) en draft', async () => {
    const body = multipart([
      { name: 'gpx', data: gpxFixture, filename: 'vuelta.gpx' },
      { name: 'name', data: 'Vuelta del Zonda' },
      { name: 'discipline', data: 'enduro' },
      { name: 'province', data: 'la-rioja' },
      { name: 'difficulty', data: 'dificil' },
      { name: 'accessType', data: 'con_permiso' },
      { name: 'accessNotes', data: 'Pedir permiso en el club' },
      { name: 'schedules', data: JSON.stringify([{ dayOfWeek: 6, opens: '09:00', closes: '18:00' }]) },
    ]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/circuits',
      headers: { ...body.headers, authorization: `Bearer ${token}` },
      payload: body.payload,
    });
    expect(res.statusCode).toBe(201);
    const created = res.json<{ id: string; slug: string }>();
    circuitId = created.id;
    circuitSlug = created.slug;
    expect(circuitSlug).toBe('vuelta-del-zonda');
  });

  it('rechaza un GPX inválido con 400 y mensaje claro', async () => {
    const body = multipart([
      { name: 'gpx', data: 'no soy un gpx', filename: 'malo.gpx' },
      { name: 'name', data: 'Inválido' },
      { name: 'discipline', data: 'enduro' },
      { name: 'province', data: 'la-rioja' },
      { name: 'difficulty', data: 'facil' },
      { name: 'accessType', data: 'libre' },
    ]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/circuits',
      headers: { ...body.headers, authorization: `Bearer ${token}` },
      payload: body.payload,
    });
    expect(res.statusCode).toBe(400);
  });

  it('el draft no aparece en el listado público', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/circuits' });
    expect(res.json<CircuitSummary[]>().map((c) => c.slug)).not.toContain(circuitSlug);
  });

  it('publica el circuito vía PATCH y aparece en público con schedules', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/circuits/${circuitId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'published' },
    });
    expect(patch.statusCode).toBe(204);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/circuits/${circuitSlug}`,
      headers: userAuth,
    });
    expect(res.statusCode).toBe(200);
    const detail = res.json<CircuitDetail>();
    expect(detail.schedules).toEqual([
      { dayOfWeek: 6, opens: '09:00', closes: '18:00', note: null },
    ]);
    expect(detail.accessType).toBe('con_permiso');
    expect(detail.elevationGainM).toBe(41);
    expect(detail.hasGpx).toBe(true);
    expect(detail.track?.coordinates.length).toBeGreaterThan(1);
  });

  /**
   * En producción hay circuitos con el GPX guardado y `gpx_url` en null. Si el
   * indicador se calculara con esa columna, la descarga desaparecería de una
   * ficha que sí tiene archivo.
   */
  it('hasGpx mira el archivo guardado, no la columna gpx_url', async () => {
    await db.execute(sql`UPDATE circuits SET gpx_url = NULL WHERE id = ${circuitId}`);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/circuits/${circuitSlug}`,
      headers: userAuth,
    });
    expect(res.json<CircuitDetail>().hasGpx).toBe(true);
  });

  it('sube una imagen válida y rechaza un archivo que no es imagen', async () => {
    const fakePng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64),
    ]);
    const ok = multipart([{ name: 'file', data: fakePng, filename: 'foto.png' }]);
    const okRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/circuits/${circuitId}/media`,
      headers: { ...ok.headers, authorization: `Bearer ${token}` },
      payload: ok.payload,
    });
    expect(okRes.statusCode).toBe(201);
    expect(okRes.json<{ url: string }>().url).toMatch(/^\/media\//);

    const bad = multipart([{ name: 'file', data: Buffer.from('no imagen'), filename: 'x.txt' }]);
    const badRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/circuits/${circuitId}/media`,
      headers: { ...bad.headers, authorization: `Bearer ${token}` },
      payload: bad.payload,
    });
    expect(badRes.statusCode).toBe(400);

    // la foto se guarda en la base: se recupera por su URL, sin pasar por el disco
    fotoUrl = okRes.json<{ url: string }>().url;
    const foto = await app.inject({ method: 'GET', url: fotoUrl });
    expect(foto.statusCode).toBe(200);
    expect(foto.headers['content-type']).toBe('image/png');
    expect(foto.rawPayload.equals(fakePng)).toBe(true);
  });

  it('la foto se sirve sin sesión y cacheada, y da 404 si no existe', async () => {
    const foto = await app.inject({ method: 'GET', url: fotoUrl });
    expect(foto.headers['cache-control']).toContain('immutable');

    const inexistente = await app.inject({ method: 'GET', url: `/media/${circuitId}/999.png` });
    expect(inexistente.statusCode).toBe(404);
  });

  it('borrar la foto la quita de la base y deja de servirse', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/circuits/${circuitId}/media`,
      headers: { authorization: `Bearer ${token}` },
      payload: { url: fotoUrl },
    });
    expect(del.statusCode).toBe(204);
    const foto = await app.inject({ method: 'GET', url: fotoUrl });
    expect(foto.statusCode).toBe(404);
  });

  it('descarga el GPX original del circuito creado, guardado en la base', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/circuits/${circuitSlug}/gpx`,
      headers: userAuth,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/gpx+xml');
    expect(res.headers['content-disposition']).toContain(`${circuitSlug}.gpx`);
    // los bytes son exactamente los que se subieron, no una reconstrucción
    expect(res.rawPayload.equals(gpxFixture)).toBe(true);
  });

  it('DELETE archiva (soft delete): desaparece de público pero sigue en admin', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/circuits/${circuitId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);

    const pub = await app.inject({
      method: 'GET',
      url: `/api/v1/circuits/${circuitSlug}`,
      headers: userAuth,
    });
    expect(pub.statusCode).toBe(404);

    const admin = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/circuits',
      headers: { authorization: `Bearer ${token}` },
    });
    const item = admin
      .json<{ slug: string; status: string }[]>()
      .find((c) => c.slug === circuitSlug);
    expect(item?.status).toBe('archived');
  });
});

/**
 * Desde Relive o Strava no se puede exportar el GPX, así que el circuito se carga
 * con el enlace al recorrido y el punto marcado a mano.
 */
describe('alta con enlace al recorrido, sin GPX', () => {
  // el nombre va por parámetro: repetir el campo en el multipart lo convierte en
  // un arreglo y la validación se cae por otro motivo del que se quiere probar
  const campos = (nombre: string) => [
    { name: 'name', data: nombre },
    { name: 'discipline', data: 'enduro' },
    { name: 'province', data: 'la-rioja' },
    { name: 'difficulty', data: 'intermedio' },
    { name: 'accessType', data: 'libre' },
  ];

  let slug: string;

  it('crea el circuito con enlace, punto y distancia', async () => {
    const body = multipart([
      ...campos('Cerro de la Cruz'),
      { name: 'externalMapUrl', data: 'https://www.relive.com/view/vKv23E8PxoO' },
      { name: 'startLat', data: '-29.42' },
      { name: 'startLon', data: '-66.84' },
      { name: 'distanceM', data: '18000' },
      { name: 'elevationGainM', data: '600' },
    ]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/circuits',
      headers: { ...body.headers, authorization: `Bearer ${token}` },
      payload: body.payload,
    });
    expect(res.statusCode).toBe(201);
    const created = res.json<{ id: string; slug: string }>();
    slug = created.slug;

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/circuits/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'published' },
    });
    expect(patch.statusCode).toBe(204);
  });

  it('la ficha trae el enlace, sin trazado y sin descarga de GPX', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/circuits/${slug}`,
      headers: userAuth,
    });
    expect(res.statusCode).toBe(200);
    const detail = res.json<CircuitDetail>();
    expect(detail.track).toBeNull();
    expect(detail.hasGpx).toBe(false);
    expect(detail.externalMapUrl).toBe('https://www.relive.com/view/vKv23E8PxoO');
    expect(detail.distanceM).toBe(18000);
    expect(detail.startPoint.coordinates[1]).toBeCloseTo(-29.42, 5);

    // aparece en el mapa público como cualquier otro
    const lista = await app.inject({ method: 'GET', url: '/api/v1/circuits' });
    expect(lista.json<CircuitSummary[]>().map((c) => c.slug)).toContain(slug);
  });

  it('sin GPX no hay descarga: 404 en vez de un archivo roto', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/circuits/${slug}/gpx`,
      headers: userAuth,
    });
    expect(res.statusCode).toBe(404);
  });

  it('rechaza el alta sin GPX y sin enlace', async () => {
    const body = multipart(campos('Sin nada'));
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/circuits',
      headers: { ...body.headers, authorization: `Bearer ${token}` },
      payload: body.payload,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ code: string }>().code).toBe('SIN_RECORRIDO');
  });

  it('rechaza el alta con enlace pero sin punto de partida', async () => {
    const body = multipart([
      ...campos('Sin punto'),
      { name: 'externalMapUrl', data: 'https://www.relive.com/view/otroId' },
      { name: 'distanceM', data: '5000' },
    ]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/circuits',
      headers: { ...body.headers, authorization: `Bearer ${token}` },
      payload: body.payload,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ code: string }>().code).toBe('SIN_PUNTO');
  });

  it('rechaza un enlace que no sea http(s)', async () => {
    const body = multipart([
      ...campos('Enlace raro'),
      { name: 'externalMapUrl', data: 'javascript:alert(1)' },
      { name: 'startLat', data: '-29.4' },
      { name: 'startLon', data: '-66.8' },
      { name: 'distanceM', data: '5000' },
    ]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/circuits',
      headers: { ...body.headers, authorization: `Bearer ${token}` },
      payload: body.payload,
    });
    expect(res.statusCode).toBe(400);
  });
});
