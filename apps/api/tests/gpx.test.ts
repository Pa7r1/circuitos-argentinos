import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../src/lib/errors.js';
import { processGpx, trackToWkt } from '../src/lib/gpx.js';
import { slugify, uniqueSlug } from '../src/lib/slug.js';

const fixture = readFileSync(path.join(import.meta.dirname, 'fixtures/track.gpx'), 'utf8');

describe('processGpx', () => {
  it('procesa un GPX real: coordenadas, distancia, desnivel y punto de partida', () => {
    const result = processGpx(fixture);
    expect(result.coordinates.length).toBeGreaterThanOrEqual(2);
    expect(result.startPoint).toEqual([-66.85, -29.41]);
    // ~1km de trazado según los puntos del fixture
    expect(result.distanceM).toBeGreaterThan(500);
    expect(result.distanceM).toBeLessThan(3000);
    // deltas positivos: 8 + 13 + 8 + 12 = 41
    expect(result.elevationGainM).toBe(41);
  });

  it('devuelve elevación null si el GPX no trae <ele>', () => {
    const sinEle = fixture.replace(/<ele>\d+<\/ele>/g, '');
    expect(processGpx(sinEle).elevationGainM).toBeNull();
  });

  it('rechaza XML inválido con error de dominio 400', () => {
    expect(() => processGpx('esto no es xml <<<')).toThrowError(DomainError);
  });

  it('rechaza un GPX sin tracks', () => {
    const vacio = '<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"></gpx>';
    try {
      processGpx(vacio);
      expect.unreachable('debería haber lanzado');
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).statusCode).toBe(400);
    }
  });

  it('trackToWkt genera LINESTRING y POINT válidos', () => {
    const wkt = trackToWkt([
      [-66.85, -29.41],
      [-66.84, -29.42],
    ]);
    expect(wkt.track).toBe('LINESTRING(-66.85 -29.41,-66.84 -29.42)');
    expect(wkt.start).toBe('POINT(-66.85 -29.41)');
  });
});

describe('slug', () => {
  it('slugify normaliza tildes, mayúsculas y símbolos', () => {
    expect(slugify('Quebrada del Cóndor ¡2024!')).toBe('quebrada-del-condor-2024');
  });

  it('uniqueSlug agrega sufijo si colisiona', async () => {
    const taken = new Set(['pista', 'pista-2']);
    const slug = await uniqueSlug('Pista', async (s) => taken.has(s));
    expect(slug).toBe('pista-3');
  });
});
