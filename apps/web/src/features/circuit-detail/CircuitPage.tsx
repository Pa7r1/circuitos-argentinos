import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CircuitDetail, GeoJsonLineString } from '@circuitos/shared';
import { DISCIPLINES } from '@circuitos/shared';
import {
  ACCESS_LABEL,
  DAY_LABEL,
  DIFFICULTY_BADGE,
  DIFFICULTY_LABEL,
  DISCIPLINE_COLOR,
  formatKm,
} from '../../lib/format';
import { api, API_URL, RequestError } from '../../lib/api';
import { Button, ButtonLink } from '../../components/Button';
import { ExternalMapEmbed } from '../../components/ExternalMapEmbed';
import { MapLayerToggle } from '../../components/MapLayerToggle';
import { TRACK_CASING, TRACK_COLOR, type MapLayer } from '../../lib/map-style';
import { useCircuitDetail } from '../../lib/queries';
import { createBaseLayers, MAP_OPTIONS, useLeaflet } from '../../lib/use-leaflet';
import { useSession } from '../../lib/use-session';
import { useSlowRequest } from '../../lib/use-slow-request';
import { useToast } from '../../components/Toast';
import { AuthModal } from '../auth/AuthModal';

function TrackMap({ circuit, track }: { circuit: CircuitDetail; track: GeoJsonLineString }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const applyLayerRef = useRef<((layer: MapLayer) => void) | null>(null);
  const [layer, setLayer] = useState<MapLayer>('satelite');
  const L = useLeaflet();

  useEffect(() => {
    applyLayerRef.current?.(layer);
  }, [layer, L]);

  useEffect(() => {
    if (!L) return;
    const latLngs = track.coordinates.map((c) => [c[1], c[0]] as [number, number]);
    const map = L.map(containerRef.current!, MAP_OPTIONS);
    applyLayerRef.current = createBaseLayers(L, map, layer);

    // trazado: línea blanca de base para que se lea sobre cualquier terreno
    L.polyline(latLngs, { color: TRACK_CASING, weight: 7 }).addTo(map);
    L.polyline(latLngs, { color: TRACK_COLOR, weight: 4 }).addTo(map);
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

  }, [circuit, track, L]);

  return (
    <div className="relative">
      {/* el trazado es lo que responde "¿esto es para mí?": crece con la pantalla
          en vez de quedar en una franja del mismo alto en un monitor de 27" */}
      <div
        ref={containerRef}
        className="h-72 w-full bg-stone-800 sm:h-96 lg:h-[30rem]"
        aria-label={`Trazado del circuito ${circuit.name}`}
      />
      <MapLayerToggle layer={layer} onChange={setLayer} className="absolute bottom-3 left-3 z-[500]" />
    </div>
  );
}

/**
 * Foto ampliada.
 *
 * Antes era un div suelto que solo cerraba con clic: sin Escape, sin devolver el
 * foco y sin atraparlo, así que con teclado se podía tabular por los enlaces de la
 * página que quedaba tapada abajo. Todo eso ya estaba resuelto en `Modal`; lo que
 * faltaba era que este visor lo usara en vez de reimplementarlo a medias.
 */
function VisorFoto({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previo?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fondo-modal fixed inset-0 z-[1000] flex items-center justify-center bg-black/92 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Foto ampliada"
    >
      <img
        src={src}
        alt=""
        className="panel-modal max-h-full max-w-full rounded-lg object-contain"
      />
      <button
        onClick={onClose}
        autoFocus
        aria-label="Cerrar la foto"
        className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white backdrop-blur transition-colors duration-[var(--duracion-rapida)] hover:bg-white/30"
      >
        ✕
      </button>
    </div>
  );
}

/** Esqueleto con la misma forma que la ficha, para que al cargar nada se mueva. */
function DetailSkeleton({ despertando }: { despertando: boolean }) {
  return (
    <div className="min-h-full" aria-busy="true" aria-label="Cargando circuito">
      <div className="skeleton h-72 w-full rounded-none sm:h-96 lg:h-[30rem]" />
      <div className="mx-auto max-w-6xl px-4 pt-5 lg:pt-8">
        <div className="skeleton mb-2 h-4 w-24" />
        <div className="skeleton mb-2 h-9 w-2/3" />
        <div className="skeleton h-4 w-40" />
      </div>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <div className="skeleton h-40 w-full rounded-xl" />
        <div className="skeleton order-first h-56 w-full rounded-xl lg:order-none" />
      </div>
      {despertando && (
        <p className="px-4 text-center text-sm text-white/65">
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
        <h1 className="mb-2 titulo text-2xl">Creá tu cuenta para ver este circuito</h1>
        <p className="mb-5 text-white/70">El mapa es libre. Con tu cuenta, además, vas a poder:</p>
        {/* qué gana la persona, en concreto: el registro se justifica solo */}
        <ul className="mb-6 space-y-2 text-left text-sm text-white/80">
          {[
            'Ver el trazado completo sobre la foto satelital',
            'Saber cómo se entra y en qué horarios',
            'Descargar el GPX para tu GPS, Strava o Wikiloc',
          ].map((texto) => (
            <li key={texto} className="flex gap-2">
              <span aria-hidden="true" className="font-bold text-brand-400">
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
        className="mt-4 py-2 text-center text-sm font-medium text-white/65 hover:text-white"
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
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center p-6">
        <div className="tarjeta p-6 text-center">
          <h1 className="titulo mb-2 text-xl">Circuito no encontrado</h1>
          <p className="mb-5 text-white/70">
            Puede que ya no esté publicado o que el enlace esté mal escrito.
          </p>
          <ButtonLink to="/" variante="primary" tamano="lg" ancho>
            Volver al mapa
          </ButtonLink>
        </div>
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

  const descargarGpx = async () => {
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
  };

  return (
    /*
      pb-28 en teléfono deja lugar para la barra de acciones fija; sin eso, el
      último bloque de contenido queda debajo de la barra y no se puede leer.
    */
    <main className="min-h-full pb-28 lg:pb-12">
      {/* trazado propio si vino de un GPX; si no, el recorrido publicado en otra app */}
      <div className="relative">
        {circuit.track ? (
          <TrackMap circuit={circuit} track={circuit.track} />
        ) : (
          circuit.externalMapUrl && (
            <div className="mx-auto max-w-5xl px-4 pt-4">
              <ExternalMapEmbed url={circuit.externalMapUrl} />
            </div>
          )
        )}

        {/*
          El volver flota sobre el mapa, igual que los controles del mapa principal:
          encadena con la pantalla de la que venís y recupera el alto que ocupaba una
          barra blanca que no hacía nada más que eso.
        */}
        <Link
          to="/"
          className="flotante absolute top-3 left-3 z-[500] inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors duration-[var(--duracion-rapida)] ease-suave hover:bg-white/12 motion-safe:active:scale-[0.97]"
        >
          <span aria-hidden="true">←</span> Volver al mapa
        </Link>
      </div>

      {/*
        Dos columnas en escritorio y una en teléfono. Antes era una columna de 672 px
        centrada en un monitor de 1440: media pantalla vacía a los lados, el mapa chico
        y las acciones perdiéndose apenas se bajaba.
      */}
      {/*
        El encabezado va FUERA de la grilla. Adentro, con el aside en `order-first`
        para que en teléfono los datos quedaran antes del contenido, terminaba
        apareciendo la tabla de kilómetros ANTES del nombre del circuito: primero hay
        que saber qué estás mirando y después cuánto mide.
      */}
      <header className="mx-auto max-w-6xl px-4 pt-5 lg:pt-8">
        <p className="mb-1 flex items-center gap-2 text-sm font-semibold tracking-[0.06em] text-white/60 uppercase">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: DISCIPLINE_COLOR[circuit.discipline] }}
          />
          {DISCIPLINES.find((d) => d.slug === circuit.discipline)?.name}
        </p>
        <h1 className="titulo text-3xl lg:text-4xl">{circuit.name}</h1>
        <p className="mt-1.5 text-white/65">
          {circuit.locality ? `${circuit.locality}, ` : ''}
          {circuit.provinceName}
        </p>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8 lg:py-6">
        <div className="min-w-0">
          {/* si el circuito tiene trazado propio y además enlace, van los dos */}
          {circuit.track && circuit.externalMapUrl && (
            <section className="mb-8">
              <h2 className="titulo mb-3 text-lg">Recorrido en video</h2>
              <ExternalMapEmbed url={circuit.externalMapUrl} />
            </section>
          )}

          {circuit.description && (
            <section className="tarjeta mb-6 p-5">
              <h2 className="titulo mb-2 text-lg">Sobre el circuito</h2>
              <p className="whitespace-pre-line text-white/80">{circuit.description}</p>
            </section>
          )}

          {circuit.schedules.length > 0 && (
            <section className="tarjeta mb-6 p-5">
              <h2 className="titulo mb-3 text-lg">Horarios</h2>
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
                    <tr key={i} className="border-b border-white/8 last:border-0">
                      <td className="py-2.5 font-medium text-white/90">
                        {DAY_LABEL[s.dayOfWeek]}
                      </td>
                      <td className="py-2.5 text-right tabular-nums sm:text-left">
                        {s.opens && s.closes ? `${s.opens} a ${s.closes}` : 'Consultar'}
                      </td>
                      <td className="py-2.5 text-right text-white/55">{s.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {circuit.media.length > 0 && (
            <section>
              <h2 className="titulo mb-1 text-lg">Fotos del lugar</h2>
              <p className="mb-3 text-sm text-white/60">
                La entrada, el estado del terreno y las referencias para llegar.
              </p>
              {/* dos columnas en teléfono y tres en escritorio: con el ancho nuevo,
                  dos fotos quedarían enormes y con menos detalle útil por pantalla */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                {circuit.media.map((m) => (
                  <button
                    key={m.url}
                    onClick={() => setFoto(`${API_URL}${m.url}`)}
                    className="group aspect-[4/3] overflow-hidden rounded-xl bg-white/6 ring-1 ring-white/10 transition-shadow duration-[var(--duracion-media)] hover:shadow-card"
                    aria-label="Ver la foto en grande"
                  >
                    <img
                      src={`${API_URL}${m.url}`}
                      alt={`Foto del circuito ${circuit.name}`}
                      loading="lazy"
                      decoding="async"
                      // el contenedor reserva la proporción, así que la página no
                      // salta cuando la foto termina de bajar
                      className="h-full w-full object-cover transition-transform duration-[var(--duracion-media)] ease-suave motion-safe:group-hover:scale-105"
                    />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/*
          Los datos y las acciones, juntos y pegajosos en escritorio: acompañan la
          lectura en vez de quedar arriba de todo. En teléfono es una tarjeta más,
          antes del contenido, y las acciones se repiten en la barra fija de abajo.
        */}
        <aside className="order-first lg:order-none lg:col-start-2 lg:row-start-1">
          <div className="tarjeta overflow-hidden lg:sticky lg:top-6">
            <dl className="grid grid-cols-2 divide-x divide-white/10 border-b border-white/10">
              <Dato etiqueta="Recorrido" valor={formatKm(circuit.distanceM)} />
              <Dato
                etiqueta="Desnivel"
                valor={circuit.elevationGainM !== null ? `${circuit.elevationGainM} m` : '—'}
              />
            </dl>

            <dl className="divide-y divide-white/8 px-5 text-sm">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-white/55">Dificultad</dt>
                <dd
                  className={`rounded-full px-2.5 py-0.5 font-semibold ${DIFFICULTY_BADGE[circuit.difficulty]}`}
                >
                  {DIFFICULTY_LABEL[circuit.difficulty]}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-white/55">Acceso</dt>
                <dd
                  className={`text-right font-semibold ${warnAccess ? 'text-amber-300' : 'text-green-300'}`}
                >
                  {ACCESS_LABEL[circuit.accessType]}
                </dd>
              </div>
            </dl>

            {/* la aclaración del acceso es lo que puede arruinar el viaje: va entera */}
            {circuit.accessNotes && (
              <p className="mx-5 mb-4 flex gap-2 rounded-xl border border-amber-400/30 bg-amber-500/12 p-3 text-sm text-amber-200">
                <span aria-hidden="true">⚠</span>
                {circuit.accessNotes}
              </p>
            )}

            {/* en escritorio las acciones viven acá; en teléfono, en la barra fija */}
            <div className="hidden px-5 pb-5 lg:block">
              <Acciones
                directionsUrl={directionsUrl}
                hasGpx={circuit.hasGpx}
                onDescargar={descargarGpx}
              />
            </div>
          </div>
        </aside>
      </div>

      {/*
        Barra de acciones fija en teléfono. Quien está mirando las fotos y decide ir
        tenía que volver a subir hasta los botones; acá quedan siempre al alcance del
        pulgar. El padding inferior respeta el área segura del teléfono.
      */}
      <div className="flotante fixed right-0 bottom-0 left-0 z-[600] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <Acciones
          directionsUrl={directionsUrl}
          hasGpx={circuit.hasGpx}
          onDescargar={descargarGpx}
          oscuro
        />
      </div>

      {foto && <VisorFoto src={foto} onClose={() => setFoto(null)} />}
    </main>
  );
}

/** Una cifra grande con su etiqueta. */
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-xs font-medium tracking-wide text-white/55 uppercase">{etiqueta}</dt>
      <dd className="titulo text-2xl tabular-nums">{valor}</dd>
    </div>
  );
}

/**
 * Las dos acciones de la ficha. Se usan en dos lugares —la tarjeta lateral en
 * escritorio y la barra fija en teléfono— y por eso viven en un componente: eran la
 * misma botonera copiada, y una copia siempre se termina desviando de la otra.
 */
function Acciones({
  directionsUrl,
  hasGpx,
  onDescargar,
  oscuro = false,
}: {
  directionsUrl: string;
  hasGpx: boolean;
  onDescargar: () => void;
  oscuro?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <ButtonLink to={directionsUrl} variante="primary" tamano="lg" ancho>
        Cómo llegar
      </ButtonLink>
      {/* sin archivo no se ofrece la descarga: sería un botón que da error */}
      {hasGpx && (
        <Button
          variante={oscuro ? 'ghost' : 'secondary'}
          tamano="lg"
          onClick={onDescargar}
          className={oscuro ? 'shrink-0 text-white hover:bg-white/15' : 'shrink-0'}
          title="Descargar el GPX para el GPS, Strava o Wikiloc"
        >
          GPX
        </Button>
      )}
    </div>
  );
}
