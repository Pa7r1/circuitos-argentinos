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
import { api, API_URL, RequestError } from '../../lib/api';
import { MapLayerToggle } from '../../components/MapLayerToggle';
import { type MapLayer } from '../../lib/map-style';
import { useCircuitDetail } from '../../lib/queries';
import { createBaseLayers, MAP_OPTIONS, useLeaflet } from '../../lib/use-leaflet';
import { useSession } from '../../lib/use-session';
import { useToast } from '../../components/Toast';
import { AuthModal } from '../auth/AuthModal';

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

/** Invitación a registrarse cuando alguien abre el enlace sin cuenta. */
function Peaje({ onEntrar }: { onEntrar: () => void }) {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center p-6 text-center">
      <h1 className="mb-2 text-2xl font-bold">Creá tu cuenta para ver este circuito</h1>
      <p className="mb-6 text-stone-600">
        El mapa es libre. Para ver el trazado completo, los accesos, los horarios y descargar el
        GPX te pedimos una cuenta: así sabemos quién usa la información de los circuitos.
      </p>
      <button
        onClick={onEntrar}
        className="mb-3 min-h-11 w-full rounded-lg bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
      >
        Crear cuenta o ingresar
      </button>
      <Link to="/" className="min-h-11 font-medium text-brand-700 underline">
        Volver al mapa
      </Link>
    </main>
  );
}

export function CircuitPage() {
  const { slug } = useParams<{ slug: string }>();
  const session = useSession();
  const toast = useToast();
  const [pedirCuenta, setPedirCuenta] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const { data: circuit, isPending, isError, error } = useCircuitDetail(slug!);

  const sinSesion = !session || (error instanceof RequestError && error.statusCode === 401);
  if (sinSesion) {
    return (
      <>
        <Peaje onEntrar={() => setPedirCuenta(true)} />
        {pedirCuenta && (
          <AuthModal
            motivo="Con tu cuenta vas a poder ver el trazado completo y descargar el GPX."
            onClose={() => setPedirCuenta(false)}
            onListo={() => setPedirCuenta(false)}
          />
        )}
      </>
    );
  }

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

        <div className="mb-6 grid gap-2 sm:grid-cols-2">
          <a
            href={directionsUrl}
            className="block min-h-11 rounded-lg bg-brand-600 py-3 text-center font-semibold text-white hover:bg-brand-700"
          >
            Cómo llegar
          </a>
          <button
            onClick={async () => {
              try {
                const blob = await api.downloadGpx(circuit.slug);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${circuit.slug}.gpx`;
                a.click();
                URL.revokeObjectURL(url);
              } catch {
                toast('Este circuito todavía no tiene archivo GPX para descargar.');
              }
            }}
            className="block min-h-11 rounded-lg border-2 border-brand-600 py-3 text-center font-semibold text-brand-700 hover:bg-brand-50"
          >
            Descargar GPX
          </button>
          <p className="text-xs text-stone-500 sm:col-span-2">
            El GPX se abre en Strava, Relive, Wikiloc o tu GPS.
          </p>
        </div>

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

        {circuit.description && (
          <section className="mb-6">
            <h2 className="mb-2 text-lg font-semibold">Descripción</h2>
            <p className="whitespace-pre-line text-stone-700">{circuit.description}</p>
          </section>
        )}

        {circuit.media.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Fotos del lugar</h2>
            <p className="mb-2 text-sm text-stone-500">
              La entrada, el estado del terreno y las referencias para llegar.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {circuit.media.map((m) => (
                <button
                  key={m.url}
                  onClick={() => setFoto(`${API_URL}${m.url}`)}
                  className="overflow-hidden rounded-lg"
                  aria-label="Ver la foto en grande"
                >
                  <img
                    src={`${API_URL}${m.url}`}
                    alt={`Foto del circuito ${circuit.name}`}
                    loading="lazy"
                    className="h-32 w-full object-cover transition-transform hover:scale-105"
                  />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {foto && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFoto(null)}
          role="dialog"
          aria-label="Foto ampliada"
        >
          <img src={foto} alt="" className="max-h-full max-w-full object-contain" />
          <button
            onClick={() => setFoto(null)}
            aria-label="Cerrar la foto"
            className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-2xl text-white"
          >
            ✕
          </button>
        </div>
      )}
    </main>
  );
}
