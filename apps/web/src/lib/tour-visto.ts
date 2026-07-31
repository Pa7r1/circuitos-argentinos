/**
 * Qué recorridos guiados ya vio esta persona.
 *
 * Se guarda la **versión** que vio de cada uno, no un simple "sí". Si mañana cambia
 * la interfaz, subir la versión del recorrido se lo vuelve a mostrar a todos; con un
 * booleano quedarían para siempre con una explicación que ya no se corresponde con
 * lo que tienen delante.
 *
 * Mismo patrón que `session.ts`: copia en memoria para leer sin tocar el disco, y
 * suscripción para `useSyncExternalStore`.
 */
const CLAVE = 'circuitos_tours';

export type IdTour = 'mapa' | 'ficha';

/** Subir el número de un recorrido cuando cambie lo que explica. */
export const VERSION_TOUR: Record<IdTour, number> = {
  mapa: 1,
  ficha: 1,
};

type Vistos = Partial<Record<IdTour, number>>;

function leer(): Vistos {
  try {
    const raw = localStorage.getItem(CLAVE);
    return raw ? (JSON.parse(raw) as Vistos) : {};
  } catch {
    // localStorage puede fallar entero en navegación privada de algunos navegadores:
    // que no se pueda recordar el tour no es motivo para romper la app
    return {};
  }
}

let actual: Vistos = leer();
const oyentes = new Set<() => void>();

function avisar(): void {
  for (const fn of oyentes) fn();
}

/** `true` si todavía no vio este recorrido, o si vio una versión anterior. */
export function tourPendiente(id: IdTour): boolean {
  return (actual[id] ?? 0) < VERSION_TOUR[id];
}

export function marcarTourVisto(id: IdTour): void {
  actual = { ...actual, [id]: VERSION_TOUR[id] };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actual));
  } catch {
    // si no se puede guardar, el tour vuelve a aparecer: molesto, no roto
  }
  avisar();
}

/** Vuelve a dejar pendiente un recorrido, para el botón de "ver la ayuda otra vez". */
export function reabrirTour(id: IdTour): void {
  const copia = { ...actual };
  delete copia[id];
  actual = copia;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actual));
  } catch {
    // idem
  }
  avisar();
}

export function suscribirTours(fn: () => void): () => void {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/** Instantánea para `useSyncExternalStore`: cambia de identidad solo al cambiar algo. */
export function estadoTours(): Vistos {
  return actual;
}

/** Solo para tests: vuelve todo a cero sin depender del navegador. */
export function reiniciarToursParaTest(): void {
  actual = {};
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* vacío a propósito */
  }
  avisar();
}
