/**
 * Convierte un recorrido dibujado a mano en un archivo GPX.
 *
 * Es lo que hace que dibujar no necesite nada nuevo del servidor: la API ya acepta
 * un GPX y de ahí saca el trazado, el punto de partida y la distancia. Un recorrido
 * marcado con el dedo entra por la misma puerta que uno grabado con GPS.
 *
 * Sin elevación a propósito: nadie la marcó, y un `<ele>` inventado se propagaría
 * como desnivel real del circuito.
 */

/** Los puntos llegan en orden GeoJSON, `[lon, lat]`, como en toda la API. */
export type PuntoLonLat = [number, number];

/** Seis decimales son ~10 cm: más precisión que la que da tocar una pantalla. */
const DECIMALES = 6;

export function puntosAGpx(puntos: PuntoLonLat[], nombre: string): string {
  const trkpts = puntos
    .map(
      ([lon, lat]) =>
        `      <trkpt lat="${lat.toFixed(DECIMALES)}" lon="${lon.toFixed(DECIMALES)}"></trkpt>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Circuitos Argentinos" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escaparXml(nombre)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

/** El nombre lo escribe una persona y termina dentro de un XML. */
function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
