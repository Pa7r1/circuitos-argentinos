import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AuthResponse, LoginResponse } from '@circuitos/shared';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { createDb } from '../src/db/index.js';
import { runSeed } from '../src/db/seed.js';
import { createCleanTestDb } from './helpers/test-db.js';

const ADMIN_PASSWORD = 'clave-de-test-123';
const USER_PASSWORD = 'password-de-usuario';

let app: FastifyInstance;
let client: ReturnType<typeof createDb>['client'];

beforeAll(async () => {
  const testUrl = await createCleanTestDb();
  // el seed deja el GPX del circuito de ejemplo en la base, así que la descarga
  // se puede probar sin escribir nada en disco
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
  app = await buildApp(config, created.db);
});

afterAll(async () => {
  await app?.close();
  await client?.end();
});

const register = (body: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: body });

describe('registro de usuarios', () => {
  it('crea la cuenta y devuelve token y perfil', async () => {
    const res = await register({
      name: 'Valentín Carpio',
      email: 'Valentin@Ejemplo.COM',
      password: USER_PASSWORD,
      discipline: 'enduro',
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<AuthResponse>();
    expect(body.token.split('.')).toHaveLength(3);
    expect(body.user).toMatchObject({
      name: 'Valentín Carpio',
      email: 'valentin@ejemplo.com', // normalizado a minúsculas
      role: 'user',
      discipline: 'enduro',
    });
    expect(body.user).not.toHaveProperty('passwordHash');
  });

  it('rechaza un email ya registrado con 409', async () => {
    const res = await register({
      name: 'Otro',
      email: 'valentin@ejemplo.com',
      password: USER_PASSWORD,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ code: string }>().code).toBe('EMAIL_EN_USO');
  });

  it('rechaza contraseñas cortas y emails inválidos', async () => {
    expect((await register({ name: 'Ana', email: 'a@b.com', password: 'corta' })).statusCode).toBe(400);
    expect(
      (await register({ name: 'Ana', email: 'no-es-email', password: USER_PASSWORD })).statusCode,
    ).toBe(400);
  });
});

describe('login de usuarios', () => {
  it('entra con las credenciales correctas', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'valentin@ejemplo.com', password: USER_PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<AuthResponse>().user.email).toBe('valentin@ejemplo.com');
  });

  it('rechaza la contraseña incorrecta y el email inexistente con el mismo 401', async () => {
    const mala = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'valentin@ejemplo.com', password: 'incorrecta' },
    });
    const inexistente = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'nadie@ejemplo.com', password: USER_PASSWORD },
    });
    expect(mala.statusCode).toBe(401);
    expect(inexistente.statusCode).toBe(401);
    // el mensaje no revela si la cuenta existe
    expect(mala.json<{ message: string }>().message).toBe(
      inexistente.json<{ message: string }>().message,
    );
  });

  it('GET /auth/me devuelve el perfil del token', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'valentin@ejemplo.com', password: USER_PASSWORD },
    });
    const { token } = login.json<AuthResponse>();
    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json<{ email: string }>().email).toBe('valentin@ejemplo.com');
  });
});

describe('separación de permisos', () => {
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const user = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'valentin@ejemplo.com', password: USER_PASSWORD },
    });
    userToken = user.json<AuthResponse>().token;
    const admin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/admin/login',
      payload: { user: 'admin', password: ADMIN_PASSWORD },
    });
    adminToken = admin.json<LoginResponse>().token;
  });

  it('un token de usuario NO entra al panel de administración (403)', async () => {
    for (const url of ['/api/v1/admin/circuits', '/api/v1/admin/stats']) {
      const res = await app.inject({
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json<{ code: string }>().code).toBe('PROHIBIDO');
    }
  });

  it('un token de usuario tampoco puede archivar un circuito', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/admin/circuits/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('el token de admin sí entra, y las estadísticas cuentan usuarios', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/stats',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ published: 1, users: 1 });
  });
});

describe('peaje de registro en la ficha', () => {
  it('el listado del mapa sigue siendo público', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/circuits' });
    expect(res.statusCode).toBe(200);
    expect(res.json<unknown[]>().length).toBeGreaterThan(0);
  });

  it('la ficha sin sesión responde 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/circuits/quebrada-del-condor' });
    expect(res.statusCode).toBe(401);
  });

  it('la ficha con sesión de usuario responde 200 con el trazado', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'valentin@ejemplo.com', password: USER_PASSWORD },
    });
    const { token } = login.json<AuthResponse>();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/circuits/quebrada-del-condor',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ track: { type: string } }>().track.type).toBe('LineString');
  });
});

describe('descarga del GPX', () => {
  it('sin sesión no se puede descargar', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/circuits/quebrada-del-condor/gpx',
    });
    expect(res.statusCode).toBe(401);
  });

  it('con sesión devuelve el archivo como adjunto', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'valentin@ejemplo.com', password: USER_PASSWORD },
    });
    const { token } = login.json<AuthResponse>();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/circuits/quebrada-del-condor/gpx',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toContain('quebrada-del-condor.gpx');
    expect(res.body).toContain('<gpx');
  });
});
