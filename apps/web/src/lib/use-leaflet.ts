import { useEffect, useState } from 'react';
import type { Map as LeafletMap, TileLayer } from 'leaflet';
import { MAX_ZOOM, TILES, type MapLayer } from './map-style';

type Leaflet = typeof import('leaflet');

let cached: Leaflet | null = null;

/**
 * zoomSnap fraccionario: con el salto entero de Leaflet, encuadrar una provincia
 * se va varios cientos de kilómetros de más.
 */
export const MAP_OPTIONS = { zoomControl: false, zoomSnap: 0.25 } as const;

/**
 * Carga Leaflet bajo demanda para que el shell de la pantalla pinte antes
 * (y su CSS junto con él).
 */
export function useLeaflet(): Leaflet | null {
  const [L, setL] = useState<Leaflet | null>(cached);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    void Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([mod]) => {
      cached = mod.default ?? mod;
      if (alive) setL(cached);
    });
    return () => {
      alive = false;
    };
  }, []);

  return L;
}

/** Capas base del mapa; se alternan sin recrear el mapa ni perder el trazado. */
export function createBaseLayers(L: Leaflet, map: LeafletMap, layer: MapLayer) {
  const satellite = L.tileLayer(TILES.satellite.url, {
    maxZoom: MAX_ZOOM,
    attribution: TILES.satellite.attribution,
  });
  const labels = L.tileLayer(TILES.labels.url, { maxZoom: MAX_ZOOM });
  const osm = L.tileLayer(TILES.osm.url, {
    maxZoom: MAX_ZOOM,
    attribution: TILES.osm.attribution,
  });

  const apply = (next: MapLayer) => {
    const wanted: TileLayer[] = next === 'satelite' ? [satellite, labels] : [osm];
    for (const l of [satellite, labels, osm]) {
      if (wanted.includes(l)) {
        if (!map.hasLayer(l)) l.addTo(map);
      } else if (map.hasLayer(l)) {
        map.removeLayer(l);
      }
    }
    // al revés: la última en ir al fondo queda más abajo, así la foto satelital
    // termina debajo de las etiquetas y ambas debajo del trazado
    for (const l of [...wanted].reverse()) l.bringToBack();
  };

  apply(layer);
  return apply;
}
