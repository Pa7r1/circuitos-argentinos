import { gpx } from '@tmcw/togeojson';
import { useEffect, useRef, useState } from 'react';
import { TRACK_COLOR } from '../../lib/map-style';
import { createBaseLayers, MAP_OPTIONS, useLeaflet } from '../../lib/use-leaflet';

/** Extrae las coordenadas del GPX en el navegador para previsualizar antes de subir. */
export function parseGpxCoordinates(xml: string): [number, number][] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const coords: [number, number][] = [];
  for (const feature of gpx(doc).features) {
    const geom = feature.geometry;
    if (geom?.type === 'LineString') {
      for (const c of geom.coordinates) coords.push([c[0]!, c[1]!]);
    } else if (geom?.type === 'MultiLineString') {
      for (const seg of geom.coordinates) for (const c of seg) coords.push([c[0]!, c[1]!]);
    }
  }
  return coords;
}

export function GpxPreview({ coordinates }: { coordinates: [number, number][] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const L = useLeaflet();

  useEffect(() => {
    if (!L) return;
    if (coordinates.length < 2) {
      setError(true);
      return;
    }
    setError(false);
    const latLngs = coordinates.map((c) => [c[1], c[0]] as [number, number]);
    const map = L.map(containerRef.current!, {
      ...MAP_OPTIONS,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
    });
    createBaseLayers(L, map, 'satelite');
    L.polyline(latLngs, { color: TRACK_COLOR, weight: 3 }).addTo(map);
    map.fitBounds(L.latLngBounds(latLngs), { padding: [20, 20] });
    return () => {
      map.remove();
    };
  }, [coordinates, L]);

  if (error) {
    return (
      <p className="rounded-xl border border-red-400/30 bg-red-500/12 p-3 text-sm text-red-200">
        El GPX no contiene un track con al menos 2 puntos.
      </p>
    );
  }
  return (
    <div
      ref={containerRef}
      className="h-48 w-full rounded-xl bg-stone-800 ring-1 ring-white/10"
      aria-label="Vista previa del trazado"
    />
  );
}
