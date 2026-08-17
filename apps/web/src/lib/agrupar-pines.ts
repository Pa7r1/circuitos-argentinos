/**
 * Junta los pines que se pisan en pantalla.
 *
 * El umbral va en **píxeles y no en kilómetros**, aunque el pedido se haya hablado
 * en kilómetros. Lo que se busca es "de lejos un punto, al acercarse separados", y
 * eso es exactamente una distancia de pantalla: los mismos 800 m son un solapamiento
 * total en el zoom de provincia y media pantalla en el zoom de calle. Con un umbral
 * fijo en metros, dos circuitos a 900 m seguirían pegados en el zoom máximo.
 */

export interface PuntoAgrupable<T> {
  item: T;
  /** Posición ya proyectada a píxeles del mapa. */
  x: number;
  y: number;
}

export interface Grupo<T> {
  items: T[];
  /** Centro del grupo, en píxeles: donde va el disco con la cantidad. */
  x: number;
  y: number;
}

/**
 * Agrupa por cercanía, encadenando: si A está cerca de B y B de C, los tres van
 * juntos aunque A y C estén lejos. Es lo que evita que al mover el mapa un pin
 * salte de un grupo a otro según el orden en que se recorrieron.
 *
 * ponytail: barrido O(n²). Con las decenas de circuitos que puede haber en pantalla
 * ni se nota; si algún día son miles, esto pide una grilla espacial.
 */
export function agruparPines<T>(puntos: PuntoAgrupable<T>[], umbralPx: number): Grupo<T>[] {
  const pendientes = [...puntos];
  const grupos: Grupo<T>[] = [];

  while (pendientes.length > 0) {
    const semilla = pendientes.pop()!;
    const miembros = [semilla];

    // cada vecino que entra puede arrastrar a los suyos, así que se revisa la
    // lista hasta que una pasada completa no sume a nadie
    for (let i = 0; i < miembros.length; i++) {
      const actual = miembros[i]!;
      for (let j = pendientes.length - 1; j >= 0; j--) {
        const otro = pendientes[j]!;
        if (Math.hypot(actual.x - otro.x, actual.y - otro.y) > umbralPx) continue;
        miembros.push(otro);
        pendientes.splice(j, 1);
      }
    }

    grupos.push({
      items: miembros.map((m) => m.item),
      x: miembros.reduce((suma, m) => suma + m.x, 0) / miembros.length,
      y: miembros.reduce((suma, m) => suma + m.y, 0) / miembros.length,
    });
  }

  return grupos;
}
