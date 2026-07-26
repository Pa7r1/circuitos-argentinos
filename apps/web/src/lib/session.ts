import type { AuthUser } from '@circuitos/shared';

/**
 * Sesión en memoria + localStorage. localStorage y no sessionStorage porque en
 * el teléfono nadie quiere volver a entrar cada vez que cierra la pestaña.
 * ponytail: si algún día hay contenido de terceros en la página, pasar a cookie
 * httpOnly para que un XSS no pueda leer el token.
 */
const CLAVE = 'circuitos_sesion';

export interface Session {
  token: string;
  user: AuthUser;
}

function leer(): Session | null {
  const raw = localStorage.getItem(CLAVE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    localStorage.removeItem(CLAVE);
    return null;
  }
}

let actual: Session | null = leer();
const oyentes = new Set<() => void>();

export function getSession(): Session | null {
  return actual;
}

export function getToken(): string | null {
  return actual?.token ?? null;
}

export function setSession(session: Session): void {
  actual = session;
  localStorage.setItem(CLAVE, JSON.stringify(session));
  for (const fn of oyentes) fn();
}

export function clearSession(): void {
  actual = null;
  localStorage.removeItem(CLAVE);
  for (const fn of oyentes) fn();
}

/** Suscripción para useSyncExternalStore. */
export function subscribe(fn: () => void): () => void {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}
