import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AdminCircuitDetail, CircuitSummary } from '@circuitos/shared';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { createDb } from '../src/db/index.js';
import { runSeed } from '../src/db/seed.js';
import { createCleanTestDb } from './helpers/test-db.js';

const ADMIN_PASSWORD = 'clave-de-test-123';

/** Multipart armado a mano, igual que en api.test.ts: fastify no arma cuerpos. */
function multipart(campos: Record<string, string>): {
  payload: Buffer;
  headers: Record<string, string>;
} {
  const boundary = '----test-boundary-propuestas';
  const chunks: Buffer[] = [];
  for (const [name, data] of Object.entries(campos)) {
    chunks.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n`),
    );
    chunks.push(Buffer.from(data));
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

/** Multipart con un archivo, como el que manda el navegador al subir una foto. */
function multipartArchivo(data: Buffer): {
  payload: Buffer;
  headers: Record<string, string>;
} {
  const boundary = '----test-boundary-propuestas';
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="foto.png"\r\n` +
        'Content-Type: application/octet-stream\r\n\r\n',
    ),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return {
    payload,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

/**
 * Las propuestas están limitadas a 5 por día y por visitante, y el cubo se elige por
 * `request.ip`, que con `trustProxy` sale de esta cabecera: una IP propia por caso
 * evita que un test agote la cuota del siguiente.
 */
const desde = (ip: string) => ({ 'x-forwarded-for': ip });

/** Cabecera PNG real: el servicio valida el tipo por los primeros bytes. */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);

const CAMPOS = {
  name: 'Circuito de la comunidad',
  discipline: 'enduro',
  province: 'la-rioja',
  locality: 'Chilecito',
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
let vecino: { authorization: string };
let adminAuth: { authorization: string };
let userId: string;

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
  const sesion = registro.json<{ token: string; user: { id: string } }>();
  vecino = { authorization: `Bearer ${sesion.token}` };
  userId = sesion.user.id;

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

describe('propuestas de la comunidad', () => {
  it('una cuenta común propone un circuito y queda pendiente de revisión', async () => {
    const cuerpo = multipart(CAMPOS);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/circuits/propuestas',
      headers: { ...cuerpo.headers, ...vecino },
      payload: cuerpo.payload,
    });
    expect(res.statusCode).toBe(201);

    const { id } = res.json<{ id: string }>();
    const detalle = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/circuits/${id}`,
      headers: adminAuth,
    });
    const circuito = detalle.json<AdminCircuitDetail>();
    expect(circuito.status).toBe('propuesto');
    // el contacto solo se ve desde el panel
    expect(circuito.proponente).toEqual({
      name: 'Vecino',
      email: 'vecino@ejemplo.com',
      phone: '3804-123456',
    });
  });

  it('no aparece en el mapa hasta que se publica', async () => {
    const antes = await app.inject({ method: 'GET', url: '/api/v1/circuits' });
    expect(antes.json<CircuitSummary[]>().map((c) => c.name)).not.toContain(CAMPOS.name);
  });

  it('sin sesión no se puede proponer', async () => {
    const cuerpo = multipart(CAMPOS);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/circuits/propuestas',
      headers: cuerpo.headers,
      payload: cuerpo.payload,
    });
    expect(res.statusCode).toBe(401);
  });

  it('nadie se publica su propio circuito mandando status en el cuerpo', async () => {
    const cuerpo = multipart({ ...CAMPOS, name: 'Intento de colado', status: 'published' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/circuits/propuestas',
      headers: { ...cuerpo.headers, ...vecino },
      payload: cuerpo.payload,
    });
    expect(res.statusCode).toBe(201);

    const detalle = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/circuits/${res.json<{ id: string }>().id}`,
      headers: adminAuth,
    });
    expect(detalle.json<AdminCircuitDetail>().status).toBe('propuesto');
  });

  it('el teléfono es obligatorio', async () => {
    const sinTelefono = { ...CAMPOS };
    delete (sinTelefono as Partial<typeof CAMPOS>).contactPhone;
    const cuerpo = multipart(sinTelefono);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/circuits/propuestas',
      headers: { ...cuerpo.headers, ...vecino },
      payload: cuerpo.payload,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ code: string }>().code).toBe('SIN_TELEFONO');
  });

  it('rechazar guarda el motivo, que es para lo que se pide', async () => {
    const cuerpo = multipart({ ...CAMPOS, name: 'Propuesta repetida' });
    const creado = await app.inject({
      method: 'POST',
      url: '/api/v1/circuits/propuestas',
      headers: { ...cuerpo.headers, ...vecino },
      payload: cuerpo.payload,
    });
    const { id } = creado.json<{ id: string }>();

    const rechazo = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/circuits/${id}`,
      headers: adminAuth,
      payload: { status: 'rechazado', rejectionReason: 'Ya está cargado con otro nombre' },
    });
    expect(rechazo.statusCode).toBe(204);

    const detalle = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/circuits/${id}`,
      headers: adminAuth,
    });
    const circuito = detalle.json<AdminCircuitDetail>();
    expect(circuito.status).toBe('rechazado');
    expect(circuito.rejectionReason).toBe('Ya está cargado con otro nombre');
  });

  it('subir una foto a la propia propuesta devuelve 201 con JSON', async () => {
    const cuerpo = multipart({ ...CAMPOS, name: 'Propuesta con foto' });
    const creado = await app.inject({
      method: 'POST',
      url: '/api/v1/circuits/propuestas',
      headers: { ...cuerpo.headers, ...vecino, ...desde('10.0.0.1') },
      payload: cuerpo.payload,
    });
    const { id } = creado.json<{ id: string }>();

    const foto = multipartArchivo(PNG);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/circuits/propuestas/${id}/media`,
      headers: { ...foto.headers, ...vecino, ...desde('10.0.0.1') },
      payload: foto.payload,
    });
    expect(res.statusCode).toBe(201);
    // sin cuerpo JSON el cliente lo lee como un build mal configurado: este es el bug que volvía
    expect(res.headers['content-type']).toContain('json');
    expect(res.json<{ url: string }>().url).toMatch(/^\/media\//);
  });

  it('no se le pueden subir fotos a la propuesta de otra cuenta', async () => {
    const cuerpo = multipart({ ...CAMPOS, name: 'Propuesta ajena' });
    const creado = await app.inject({
      method: 'POST',
      url: '/api/v1/circuits/propuestas',
      headers: { ...cuerpo.headers, ...vecino, ...desde('10.0.0.2') },
      payload: cuerpo.payload,
    });
    const { id } = creado.json<{ id: string }>();

    const registro = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: desde('10.0.0.2'),
      payload: { name: 'Otra', email: 'otra@ejemplo.com', password: 'clave-de-prueba' },
    });
    const otra = { authorization: `Bearer ${registro.json<{ token: string }>().token}` };

    const foto = multipartArchivo(PNG);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/circuits/propuestas/${id}/media`,
      headers: { ...foto.headers, ...otra, ...desde('10.0.0.2') },
      payload: foto.payload,
    });
    expect(res.statusCode).toBe(403);
  });

  it('no se le pueden subir fotos a un circuito ya publicado', async () => {
    const cuerpo = multipart({ ...CAMPOS, name: 'Propuesta ya publicada' });
    const creado = await app.inject({
      method: 'POST',
      url: '/api/v1/circuits/propuestas',
      headers: { ...cuerpo.headers, ...vecino, ...desde('10.0.0.3') },
      payload: cuerpo.payload,
    });
    const { id } = creado.json<{ id: string }>();

    const publicar = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/circuits/${id}`,
      headers: adminAuth,
      payload: { status: 'published' },
    });
    expect(publicar.statusCode).toBe(204);

    const foto = multipartArchivo(PNG);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/circuits/propuestas/${id}/media`,
      headers: { ...foto.headers, ...vecino, ...desde('10.0.0.3') },
      payload: foto.payload,
    });
    expect(res.statusCode).toBe(403);
  });

  it('borrar la cuenta olvida el teléfono pero no el circuito', async () => {
    const cuerpo = multipart({ ...CAMPOS, name: 'Circuito de alguien que se fue' });
    const creado = await app.inject({
      method: 'POST',
      url: '/api/v1/circuits/propuestas',
      headers: { ...cuerpo.headers, ...vecino },
      payload: cuerpo.payload,
    });
    const { id } = creado.json<{ id: string }>();

    const baja = await app.inject({ method: 'DELETE', url: '/api/v1/auth/me', headers: vecino });
    expect(baja.statusCode).toBe(204);

    const detalle = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/circuits/${id}`,
      headers: adminAuth,
    });
    expect(detalle.statusCode).toBe(200);
    // el circuito sobrevive, el dato personal no
    expect(detalle.json<AdminCircuitDetail>().proponente).toBeNull();
    expect(userId).toBeTruthy();
  });
});
