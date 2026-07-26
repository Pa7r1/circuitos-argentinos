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
import { Button, ButtonLink } from '../../components/Button';
import { MapLayerToggle } from '../../components/MapLayerToggle';
import { type MapLayer } from '../../lib/map-style';
import { useCircuitDetail } from '../../lib/queries';
import { createBaseLayers, MAP_OPTIONS, useLeaflet } from '../../lib/use-leaflet';
import { useSession } from '../../lib/use-session';
import { useSlowRequest } from '../../lib/use-slow-request';
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

function DetailSkeleton({ despertando }: { despertando: boolean }) {
  return (
    <div className="mx-auto max-w-2xl p-4" aria-busy="true" aria-label="Cargando circuito">
      <div className="skeleton mb-4 h-64 w-full" />
      <div className="skeleton mb-2 h-8 w-2/3" />
      <div className="skeleton mb-4 h-4 w-1/3" />
      <div className="skeleton h-24 w-full" />
      {despertando && (
        <p className="mt-4 text-center text-sm text-stone-600">
          Despertando el servidor, puede tardar un minuto…
        </p>
      )}
    </div>
  );
}

/** Invitación a registrarse cuando alguien abre el enlace sin cuenta. */
function Peaje({ onEntrar }: { onEntrar: () => void }) {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center p-6">
      <div className="tarjeta p-6 text-center">
        <h1 className="mb-2 text-2xl font-bold">Creá tu cuenta para ver este circuito</h1>
        <p className="mb-5 text-stone-600">El mapa es libre. Con tu cuenta, además, vas a poder:</p>
        {/* qué gana la persona, en concreto: el registro se justifica solo */}
        <ul className="mb-6 space-y-2 text-left text-sm text-stone-700">
          {[
            'Ver el trazado completo sobre la foto satelital',
            'Saber cómo se entra y en qué horarios',
            'Descargar el GPX para tu GPS, Strava o Wikiloc',
          ].map((texto) => (
            <li key={texto} className="flex gap-2">
              <span aria-hidden="true" className="font-bold text-brand-600">
                ✓
              </span>
              {texto}
            </li>
          ))}
        </ul>
        <Button variante="primary" tamano="lg" ancho onClick={onEntrar}>
          Crear cuenta o ingresar
        </Button>
      </div>
      <Link
        to="/"
        className="mt-4 py-2 text-center text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        ← Volver al mapa
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
  const despertando = useSlowRequest(isPending);

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

  if (isPending) return <DetailSkeleton despertando={despertando} />;
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
      <nav className="sticky top-0 z-10 flex items-center gap-2 border-b border-stone-200 bg-white/95 p-2 backdrop-blur">
        <Link
          to="/"
          className="flex min-h-11 items-center gap-1 rounded-lg px-3 font-medium text-stone-700 hover:bg-stone-100"
        >
          <span aria-hidden="true">←</span> Volver al mapa
        </Link>
      </nav>

      <TrackMap circuit={circuit} />

      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-stone-900">{circuit.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-stone-600">
            <span>
              {circuit.locality ? `${circuit.locality}, ` : ''}
              {circuit.provinceName}
            </span>
            <span aria-hidden="true">·</span>
            <span>{DISCIPLINES.find((d) => d.slug === circuit.discipline)?.name}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${DIFFICULTY_BADGE[circuit.difficulty]}`}
            >
              {DIFFICULTY_LABEL[circuit.difficulty]}
            </span>
          </p>
        </div>

        {/* los dos números que definen si el circuito es para vos, grandes y juntos */}
        <dl className="mb-4 grid grid-cols-2 gap-2">
          <div className="tarjeta px-4 py-3">
            <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase">Distancia</dt>
            <dd className="text-2xl font-bold tabular-nums">{formatKm(circuit.distanceM)}</dd>
          </div>
          <div className="tarjeta px-4 py-3">
            <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase">Desnivel</dt>
            <dd className="text-2xl font-bold tabular-nums">
              {circuit.elevationGainM !== null ? `${circuit.elevationGainM} m` : '—'}
            </dd>
          </div>
        </dl>

        <div
          className={`mb-6 rounded-xl p-3 text-sm ${
            warnAccess
              ? 'border border-amber-300 bg-amber-50 text-amber-900'
              : 'border border-stone-200 bg-stone-50 text-stone-700'
          }`}
        >
          <p className="font-semibold">
            {warnAccess && (
              <span aria-hidden="true" className="mr-1">
                ⚠
              </span>
            )}
            {ACCESS_LABEL[circuit.accessType]}
          </p>
          {circuit.accessNotes && <p className="mt-1">{circuit.accessNotes}</p>}
        </div>

        <div className="mb-6 grid gap-2 sm:grid-cols-2">
          {/* una sola acción primaria: llegar. Bajar el GPX es para después */}
          <ButtonLink to={directionsUrl} variante="primary" tamano="lg" ancho>
            Cómo llegar
          </ButtonLink>
          <Button
            variante="secondary"
            tamano="lg"
            ancho
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
          >
            Descargar GPX
          </Button>
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
