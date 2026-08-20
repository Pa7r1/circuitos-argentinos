/**
 * Suma las fotos recién elegidas a las que ya estaban.
 *
 * El formulario de propuestas hacía `Array.from(e.target.files).slice(0, MAX)`, o
 * sea que **reemplazaba** la selección en cada vuelta. El servidor acepta tres
 * fotos, pero quien elige de a una —la cámara devuelve un archivo, y varios
 * selectores de Android también— pisaba la anterior y nunca pasaba de una. El
 * límite real no estaba en la API: estaba en esta línea.
 *
 * Vive en `lib/` y no dentro del componente para poder probarla, igual que
 * `agrupar-pines` y `puntos-a-gpx`.
 */

/** Lo que acepta la API por propuesta (`MAX_FOTOS_PROPUESTA` en el servidor). */
export const MAX_FOTOS = 3;

/**
 * Devuelve la lista resultante, sin pasar de `max`.
 *
 * Descarta las repetidas por nombre y tamaño: es lo que pasa cuando alguien vuelve
 * al selector y toca la misma foto, y el `File` que devuelve el navegador es un
 * objeto nuevo cada vez, así que compararlo por identidad no alcanza. Dos fotos
 * distintas con el mismo nombre y el mismo peso al byte son bastante improbables, y
 * el costo de equivocarse es que falte una foto, no que se pierda la propuesta.
 *
 * Las que sobran del límite se descartan en silencio acá: avisar es tarea de la
 * interfaz, que apaga el control al llegar al máximo.
 */
export function sumarFotos(actuales: File[], nuevas: Iterable<File>, max = MAX_FOTOS): File[] {
  const resultado = [...actuales];
  const vistas = new Set(resultado.map(huella));

  for (const foto of nuevas) {
    if (resultado.length >= max) break;
    const clave = huella(foto);
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    resultado.push(foto);
  }

  return resultado;
}

function huella(foto: File): string {
  return `${foto.name}:${foto.size}`;
}
