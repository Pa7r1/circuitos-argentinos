import { describe, expect, it } from 'vitest';
import { parseGpxCoordinates } from '../src/features/admin/GpxPreview';
import { puntosAGpx, type PuntoLonLat } from '../src/lib/puntos-a-gpx';

const RECORRIDO: PuntoLonLat[] = [
  [-67.5, -29.16],
  [-67.503, -29.166],
  [-67.51, -29.17],
];

describe('puntosAGpx', () => {
  it('escribe un trkpt por punto, en orden', () => {
    const gpx = puntosAGpx(RECORRIDO, 'Cañón del Vecino');
    expect(gpx.match(/<trkpt /g)).toHaveLength(3);
    expect(gpx.indexOf('-29.160000')).toBeLessThan(gpx.indexOf('-29.170000'));
  });

  it('lat y lon no salen invertidos', () => {
    // la trampa de siempre: los puntos llegan en orden GeoJSON [lon, lat] y el GPX
    // los escribe al revés. Invertirlos manda el circuito a China sin que falle nada.
    const gpx = puntosAGpx([[-67.5, -29.16]], 'x');
    expect(gpx).toContain('lat="-29.160000"');
    expect(gpx).toContain('lon="-67.500000"');
  });

  it('lo que genera se puede volver a leer', () => {
    // el mismo lector que usa el panel para previsualizar un GPX subido
    const leido = parseGpxCoordinates(puntosAGpx(RECORRIDO, 'Ida y vuelta'));
    expect(leido).toHaveLength(3);
    expect(leido[0]![0]).toBeCloseTo(-67.5, 5);
    expect(leido[0]![1]).toBeCloseTo(-29.16, 5);
  });

  it('un recorrido de dos puntos ya es válido', () => {
    expect(parseGpxCoordinates(puntosAGpx(RECORRIDO.slice(0, 2), 'Corto'))).toHaveLength(2);
  });

  it('escapa el nombre: lo escribe una persona y termina dentro de un XML', () => {
    const gpx = puntosAGpx(RECORRIDO, 'Ruta <40> & "el filo"');
    expect(gpx).toContain('Ruta &lt;40&gt; &amp; &quot;el filo&quot;');
    expect(parseGpxCoordinates(gpx)).toHaveLength(3);
  });
});
