import { gpx } from '@tmcw/togeojson';
import { lineString } from '@turf/helpers';
import length from '@turf/length';
import simplify from '@turf/simplify';
import { DOMParser } from '@xmldom/xmldom';
import { badRequest } from './errors.js';

export interface GpxTrack {
  /** [lon, lat] simplificados, sin elevación */
  coordinates: [number, number][];
  startPoint: [number, number];
  distanceM: number;
  elevationGainM: number | null;
}

/**
 * Pipeline de procesamiento de un GPX:
 * parsear → validar (≥2 puntos) → simplificar → distancia + desnivel → punto de partida.
 */
/**
 * Un GPX es una lista de puntos: no necesita declaración de tipo de documento ni
 * entidades propias. Se rechazan antes de parsear porque el parser expande las
 * entidades internas, y con eso un archivo de pocos kilobytes puede inflarse hasta
 * agotar la memoria del proceso (la "bomba XML"). Subir un GPX exige ser
 * administrador, así que el riesgo real es bajo, pero la guarda cuesta tres líneas.
 */
function rechazarEntidades(xml: string): void {
  // se mira solo el arranque: el prólogo del XML va antes del elemento raíz
  const prologo = xml.slice(0, 4096);
  if (/<!DOCTYPE/i.test(prologo) || /<!ENTITY/i.test(prologo)) {
    throw badRequest(
      'GPX_INVALIDO',
      'El GPX no puede declarar un tipo de documento ni entidades propias',
    );
  }
}

export function processGpx(xml: string): GpxTrack {
  rechazarEntidades(xml);
  let doc: ReturnType<DOMParser['parseFromString']>;
  try {
    doc = new DOMParser({
      onError: (level, message) => {
        if (level === 'fatalError') throw new Error(message);
      },
    }).parseFromString(xml, 'text/xml');
  } catch {
    throw badRequest('GPX_INVALIDO', 'El archivo no es un XML válido');
  }

  const collection = gpx(doc as unknown as Parameters<typeof gpx>[0]);

  // juntar todos los tracks/routes (LineString o MultiLineString) en una sola secuencia
  const rawCoords: number[][] = [];
  for (const feature of collection.features) {
    const geom = feature.geometry;
    if (geom?.type === 'LineString') {
      rawCoords.push(...geom.coordinates);
    } else if (geom?.type === 'MultiLineString') {
      for (const segment of geom.coordinates) rawCoords.push(...segment);
    }
  }

  if (rawCoords.length < 2) {
    throw badRequest(
      'GPX_SIN_TRACK',
      'El GPX debe contener al menos un track o ruta con 2 o más puntos',
    );
  }

  // desnivel acumulado antes de simplificar (la simplificación descarta puntos)
  let elevationGainM: number | null = null;
  const elevations = rawCoords.map((c) => c[2]).filter((e): e is number => typeof e === 'number');
  if (elevations.length >= 2) {
    let gain = 0;
    for (let i = 1; i < elevations.length; i++) {
      const delta = elevations[i]! - elevations[i - 1]!;
      if (delta > 0) gain += delta;
    }
    elevationGainM = Math.round(gain);
  }

  const line = lineString(rawCoords.map((c) => [c[0]!, c[1]!]));
  const simplified = simplify(line, { tolerance: 0.00005, highQuality: true });
  const coordinates = simplified.geometry.coordinates as [number, number][];

  const distanceM = Math.round(length(simplified, { units: 'kilometers' }) * 1000);

  return {
    coordinates,
    startPoint: coordinates[0]!,
    distanceM,
    elevationGainM,
  };
}

/** WKT para insertar en columnas geography. */
export function trackToWkt(coords: [number, number][]): { track: string; start: string } {
  const points = coords.map(([lon, lat]) => `${lon} ${lat}`).join(',');
  return {
    track: `LINESTRING(${points})`,
    start: `POINT(${coords[0]![0]} ${coords[0]![1]})`,
  };
}
