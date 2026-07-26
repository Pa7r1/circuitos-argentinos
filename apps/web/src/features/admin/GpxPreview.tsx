import { gpx } from '@tmcw/togeojson';
import * as maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { OSM_STYLE } from '../../lib/map-style';

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

  useEffect(() => {
    if (coordinates.length < 2) {
      setError(true);
      return;
    }
    setError(false);
    const bounds = coordinates.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(coordinates[0]!, coordinates[0]!),
    );
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: OSM_STYLE,
      bounds,
      fitBoundsOptions: { padding: 30 },
      interactive: false,
      attributionControl: { compact: true },
    });
    map.on('load', () => {
      map.addSource('preview', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates },
        },
      });
      map.addLayer({
        id: 'preview-line',
        type: 'line',
        source: 'preview',
        paint: { 'line-color': '#ea580c', 'line-width': 3 },
      });
    });
    return () => map.remove();
  }, [coordinates]);

  if (error) {
    return (
      <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
        El GPX no contiene un track con al menos 2 puntos.
      </p>
    );
  }
  return <div ref={containerRef} className="h-48 w-full rounded-lg" aria-label="Vista previa del trazado" />;
}
