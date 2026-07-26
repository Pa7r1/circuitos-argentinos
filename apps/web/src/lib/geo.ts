/** Distancia en metros entre dos puntos [lon, lat] (orden GeoJSON, como los da la API). */
export function distanceM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 * Bounds de un círculo alrededor de un punto [lon, lat], en el orden que espera
 * Leaflet: [[sur, oeste], [norte, este]].
 */
export function latLngBoundsAround(
  center: [number, number],
  radiusM: number,
): [[number, number], [number, number]] {
  const [lon, lat] = center;
  const latDelta = radiusM / 111_320;
  const lonDelta = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [
    [lat - latDelta, lon - lonDelta],
    [lat + latDelta, lon + lonDelta],
  ];
}
