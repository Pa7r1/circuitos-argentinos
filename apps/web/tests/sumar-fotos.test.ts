import { describe, expect, it } from 'vitest';
import { MAX_FOTOS, sumarFotos } from '../src/lib/sumar-fotos';

/** Un archivo mínimo, con el peso que le da el contenido. */
const foto = (nombre: string, contenido = 'x') =>
  new File([contenido], nombre, {
    type: 'image/jpeg',
  });

const nombres = (fotos: File[]) => fotos.map((f) => f.name);

describe('sumarFotos', () => {
  it('suma en vez de reemplazar: eligiendo de a una se llega al máximo', () => {
    // es el caso real: la cámara devuelve un archivo por vez, y el `slice` que había
    // antes pisaba la selección anterior en cada vuelta
    let fotos: File[] = [];
    fotos = sumarFotos(fotos, [foto('a.jpg')]);
    fotos = sumarFotos(fotos, [foto('b.jpg', 'xx')]);
    fotos = sumarFotos(fotos, [foto('c.jpg', 'xxx')]);
    expect(nombres(fotos)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(fotos).toHaveLength(MAX_FOTOS);
  });

  it('descarta la cuarta: el servidor no acepta más de tres', () => {
    const fotos = sumarFotos(
      [foto('a.jpg'), foto('b.jpg', 'xx'), foto('c.jpg', 'xxx')],
      [foto('d.jpg', 'xxxx')],
    );
    expect(nombres(fotos)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
  });

  it('corta también cuando llegan varias juntas de una sola vez', () => {
    const fotos = sumarFotos(
      [],
      [foto('a.jpg'), foto('b.jpg', 'xx'), foto('c.jpg', 'xxx'), foto('d.jpg', 'xxxx')],
    );
    expect(nombres(fotos)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
  });

  it('no duplica la misma foto elegida dos veces', () => {
    // el navegador devuelve un `File` nuevo en cada elección, así que la identidad
    // no alcanza: se compara por nombre y tamaño
    const fotos = sumarFotos([foto('paisaje.jpg')], [foto('paisaje.jpg')]);
    expect(nombres(fotos)).toEqual(['paisaje.jpg']);
  });

  it('dos fotos distintas con el mismo nombre pero otro peso sí entran', () => {
    const fotos = sumarFotos([foto('IMG_0001.jpg', 'x')], [foto('IMG_0001.jpg', 'xxxx')]);
    expect(fotos).toHaveLength(2);
  });

  it('sin fotos nuevas devuelve lo que ya había', () => {
    expect(nombres(sumarFotos([foto('a.jpg')], []))).toEqual(['a.jpg']);
  });
});
