import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CircuitDetail } from '@circuitos/shared';
import { DISCIPLINES } from '@circuitos/shared';
import {
  ACCESS_LABEL,
  DAY_LABEL,
  DIFFICULTY_BADGE,
  DIFFICULTY_LABEL,
  formatKm,
} from '../../lib/format';
import { API_URL } from '../../lib/api';
import { MapLayerToggle } from '../../components/MapLayerToggle';
import { type MapLayer } from '../../lib/map-style';
import { useCircuitDetail } from '../../lib/queries';
import { createBaseLayers, MAP_OPTIONS, useLeaflet } from '../../lib/use-leaflet';

function TrackMap({ circuit }: { circuit: CircuitDetail }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const applyLayerRef = useRef<((layer: MapLayer) => void) | null>(null);
  const [layer, setLayer] = useState<MapLayer>('satelite');
  const L = useLeaflet();

  useEffect(() => {
    applyLayerRef.current?.(layer);
  }, [layer, L]);

  useEffect(() => {
    if (!L) return;
    const latLngs = circuit.track.coordinates.map((c) => [c[1], c[0]] as [number, number]);
    const map = L.map(containerRef.current!, MAP_OPTIONS);
    applyLayerRef.current = createBaseLayers(L, map, layer);

    // trazado: línea blanca de base para que se lea sobre cualquier terreno
    L.polyline(latLngs, { color: '#ffffff', weight: 7 }).addTo(map);
    L.polyline(latLngs, { color: '#ea580c', weight: 4 }).addTo(map);
    map.fitBounds(L.latLngBounds(latLngs), { padding: [30, 30] });

    L.marker([circuit.startPoint.coordinates[1], circuit.startPoint.coordinates[0]], {
      icon: L.divIcon({
        className: '',
        html: '<div class="h-4 w-4 rounded-full border-2 border-white bg-green-600 shadow"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
      alt: 'Punto de partida',
      interactive: false,
    }).addTo(map);

    return () => {
      map.remove();
      applyLayerRef.current = null;
    };
     
  }, [circuit, L]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-64 w-full bg-stone-300 sm:h-80"
        aria-label={`Trazado del circuito ${circuit.name}`}
      />
      <MapLayerToggle layer={layer} onChange={setLayer} className="absolute bottom-3 left-3 z-[500]" />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-2xl p-4" aria-busy="true" aria-label="Cargando circuito">
      <div className="skeleton mb-4 h-64 w-full" />
      <div className="skeleton mb-2 h-8 w-2/3" />
      <div className="skeleton mb-4 h-4 w-1/3" />
      <div className="skeleton h-24 w-full" />
    </div>
  );
}

export function CircuitPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: circuit, isPending, isError } = useCircuitDetail(slug!);

  if (isPending) return <DetailSkeleton />;
  if (isError || !circuit) {
    return (
      <main className="mx-auto max-w-2xl p-6 text-center">
        <h1 className="mb-2 text-xl font-bold">Circuito no encontrado</h1>
        <p className="mb-4 text-stone-600">Puede que ya no esté publicado.</p>
        <Link to="/" className="font-medium text-brand-700 underline">
          Volver al mapa
        </Link>
      </main>
    );
  }

  const [lon, lat] = circuit.startPoint.coordinates;
  // geo: abre la app de mapas nativa en el teléfono; en desktop, Google Maps
  const isTouch = 'ontouchstart' in window;
  const directionsUrl = isTouch
    ? `geo:${lat},${lon}?q=${lat},${lon}(${encodeURIComponent(circuit.name)})`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
  const warnAccess = circuit.accessType !== 'libre' || circuit.accessNotes;

  return (
    <main className="mx-auto max-w-2xl bg-white pb-8 shadow-sm">
      <nav className="flex items-center gap-2 p-3">
        <Link
          to="/"
          className="flex min-h-11 items-center gap-1 rounded-lg px-2 font-medium text-brand-700"
        >
          ← Mapa
        </Link>
      </nav>

      <TrackMap circuit={circuit} />

      <div className="p-4">
        <h1 className="text-2xl font-bold">{circuit.name}</h1>
        <p className="mb-3 text-stone-600">
          {circuit.locality ? `${circuit.locality}, ` : ''}
          {circuit.provinceName} ·{' '}
          {DISCIPLINES.find((d) => d.slug === circuit.discipline)?.name}
        </p>

        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <span className={`rounded-full px-3 py-1.5 font-medium ${DIFFICULTY_BADGE[circuit.difficulty]}`}>
            {DIFFICULTY_LABEL[circuit.difficulty]}
          </span>
          <span className="rounded-full bg-stone-100 px-3 py-1.5">
            {formatKm(circuit.distanceM)}
          </span>
          {circuit.elevationGainM !== null && (
            <span className="rounded-full bg-stone-100 px-3 py-1.5">
              ↗ {circuit.elevationGainM} m de desnivel
            </span>
          )}
        </div>

        <div
          className={`mb-4 rounded-lg p-3 text-sm ${
            warnAccess ? 'border border-amber-300 bg-amber-50 text-amber-900' : 'bg-stone-50'
          }`}
        >
          <p className="font-semibold">{ACCESS_LABEL[circuit.accessType]}</p>
          {circuit.accessNotes && <p className="mt-1">{circuit.accessNotes}</p>}
        </div>

        <a
          href={directionsUrl}
          className="mb-6 block min-h-11 w-full rounded-lg bg-brand-600 py-3 text-center font-semibold text-white hover:bg-brand-700"
        >
          Cómo llegar
        </a>

        {circuit.schedules.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-lg font-semibold">Horarios</h2>
            <table className="w-full text-sm">
              <thead className="sr-only">
                <tr>
                  <th>Día</th>
                  <th>Horario</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {circuit.schedules.map((s, i) => (
                  <tr key={i} className="border-b border-stone-100">
                    <td className="py-2 font-medium">{DAY_LABEL[s.dayOfWeek]}</td>
                    <td className="py-2">
                      {s.opens && s.closes ? `${s.opens} a ${s.closes}` : 'Consultar'}
                    </td>
                    <td className="py-2 text-stone-500">{s.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {circuit.media.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-lg font-semibold">Fotos</h2>
            <div className="flex snap-x gap-2 overflow-x-auto">
              {circuit.media.map((m) => (
                <img
                  key={m.url}
                  src={`${API_URL}${m.url}`}
                  alt={`Foto del circuito ${circuit.name}`}
                  loading="lazy"
                  className="h-40 w-auto shrink-0 snap-start rounded-lg object-cover"
                />
              ))}
            </div>
          </section>
        )}

        {circuit.description && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Descripción</h2>
            <p className="whitespace-pre-line text-stone-700">{circuit.description}</p>
          </section>
        )}
      </div>
    </main>
  );
}
