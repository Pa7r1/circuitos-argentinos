import type { AuthUser, UserRole } from '@circuitos/shared';

/**
 * Sesión en memoria + localStorage. localStorage y no sessionStorage porque en
 * el teléfono nadie quiere volver a entrar cada vez que cierra la pestaña.
 * ponytail: si algún día hay contenido de terceros en la página, pasar a cookie
 * httpOnly para que un XSS no pueda leer el token.
 */
const CLAVE = 'circuitos_sesion';

/**
 * Subir este número cuando cambie la forma de lo guardado, igual que `VERSION_TOUR`
 * en `tour-visto.ts`. Lo guardado con una versión anterior se descarta.
 */
const VERSION = 1;

export interface Session {
  token: string;
  user: AuthUser;
}

interface Guardado {
  version: number;
  session: Session;
}

const ROLES: readonly UserRole[] = ['user', 'admin'];

/**
 * Validación de la forma, no solo del JSON.
 *
 * Antes esto era `JSON.parse(raw) as Session` y listo: una sesión vieja sin `name`
 * pasaba el cast y reventaba más adelante, en el `.trim()` de `iniciales()` dentro
 * de `AccountButton`. O sea: la pantalla entera rota, y sin forma de arreglarlo
 * salvo borrando el almacenamiento a mano. Una sesión que no cumple la forma se
 * tira; en el peor caso hay que volver a entrar, que es molesto y no roto.
 */
function esSesion(valor: unknown): valor is Session {
  if (typeof valor !== 'object' || valor === null) return false;
  const { token, user } = valor as { token?: unknown; user?: unknown };
  if (typeof token !== 'string' || token === '') return false;
  if (typeof user !== 'object' || user === null) return false;
  const u = user as Record<string, unknown>;
  return (
    typeof u.id === 'string' &&
    typeof u.name === 'string' &&
    typeof u.email === 'string' &&
    ROLES.includes(u.role as UserRole) &&
    (u.discipline === null || typeof u.discipline === 'string')
  );
}

function leer(): Session | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(CLAVE);
  } catch {
    // localStorage puede fallar entero en navegación privada de algunos navegadores
    return null;
  }
  if (!raw) return null;
  try {
    const guardado = JSON.parse(raw) as Partial<Guardado>;
    if (guardado?.version === VERSION && esSesion(guardado.session)) return guardado.session;
    /*
     * Formato anterior: la sesión sin envoltorio de versión. Si la forma es la
     * buena se acepta y se reescribe versionada; descartarla sacaría de la cuenta
     * a todo el que tenga la app abierta hoy, sin motivo.
     */
    if (esSesion(guardado)) {
      escribir(guardado);
      return guardado;
    }
  } catch {
    // JSON roto: cae en el descarte de abajo, igual que una forma vieja
  }
  olvidar();
  return null;
}

function escribir(session: Session): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ version: VERSION, session } satisfies Guardado));
  } catch {
    // si no se puede guardar, la sesión vale para esta pestaña y nada más
  }
}

function olvidar(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* vacío a propósito */
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
  escribir(session);
  for (const fn of oyentes) fn();
}

export function clearSession(): void {
  actual = null;
  olvidar();
  for (const fn of oyentes) fn();
}

/** Suscripción para useSyncExternalStore. */
export function subscribe(fn: () => void): () => void {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/** Solo para tests: relee lo que haya en localStorage sin recargar el módulo. */
export function releerSesionParaTest(): Session | null {
  actual = leer();
  for (const fn of oyentes) fn();
  return actual;
}
