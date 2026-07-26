import type { LatLngBoundsExpression } from 'leaflet';

export const LA_RIOJA: [number, number] = [-29.4131, -66.8558]; // [lat, lon] (Leaflet)

/** Límites de la provincia de La Rioja (OSM relation 153536): [[sur,oeste],[norte,este]]. */
export const LA_RIOJA_BOUNDS: LatLngBoundsExpression = [
  [-31.998, -69.635],
  [-27.71, -65.423],
];

export type MapLayer = 'satelite' | 'mapa';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

export const TILES = {
  satellite: {
    url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    attribution: 'Imágenes © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
  },
  /** Nombres de pueblos y rutas encima de la foto: sin esto nadie se ubica. */
  labels: {
    url: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
    attribution: '',
  },
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
} as const;

export const MAX_ZOOM = 18;
