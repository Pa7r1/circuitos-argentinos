import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AdminCircuitList, AdminStats, CircuitStatus } from '@circuitos/shared';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { createDb } from '../src/db/index.js';
import { runSeed } from '../src/db/seed.js';
import { createCleanTestDb } from './helpers/test-db.js';

const ADMIN_PASSWORD = 'clave-de-test-123';
const gpxFixture = readFileSync(path.join(import.meta.dirname, 'fixtures/track.gpx'));

/** Cabecera PNG real: el servicio valida el tipo por los primeros bytes. */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);

/** Cuerpo multipart armado a mano: fastify no arma cuerpos, los parsea. */
function multipart(parts: { name: string; data: Buffer | string; filename?: string }[]): {
  payload: Buffer;
  headers: Record<string, string>;
} {
  const boundary = '----test-boundary-admin-lista';
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

/**
 * Las propuestas están limitadas a 5 por día y por visitante, y el cubo sale de
 * `request.ip`, que con `trustProxy` viene de esta cabecera: una IP propia por
 * caso evita que un test le agote la cuota al siguiente.
 */
const desde = (ip: string) => ({ 'x-forwarded-for': ip });

const CAMPOS_PROPUESTA = {
  discipline: 'enduro',
  province: 'la-rioja',
  difficulty: 'intermedio',
  accessType: 'libre',
  contactPhone: '3804-123456',
  externalMapUrl: 'https://www.relive.com/view/vQvykNrjW46',
  startLat: '-29.16',
  startLon: '-67.5',
  distanceM: '12500',
};

let app: FastifyInstance;
let client: ReturnType<typeof createDb>['client'];
let adminAuth: { authorization: string };
let vecino: { authorization: string };

/** Manda una propuesta como el vecino. Cada una desde su propia IP. */
async function proponer(name: string, ip: string) {
  const cuerpo = multipart(
    Object.entries({ ...CAMPOS_PROPUESTA, name }).map(([n, data]) => ({ name: n, data })),
  );
  return app.inject({
    method: 'POST',
    url: '/api/v1/circuits/propuestas',
    headers: { ...cuerpo.headers, ...vecino, ...desde(ip) },
    payload: cuerpo.payload,
  });
}

/** Alta desde el panel. Devuelve el id del circuito creado. */
async function crearDesdeElPanel(
  name: string,
  extras: { name: string; data: Buffer | string; filename?: string }[] = [],
): Promise<string> {
  const cuerpo = multipart([
    { name: 'name', data: name },
    { name: 'discipline', data: 'enduro' },
    { name: 'province', data: 'la-rioja' },
    { name: 'difficulty', data: 'facil' },
    { name: 'accessType', data: 'libre' },
    { name: 'startLat', data: '-29.4' },
    { name: 'startLon', data: '-66.8' },
    { name: 'distanceM', data: '5000' },
    // sin GPX el alta exige el enlace; con GPX sobra y no molesta
    { name: 'externalMapUrl', data: 'https://www.relive.com/view/vQvykNrjW46' },
    ...extras,
  ]);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/circuits',
    headers: { ...cuerpo.headers, ...adminAuth },
    payload: cuerpo.payload,
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

async function cambiarEstado(id: string, status: CircuitStatus): Promise<void> {
  const res = await app.inject({
    method: 'PATCH',
    url: `/api/v1/admin/circuits/${id}`,
    headers: adminAuth,
    payload: { status },
  });
  expect(res.statusCode).toBe(204);
}

function listar(query = ''): Promise<AdminCircuitList> {
  return app
    .inject({ method: 'GET', url: `/api/v1/admin/circuits${query}`, headers: adminAuth })
    .then((res) => {
      expect(res.statusCode).toBe(200);
      return res.json<AdminCircuitList>();
    });
}

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
    EMAIL_FROM: 'Circuitos <no-responder@ejemplo.com>',
    APP_URL: 'http://localhost:5173',
    PROPUESTAS_EMAIL: 'admin@test.local',
  };

  const created = createDb(testUrl);
  client = created.client;
  app = await buildApp(config, created.db);

  const registro = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { name: 'Vecino', email: 'vecino@ejemplo.com', password: 'clave-de-prueba' },
  });
  vecino = { authorization: `Bearer ${registro.json<{ token: string }>().token}` };

  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/admin/login',
    payload: { user: 'admin', password: ADMIN_PASSWORD },
  });
  adminAuth = { authorization: `Bearer ${login.json<{ token: string }>().token}` };
});

afterAll(async () => {
  await app?.close();
  await client?.end();
});

describe('propuestas repetidas', () => {
  it('la segunda propuesta con el mismo nombre se rechaza en vez de duplicar la fila', async () => {
    expect((await proponer('Cerro Blanco', '10.1.0.1')).statusCode).toBe(201);

    // mayúsculas distintas y espacios de sobra: quien reintenta no lo escribe igual
    const repetida = await proponer('  cerro   BLANCO ', '10.1.0.2');
    expect(repetida.statusCode).toBe(409);
    expect(repetida.json<{ code: string }>().code).toBe('PROPUESTA_DUPLICADA');

    const { total } = await listar('?estado=propuesto&limit=100');
    expect(total).toBe(1);
  });

  it('otro nombre de la misma persona entra sin problema', async () => {
    expect((await proponer('Cerro Negro', '10.1.0.3')).statusCode).toBe(201);
  });

  it('volver a proponer un circuito que fue rechazado sí entra', async () => {
    const { items } = await listar('?estado=propuesto&limit=100');
    const blanco = items.find((c) => c.name === 'Cerro Blanco');
    await cambiarEstado(blanco!.id, 'rechazado');

    expect((await proponer('Cerro Blanco', '10.1.0.4')).statusCode).toBe(201);
  });
});

describe('lista paginada del panel', () => {
  it('limit y offset recortan la página y el total no cambia', async () => {
    const todo = await listar('?limit=100');
    expect(todo.total).toBe(todo.items.length);

    const primera = await listar('?limit=2');
    expect(primera.items).toHaveLength(2);
    expect(primera.total).toBe(todo.total);
    expect(primera.limit).toBe(2);

    const segunda = await listar('?limit=2&offset=2');
    expect(segunda.offset).toBe(2);
    expect(segunda.items.map((c) => c.id)).toEqual(todo.items.slice(2, 4).map((c) => c.id));
    // ninguna fila aparece en las dos páginas
    const ids = new Set([...primera.items, ...segunda.items].map((c) => c.id));
    expect(ids.size).toBe(primera.items.length + segunda.items.length);
  });

  it('ordena publicados, después propuestos, después archivados y el resto al final', async () => {
    const borrador = await crearDesdeElPanel('Borrador de prueba');
    const archivado = await crearDesdeElPanel('Para archivar');
    await cambiarEstado(archivado, 'archived');

    const rango: Record<string, number> = {
      published: 0,
      propuesto: 1,
      archived: 2,
      draft: 3,
      rechazado: 3,
    };
    const { items } = await listar('?limit=100');
    const orden = items.map((c) => rango[c.status]!);
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
    expect(items.map((c) => c.id)).toContain(borrador);
  });

  it('filtra por estado y el total es el del filtro', async () => {
    const { items, total } = await listar('?estado=archived&limit=100');
    expect(items.every((c) => c.status === 'archived')).toBe(true);
    expect(total).toBe(items.length);
  });

  it('un limit por encima del tope se rechaza en vez de traer la tabla entera', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/circuits?limit=100000',
      headers: adminAuth,
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('contadores del panel', () => {
  it('stats cuenta los cinco estados', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/stats', headers: adminAuth });
    const stats = res.json<AdminStats>();
    const { total } = await listar('?limit=100');

    expect(stats.propuesto).toBeGreaterThan(0);
    expect(stats.rechazado).toBeGreaterThan(0);
    expect(
      stats.published + stats.draft + stats.archived + stats.propuesto + stats.rechazado,
    ).toBe(total);
  });
});

describe('borrado definitivo', () => {
  it('no borra un circuito publicado: primero hay que archivarlo o rechazarlo', async () => {
    const id = await crearDesdeElPanel('Publicado intocable');
    await cambiarEstado(id, 'published');

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/circuits/${id}/definitivo`,
      headers: adminAuth,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ code: string }>().code).toBe('BORRADO_NO_PERMITIDO');

    const sigue = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/circuits/${id}`,
      headers: adminAuth,
    });
    expect(sigue.statusCode).toBe(200);
  });

  it('borra la fila y se lleva fotos, GPX y horarios por cascada', async () => {
    const id = await crearDesdeElPanel('Con hijos para borrar', [
      { name: 'gpx', data: gpxFixture, filename: 'track.gpx' },
      {
        name: 'schedules',
        data: JSON.stringify([{ dayOfWeek: 6, opens: '09:00', closes: '18:00' }]),
      },
    ]);

    const foto = multipart([{ name: 'file', data: PNG, filename: 'foto.png' }]);
    const subida = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/circuits/${id}/media`,
      headers: { ...foto.headers, ...adminAuth },
      payload: foto.payload,
    });
    expect(subida.statusCode).toBe(201);

    const hijos = async () => ({
      media: (await client`SELECT 1 FROM circuit_media WHERE circuit_id = ${id}`).length,
      gpx: (await client`SELECT 1 FROM circuit_gpx WHERE circuit_id = ${id}`).length,
      horarios: (await client`SELECT 1 FROM circuit_schedules WHERE circuit_id = ${id}`).length,
    });
    expect(await hijos()).toEqual({ media: 1, gpx: 1, horarios: 1 });

    await cambiarEstado(id, 'archived');
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/circuits/${id}/definitivo`,
      headers: adminAuth,
    });
    expect(res.statusCode).toBe(204);

    expect(await hijos()).toEqual({ media: 0, gpx: 0, horarios: 0 });
    const detalle = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/circuits/${id}`,
      headers: adminAuth,
    });
    expect(detalle.statusCode).toBe(404);
  });
});

describe('fotos: la ruta pública y la del panel', () => {
  /** Sube una foto por el panel y devuelve la URL guardada. */
  async function subirFotoAdmin(id: string): Promise<string> {
    const foto = multipart([{ name: 'file', data: PNG, filename: 'foto.png' }]);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/circuits/${id}/media`,
      headers: { ...foto.headers, ...adminAuth },
      payload: foto.payload,
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ url: string }>().url;
  }

  const nombreDe = (url: string) => url.slice(url.lastIndexOf('/') + 1);

  const pedirPublica = (url: string) => app.inject({ method: 'GET', url });

  const pedirAdmin = (id: string, fileName: string) =>
    app.inject({
      method: 'GET',
      url: `/api/v1/admin/circuits/${id}/media/${fileName}`,
      headers: adminAuth,
    });

  /**
   * `/media` es público y sin token: sirve solo lo publicado. El panel ve las
   * miniaturas por su propia ruta con sesión, que no mira el estado.
   */
  it('una propuesta rechazada no se sirve por /media y sí por la ruta del panel', async () => {
    const propuesta = await proponer('Circuito con foto', '10.2.0.1');
    const id = propuesta.json<{ id: string }>().id;

    const foto = multipart([{ name: 'file', data: PNG, filename: 'foto.png' }]);
    const subida = await app.inject({
      method: 'POST',
      url: `/api/v1/circuits/propuestas/${id}/media`,
      headers: { ...foto.headers, ...vecino, ...desde('10.2.0.1') },
      payload: foto.payload,
    });
    expect(subida.statusCode).toBe(201);
    const url = subida.json<{ url: string }>().url;

    // propuesto ya no se sirve en público: antes se dejaba pasar solo para que el
    // panel pudiera mirarlo con un <img src> sin token
    expect((await pedirPublica(url)).statusCode).toBe(404);

    await cambiarEstado(id, 'rechazado');
    expect((await pedirPublica(url)).statusCode).toBe(404);

    const panel = await pedirAdmin(id, nombreDe(url));
    expect(panel.statusCode).toBe(200);
    expect(panel.headers['content-type']).toBe('image/png');
    expect(panel.rawPayload.equals(PNG)).toBe(true);

    // y al publicarlo vuelve a estar disponible en público
    await cambiarEstado(id, 'published');
    expect((await pedirPublica(url)).statusCode).toBe(200);
  });

  it('un borrador tampoco se sirve por /media, pero el panel lo ve', async () => {
    const id = await crearDesdeElPanel('Borrador con foto');
    const url = await subirFotoAdmin(id);

    expect((await pedirPublica(url)).statusCode).toBe(404);
    expect((await pedirAdmin(id, nombreDe(url))).statusCode).toBe(200);
  });

  it('el panel no sirve la foto de un circuito pasando el id de otro', async () => {
    const propio = await crearDesdeElPanel('Dueño de la foto');
    const ajeno = await crearDesdeElPanel('Circuito ajeno');
    const url = await subirFotoAdmin(propio);

    expect((await pedirAdmin(propio, nombreDe(url))).statusCode).toBe(200);
    // la pertenencia se comprueba contra circuit_media.circuit_id, no contra la cadena
    expect((await pedirAdmin(ajeno, nombreDe(url))).statusCode).toBe(404);
  });

  it('la ruta del panel exige credencial de admin', async () => {
    const id = await crearDesdeElPanel('Foto sin credencial');
    const url = await subirFotoAdmin(id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/circuits/${id}/media/${nombreDe(url)}`,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('búsqueda por nombre en la lista del panel', () => {
  let publicado: string;

  beforeAll(async () => {
    publicado = await crearDesdeElPanel('Ñandú Bravo 100% arena');
    await cambiarEstado(publicado, 'published');
    await crearDesdeElPanel('Nandu Manso');
    // señuelo: con el % sin escapar, buscar "100%" también lo traería
    await crearDesdeElPanel('Nandu 1005 metros');
  });

  const buscar = (q: string, extra = '') =>
    listar(`?limit=100&q=${encodeURIComponent(q)}${extra}`);

  it('filtra por nombre sin distinguir mayúsculas ni acentos, y el total es el del filtro', async () => {
    const { items, total } = await buscar('NANDU');
    expect(items.map((c) => c.name).sort()).toEqual([
      'Nandu 1005 metros',
      'Nandu Manso',
      'Ñandú Bravo 100% arena',
    ]);
    expect(total).toBe(3);

    // y el total del filtro no es el de la tabla
    const todo = await listar('?limit=100');
    expect(todo.total).toBeGreaterThan(total);
  });

  it('se combina con estado y con la paginación', async () => {
    const borradores = await buscar('nandu', '&estado=draft');
    expect(borradores.total).toBe(2);
    expect(borradores.items.every((c) => c.status === 'draft')).toBe(true);

    const pagina = await listar('?limit=1&q=nandu');
    expect(pagina.items).toHaveLength(1);
    expect(pagina.total).toBe(3);
  });

  it('el % de la búsqueda es un carácter, no un comodín', async () => {
    const { items, total } = await buscar('100%');
    expect(items.map((c) => c.id)).toEqual([publicado]);
    expect(total).toBe(1);
  });

  it('sin q la lista se comporta igual que antes', async () => {
    const sinQ = await listar('?limit=100');
    const conVacio = await listar('?limit=100&q=');
    expect(conVacio.items.map((c) => c.id)).toEqual(sinQ.items.map((c) => c.id));
    expect(conVacio.total).toBe(sinQ.total);
  });
});
