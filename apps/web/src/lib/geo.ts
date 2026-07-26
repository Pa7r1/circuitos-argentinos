/** Distancia en metros entre dos puntos [lon, lat] (haversine). */
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

/** Bounds [SO, NE] de un círculo de radio dado alrededor de un punto. */
export function boundsAround(
  center: [number, number],
  radiusM: number,
): [[number, number], [number, number]] {
  const latDelta = (radiusM / 111_320) * 1;
  const lonDelta = radiusM / (111_320 * Math.cos((center[1] * Math.PI) / 180));
  return [
    [center[0] - lonDelta, center[1] - latDelta],
    [center[0] + lonDelta, center[1] + latDelta],
  ];
}
