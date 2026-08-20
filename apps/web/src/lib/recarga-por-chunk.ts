/**
 * Plan B para el trozo de código que ya no existe.
 *
 * Al publicarse una versión nueva, el service worker limpia las cachés viejas. La
 * pestaña que quedó abierta sigue pidiendo los chunks con el hash anterior (los
 * `React.lazy` de `main.tsx`, el import diferido de Leaflet). Esos archivos ya no
 * están y, como el sitio se publica con `not_found_handling: "single-page-application"`,
 * Cloudflare contesta el `index.html` con estado 200: el navegador intenta ejecutar
 * HTML como JavaScript y la ruta se muere sin error visible.
 *
 * Vite avisa de eso con el evento `vite:preloadError`, que cubre de una todos los
 * imports diferidos. La salida es recargar, que trae el `index.html` nuevo con los
 * hashes nuevos. Con guardia: si el error se repite después de recargar, no se
 * recarga otra vez. Un bucle de recargas es peor que una pantalla rota, porque no
 * deja ni leer el error.
 */
const CLAVE = 'circuitos_recarga_chunk';
/** Si el fallo vuelve dentro de esta ventana, la recarga no arregló nada. */
const VENTANA_MS = 60_000;

/** Recarga una sola vez. Devuelve `false` si ya se intentó y no hay que insistir. */
export function recargarPorChunkAusente(): boolean {
  let previo = 0;
  try {
    previo = Number(sessionStorage.getItem(CLAVE)) || 0;
    if (Date.now() - previo < VENTANA_MS) return false;
    sessionStorage.setItem(CLAVE, String(Date.now()));
  } catch {
    // sessionStorage puede fallar entero en navegación privada. Sin poder anotar el
    // intento no hay guardia, y sin guardia no se recarga: el bucle es el peor final.
    return false;
  }
  window.location.reload();
  return true;
}

export function vigilarChunksAusentes(): void {
  window.addEventListener('vite:preloadError', (evento) => {
    // preventDefault evita que vite vuelva a lanzar el error mientras se recarga
    if (recargarPorChunkAusente()) evento.preventDefault();
  });
}
