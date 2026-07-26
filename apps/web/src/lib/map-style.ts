import type { LngLatBoundsLike, StyleSpecification } from 'maplibre-gl';

export const LA_RIOJA: [number, number] = [-66.8558, -29.4131]; // [lon, lat]

/** Límites de la provincia de La Rioja (OSM relation 153536): [SO, NE]. */
export const LA_RIOJA_BOUNDS: LngLatBoundsLike = [
  [-69.635, -31.998],
  [-65.423, -27.71],
];

export type MapLayer = 'satelite' | 'mapa';

/**
 * Un solo style con las tres capas raster. Se alternan con visibility en vez de
 * setStyle() para no destruir las capas que agrega cada pantalla (el trazado).
 */
export const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imágenes © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    },
    labels: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
    },
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    { id: 'satellite', type: 'raster', source: 'satellite' },
    // etiquetas de pueblos y rutas encima de la foto, si no no se ubica nadie
    { id: 'labels', type: 'raster', source: 'labels' },
    { id: 'osm', type: 'raster', source: 'osm', layout: { visibility: 'none' } },
  ],
};

/** Alterna entre foto satelital (con etiquetas) y mapa de calles. */
export function applyMapLayer(map: maplibregl.Map, layer: MapLayer): void {
  const satellite = layer === 'satelite';
  for (const [id, visible] of [
    ['satellite', satellite],
    ['labels', satellite],
    ['osm', !satellite],
  ] as const) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  }
}
