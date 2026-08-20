import { afterEach, describe, expect, it } from 'vitest';
import type { Session } from '../src/lib/session';
import { clearSession, getSession, releerSesionParaTest, setSession } from '../src/lib/session';

const CLAVE = 'circuitos_sesion';

const valida: Session = {
  token: 'jwt.de.mentira',
  user: {
    id: 'u1',
    name: 'Valentín Carpio',
    email: 'valen@example.com',
    role: 'user',
    discipline: 'enduro',
  },
};

afterEach(() => {
  clearSession();
});

describe('sesión guardada', () => {
  it('guarda con número de versión y la relee entera', () => {
    setSession(valida);
    const crudo = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as { version: number };
    expect(crudo.version).toBe(1);
    expect(releerSesionParaTest()).toEqual(valida);
  });

  it('descarta lo que no es JSON', () => {
    localStorage.setItem(CLAVE, 'esto no es json');
    expect(releerSesionParaTest()).toBeNull();
    expect(localStorage.getItem(CLAVE)).toBeNull();
  });

  it('descarta una sesión sin nombre, que es la que rompía AccountButton', () => {
    localStorage.setItem(
      CLAVE,
      JSON.stringify({
        version: 1,
        session: { token: 't', user: { id: 'u1', email: 'a@b.c', role: 'user', discipline: null } },
      }),
    );
    expect(releerSesionParaTest()).toBeNull();
    expect(localStorage.getItem(CLAVE)).toBeNull();
  });

  it('descarta una sesión sin token', () => {
    localStorage.setItem(CLAVE, JSON.stringify({ version: 1, session: { user: valida.user } }));
    expect(releerSesionParaTest()).toBeNull();
  });

  it('descarta un rol que no existe', () => {
    localStorage.setItem(
      CLAVE,
      JSON.stringify({
        version: 1,
        session: { token: 't', user: { ...valida.user, role: 'superadmin' } },
      }),
    );
    expect(releerSesionParaTest()).toBeNull();
  });

  it('descarta lo guardado con una versión que ya no se entiende', () => {
    localStorage.setItem(CLAVE, JSON.stringify({ version: 999, session: valida }));
    expect(releerSesionParaTest()).toBeNull();
  });

  it('acepta el formato viejo sin envoltorio y lo reescribe versionado', () => {
    // nadie tiene que volver a entrar solo porque cambió el formato de guardado
    localStorage.setItem(CLAVE, JSON.stringify(valida));
    expect(releerSesionParaTest()).toEqual(valida);
    const crudo = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as { version: number };
    expect(crudo.version).toBe(1);
  });

  it('clearSession borra memoria y disco', () => {
    setSession(valida);
    clearSession();
    expect(getSession()).toBeNull();
    expect(localStorage.getItem(CLAVE)).toBeNull();
  });
});
