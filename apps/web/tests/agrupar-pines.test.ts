import { describe, expect, it } from 'vitest';
import { agruparPines, type PuntoAgrupable } from '../src/lib/agrupar-pines';

const p = (nombre: string, x: number, y: number): PuntoAgrupable<string> => ({ item: nombre, x, y });

/** Los grupos salen en orden de proceso: para comparar, se ordenan por tamaño y nombre. */
function nombres(grupos: { items: string[] }[]) {
  return grupos.map((g) => [...g.items].sort()).sort((a, b) => a[0]!.localeCompare(b[0]!));
}

describe('agruparPines', () => {
  it('junta los que se pisan y deja solos a los lejanos', () => {
    const grupos = agruparPines([p('a', 0, 0), p('b', 10, 0), p('c', 500, 500)], 30);
    expect(nombres(grupos)).toEqual([['a', 'b'], ['c']]);
  });

  it('encadena: si a toca b y b toca c, van los tres juntos', () => {
    // a-c están a 50 px, más que el umbral, pero b los une
    const grupos = agruparPines([p('a', 0, 0), p('b', 25, 0), p('c', 50, 0)], 30);
    expect(nombres(grupos)).toEqual([['a', 'b', 'c']]);
  });

  it('no arrastra al que quedó fuera de la cadena', () => {
    const grupos = agruparPines([p('a', 0, 0), p('b', 25, 0), p('lejos', 200, 0)], 30);
    expect(nombres(grupos)).toEqual([['a', 'b'], ['lejos']]);
  });

  it('el centro del grupo es el promedio, que es donde se dibuja el disco', () => {
    const [grupo] = agruparPines([p('a', 0, 0), p('b', 10, 20)], 30);
    expect(grupo).toMatchObject({ x: 5, y: 10 });
  });

  it('sin puntos no hay grupos', () => {
    expect(agruparPines([], 30)).toEqual([]);
  });
});
