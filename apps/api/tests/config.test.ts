import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const BASE = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  ADMIN_USER: 'admin',
  ADMIN_PASSWORD_HASH: '$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  JWT_SECRET: 'secreto-de-test-suficientemente-largo-1234',
} satisfies NodeJS.ProcessEnv;

describe('loadConfig · CORS_ORIGIN', () => {
  it('parte la lista por coma', () => {
    const config = loadConfig({ ...BASE, CORS_ORIGIN: 'https://a.com,https://b.com' });
    expect(config.CORS_ORIGIN).toEqual(['https://a.com', 'https://b.com']);
  });

  it('recorta los espacios alrededor de cada origen', () => {
    const config = loadConfig({ ...BASE, CORS_ORIGIN: 'https://a.com, https://b.com ' });
    expect(config.CORS_ORIGIN).toEqual(['https://a.com', 'https://b.com']);
  });

  it('descarta los vacíos que deja una coma sobrante', () => {
    const config = loadConfig({ ...BASE, CORS_ORIGIN: 'https://a.com,,' });
    expect(config.CORS_ORIGIN).toEqual(['https://a.com']);
  });

  it('falla si no queda ningún origen', () => {
    expect(() => loadConfig({ ...BASE, CORS_ORIGIN: ' , ' })).toThrow(/al menos un origen/);
  });

  it('falla si CORS_ORIGIN no está definida', () => {
    expect(() => loadConfig(BASE)).toThrow(/CORS_ORIGIN/);
  });
});
