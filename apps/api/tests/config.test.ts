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

/*
 * El caso que tiró la API en producción: en el panel de Render se dejó
 * `RESEND_API_KEY` en blanco, el panel guardó una cadena vacía, y como la
 * variable existía se validó y falló. El despliegue quedó sin arrancar con un
 * "Too small" que no explicaba nada. Dejar un campo en blanco tiene que valer lo
 * mismo que no ponerlo.
 */
describe('loadConfig · variables opcionales en blanco', () => {
  const CON_CORS = { ...BASE, CORS_ORIGIN: 'https://a.com' };

  it('una clave de correo vacía no impide arrancar', () => {
    const config = loadConfig({ ...CON_CORS, RESEND_API_KEY: '' });
    expect(config.RESEND_API_KEY).toBeUndefined();
  });

  it('lo mismo si es solo espacios', () => {
    expect(loadConfig({ ...CON_CORS, RESEND_API_KEY: '   ' }).RESEND_API_KEY).toBeUndefined();
  });

  it('con valor real, se conserva', () => {
    expect(loadConfig({ ...CON_CORS, RESEND_API_KEY: 're_abc123' }).RESEND_API_KEY).toBe('re_abc123');
  });

  it('EMAIL_FROM y APP_URL vacías caen a su valor por defecto', () => {
    const config = loadConfig({ ...CON_CORS, EMAIL_FROM: '', APP_URL: '' });
    expect(config.EMAIL_FROM).toContain('no-responder@');
    expect(config.APP_URL).toBe('http://localhost:5173');
  });

  it('APP_URL con un valor que no es una dirección sigue fallando', () => {
    expect(() => loadConfig({ ...CON_CORS, APP_URL: 'no-es-una-url' })).toThrow(/APP_URL/);
  });

  it('PORT y NODE_ENV en blanco también caen a su valor por defecto', () => {
    const config = loadConfig({ ...CON_CORS, PORT: '', NODE_ENV: '' });
    expect(config.PORT).toBe(3000);
    expect(config.NODE_ENV).toBe('development');
  });

  it('una variable obligatoria en blanco SÍ tiene que impedir el arranque', () => {
    expect(() => loadConfig({ ...CON_CORS, JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
  });
});
