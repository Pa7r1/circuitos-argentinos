/**
 * ¿Hay una versión nueva del sitio esperando?
 *
 * Mismo molde que `session.ts` y `tour-visto.ts`: copia en memoria, suscripción
 * para `useSyncExternalStore` y un reinicio para los tests.
 *
 * El aviso es explícito a propósito. Con `registerType: 'autoUpdate'`, el service
 * worker nuevo hace `skipWaiting()` y toma el control solo; lo que decide el
 * plugin cuando eso pasa es recargar la página de una. Una recarga sorpresa a
 * mitad del formulario de proponer borra todo lo cargado, así que el `onNeedReload`
 * de `registrar-sw.ts` desvía ese momento hasta acá y la recarga la pide la persona.
 */
let pendiente = false;
const oyentes = new Set<() => void>();

function avisar(): void {
  for (const fn of oyentes) fn();
}

/** El service worker nuevo ya tomó el control: falta recargar para verlo. */
export function marcarActualizacionLista(): void {
  if (pendiente) return;
  pendiente = true;
  avisar();
}

export function hayActualizacion(): boolean {
  return pendiente;
}

export function suscribirActualizacion(fn: () => void): () => void {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/**
 * Aplica la versión nueva. No manda `skipWaiting`: en modo autoUpdate el service
 * worker ya está activo y controlando, y lo único que sigue ejecutando código
 * viejo es esta pestaña. Recargarla es todo lo que hace falta.
 */
export function aplicarActualizacion(): void {
  window.location.reload();
}

/** Solo para tests. */
export function reiniciarActualizacionParaTest(): void {
  pendiente = false;
  avisar();
}
