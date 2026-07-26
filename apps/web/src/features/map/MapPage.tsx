import type { Map as LeafletMap, Marker } from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CircuitSummary } from '@circuitos/shared';
import { DISCIPLINES } from '@circuitos/shared';
import { Button, ButtonLink } from '../../components/Button';
import { MapControls } from '../../components/MapControls';
import { PIN_ANCHOR, PIN_SIZE, pinSvg, setPinSelected } from '../../components/map-pin';
import { useToast } from '../../components/Toast';
import {
  ACCESS_LABEL,
  DIFFICULTY_BADGE,
  DIFFICULTY_LABEL,
  DISCIPLINE_CHIP_BG,
  DISCIPLINE_COLOR,
  DISCIPLINE_LETTER,
  formatDistanceAway,
  formatKm,
} from '../../lib/format';
import { distanceM, latLngBoundsAround } from '../../lib/geo';
import type { Place } from '../../lib/geocode';
import { LA_RIOJA, LA_RIOJA_BOUNDS, type MapLayer } from '../../lib/map-style';
import { useCircuits } from '../../lib/queries';
import { createBaseLayers, MAP_OPTIONS, useLeaflet } from '../../lib/use-leaflet';
import { useSession } from '../../lib/use-session';
import { useSlowRequest } from '../../lib/use-slow-request';
import { AccountButton } from '../auth/AccountButton';
import { AuthModal } from '../auth/AuthModal';
import { PlaceSearch } from './PlaceSearch';

/** Radio de una búsqueda por lugar: amplio a propósito, el circuito puede estar
 * lejos del pueblo pero se llega desde ahí. */
const SEARCH_RADIUS_M = 80_000;
const WIDE_RADIUS_M = 200_000;

/**
 * Deja aire para que ningún pin quede debajo de la interfaz: arriba el panel de
 * búsqueda y filtros, a la derecha la columna de controles, abajo la hoja del
 * circuito elegido.
 */
const FIT_OPTIONS = {
  paddingTopLeft: [24, 150] as [number, number],
  paddingBottomRight: [72, 130] as [number, number],
};

export function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const applyLayerRef = useRef<((layer: MapLayer) => void) | null>(null);

  // el mapa también como estado, no solo como ref: los controles de zoom tienen
  // que volver a pintarse cuando cambia el nivel para deshabilitarse en los topes
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [myPosition, setMyPosition] = useState<[number, number] | null>(null);
  const [layer, setLayer] = useState<MapLayer>('satelite');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [place, setPlace] = useState<Place | null>(null);
  const [radiusM, setRadiusM] = useState(SEARCH_RADIUS_M);
  const [selected, setSelected] = useState<CircuitSummary | null>(null);
  const [pedirCuenta, setPedirCuenta] = useState<{ motivo?: string; irA?: string } | null>(null);
  const toast = useToast();
  const L = useLeaflet();
  const session = useSession();
  const navigate = useNavigate();

  // ponytail: una sola consulta con todos los publicados (tope 200 del server) y
  // el filtrado en memoria. Cuando haya más circuitos que ese tope, pasar a
  // consultar por el bbox del viewport (el ST_DWithin de la API ya está listo).
  const { data: allCircuits, isPending, isError } = useCircuits({});
  const despertando = useSlowRequest(isPending);

  const origin = place?.lonLat ?? myPosition;

  const circuits = useMemo(() => {
    if (!allCircuits) return [];
    const list = allCircuits
      .filter((c) => !hidden.has(c.discipline))
      .map((c) => ({
        circuit: c,
        away: origin
          ? distanceM(origin, [c.startPoint.coordinates[0], c.startPoint.coordinates[1]])
          : null,
      }));
    const inRange = place ? list.filter((i) => i.away !== null && i.away <= radiusM) : list;
    return inRange.sort((a, b) => (a.away ?? 0) - (b.away ?? 0));
  }, [allCircuits, hidden, origin, place, radiusM]);

  // mapa, recién cuando Leaflet terminó de cargar
  useEffect(() => {
    if (!L) return;
    const map = L.map(containerRef.current!, MAP_OPTIONS);
    // Encuadre inicial fijo sobre la zona donde están los circuitos, sin esperar
    // a la API: así los tiles empiezan a bajar en el primer instante. Si después
    // resulta que algún circuito queda afuera, el efecto de abajo reencuadra.
    map.setView(LA_RIOJA, 9);
    applyLayerRef.current = createBaseLayers(L, map, layer);
    map.on('click', () => setSelected(null));
    mapRef.current = map;
    setMap(map);
    return () => {
      map.remove();
      mapRef.current = null;
      setMap(null);
      markersRef.current.clear();
      meMarkerRef.current = null;
      applyLayerRef.current = null;
    };
     
  }, [L]);

  useEffect(() => {
    applyLayerRef.current?.(layer);
  }, [layer, L]);

  /**
   * Reencuadre solo si hace falta: si con el encuadre inicial ya se ven todos los
   * circuitos, no se toca nada y los tiles que se están bajando siguen sirviendo.
   * Corre una vez; después manda lo que haga la persona (buscar, ubicarse).
   */
  const encuadrado = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L || encuadrado.current || myPosition || place) return;
    if (!allCircuits || allCircuits.length === 0) return;
    encuadrado.current = true;
    const puntos = allCircuits.map(
      (c) => [c.startPoint.coordinates[1], c.startPoint.coordinates[0]] as [number, number],
    );
    const bounds = L.latLngBounds(puntos);
    if (map.getBounds().contains(bounds)) return;
    // maxZoom: con un solo circuito, ajustar a su punto dejaría el mapa pegado
    // al suelo y sin contexto de dónde queda eso
    map.fitBounds(bounds, { ...FIT_OPTIONS, maxZoom: 11, animate: false });
  }, [allCircuits, L, myPosition, place]);

  function locateMe(fromButton = false) {
    if (!navigator.geolocation) {
      if (fromButton) toast('Tu navegador no permite compartir la ubicación.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lonLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setMyPosition(lonLat);
        setPlace(null);
        const map = mapRef.current;
        if (!map || !L) return;
        map.setView([lonLat[1], lonLat[0]], 11);
        if (meMarkerRef.current) {
          meMarkerRef.current.setLatLng([lonLat[1], lonLat[0]]);
        } else {
          meMarkerRef.current = L.marker([lonLat[1], lonLat[0]], {
            icon: L.divIcon({
              className: '',
              html: '<div class="h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow-md"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            }),
            alt: 'Tu ubicación',
            interactive: false,
          }).addTo(map);
        }
      },
      () => {
        if (fromButton) {
          toast('No pudimos obtener tu ubicación. Revisá el permiso del navegador.');
        }
      },
      // alta precisión: usa el GPS del teléfono, que es donde importa
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  // se pide la ubicación una sola vez, cuando el mapa ya puede mostrarla
  useEffect(() => {
    if (L) locateMe();
     
  }, [L]);

  // pines
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L) return;
    const markers = markersRef.current;
    const vigentes = new Set(circuits.map((i) => i.circuit.slug));

    for (const [slug, marker] of markers) {
      if (!vigentes.has(slug)) {
        marker.remove();
        markers.delete(slug);
      }
    }
    for (const { circuit } of circuits) {
      if (markers.has(circuit.slug)) continue;
      const color = DISCIPLINE_COLOR[circuit.discipline] ?? '#ea580c';
      const letter = DISCIPLINE_LETTER[circuit.discipline] ?? '?';
      const marker = L.marker(
        [circuit.startPoint.coordinates[1], circuit.startPoint.coordinates[0]],
        {
          icon: L.divIcon({
            className: '',
            html: pinSvg(color, letter),
            iconSize: PIN_SIZE,
            iconAnchor: PIN_ANCHOR,
          }),
          keyboard: true,
          title: circuit.name,
        },
      ).addTo(map);
      // con divIcon Leaflet no aplica `alt`: el nombre accesible va al elemento
      const el = marker.getElement();
      el?.setAttribute('role', 'button');
      el?.setAttribute('aria-label', `${circuit.name}, ${DIFFICULTY_LABEL[circuit.difficulty]}`);
      marker.on('click', () => setSelected(circuit));
      marker.on('keypress', () => setSelected(circuit));
      markers.set(circuit.slug, marker);
    }
  }, [circuits, L]);

  // resaltar el pin del circuito abierto
  useEffect(() => {
    for (const [slug, marker] of markersRef.current) {
      const el = marker.getElement();
      if (el) setPinSelected(el, slug === selected?.slug);
    }
  }, [selected, circuits]);

  useEffect(() => {
    if (isError) toast('No se pudieron cargar los circuitos. Reintentá en un momento.');
  }, [isError, toast]);

  function selectPlace(next: Place) {
    setPlace(next);
    setRadiusM(SEARCH_RADIUS_M);
    setSelected(null);
    mapRef.current?.fitBounds(latLngBoundsAround(next.lonLat, SEARCH_RADIUS_M), FIT_OPTIONS);
  }

  function clearPlace() {
    setPlace(null);
    setRadiusM(SEARCH_RADIUS_M);
    mapRef.current?.fitBounds(LA_RIOJA_BOUNDS, FIT_OPTIONS);
  }

  const selectedAway = circuits.find((i) => i.circuit.slug === selected?.slug)?.away ?? null;

  return (
    <main className="relative h-full">
      <h1 className="sr-only">Circuitos Argentinos — mapa de circuitos off-road</h1>
      <div ref={containerRef} className="h-full w-full bg-stone-300" aria-label="Mapa de circuitos" />

      {/* panel flotante: buscador y cuenta arriba, filtros y resultado debajo */}
      <div className="absolute top-3 left-1/2 z-[500] w-[95%] max-w-xl -translate-x-1/2 space-y-2">
        <div className="flotante flex items-center gap-2 rounded-2xl p-2">
          <PlaceSearch selected={place} onSelect={selectPlace} onClear={clearPlace} />
          <AccountButton onPedirCuenta={() => setPedirCuenta({})} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por disciplina">
            {DISCIPLINES.map((d) => {
              const on = !hidden.has(d.slug);
              const color = DISCIPLINE_COLOR[d.slug]!;
              return (
                <button
                  key={d.slug}
                  onClick={() =>
                    setHidden((prev) => {
                      const next = new Set(prev);
                      if (on) next.add(d.slug);
                      else next.delete(d.slug);
                      return next;
                    })
                  }
                  aria-pressed={on}
                  // el chip encendido se llena con el color de la disciplina y el
                  // apagado queda blanco: la diferencia se ve de reojo, sin leer
                  className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium shadow-float transition-colors ${
                    on ? 'text-white' : 'bg-white/95 text-stone-600 ring-1 ring-black/5'
                  }`}
                  style={on ? { backgroundColor: DISCIPLINE_CHIP_BG[d.slug] } : undefined}
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full border border-white/70"
                    style={{ backgroundColor: on ? '#fff' : color }}
                  />
                  {d.name}
                </button>
              );
            })}
          </div>

          {/* el resultado del filtro, al lado del filtro: la respuesta a "¿hizo algo?" */}
          {!isPending && (
            <span className="flotante rounded-full px-3 py-2 text-xs font-semibold text-stone-700">
              {circuits.length === 1 ? '1 circuito' : `${circuits.length} circuitos`}
              {place ? ` a ${Math.round(radiusM / 1000)} km de ${place.name}` : ''}
            </span>
          )}
        </div>
      </div>

      <MapControls
        map={map}
        layer={layer}
        onLayerChange={setLayer}
        onLocate={() => locateMe(true)}
      />

      {isPending && (
        <p className="flotante absolute top-1/2 left-1/2 z-[500] max-w-[85%] -translate-x-1/2 rounded-full px-4 py-2.5 text-center text-sm font-medium">
          {despertando ? 'Despertando el servidor, puede tardar un minuto…' : 'Cargando circuitos…'}
        </p>
      )}

      {/* sin resultados dentro del radio buscado */}
      {place && !isPending && circuits.length === 0 && (
        <div className="hoja absolute bottom-24 left-1/2 z-[500] w-[90%] max-w-sm -translate-x-1/2 rounded-2xl bg-white p-4 text-center shadow-float">
          <p className="mb-3 text-sm text-stone-700">
            No hay circuitos a menos de {Math.round(radiusM / 1000)} km de{' '}
            <strong className="font-semibold text-stone-900">{place.name}</strong>.
          </p>
          {radiusM < WIDE_RADIUS_M ? (
            <Button
              variante="primary"
              ancho
              onClick={() => {
                setRadiusM(WIDE_RADIUS_M);
                mapRef.current?.fitBounds(
                  latLngBoundsAround(place.lonLat, WIDE_RADIUS_M),
                  FIT_OPTIONS,
                );
              }}
            >
              Ampliar a {WIDE_RADIUS_M / 1000} km
            </Button>
          ) : (
            <Button variante="primary" ancho onClick={clearPlace}>
              Ver todos los circuitos
            </Button>
          )}
        </div>
      )}

      {/* bottom sheet del circuito seleccionado */}
      {selected && (
        <div
          role="dialog"
          aria-label={selected.name}
          className="hoja absolute right-0 bottom-0 left-0 z-[600] mx-auto max-w-xl rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-sheet sm:bottom-4 sm:w-[95%] sm:rounded-2xl"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-stone-900">{selected.name}</h2>
              <p className="text-sm text-stone-600">
                <span
                  className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                  style={{ backgroundColor: DISCIPLINE_COLOR[selected.discipline] }}
                  aria-hidden="true"
                />
                {DISCIPLINES.find((d) => d.slug === selected.discipline)?.name}
                {selected.locality ? ` · ${selected.locality}` : ''}
                {selectedAway !== null
                  ? ` · ${formatDistanceAway(selectedAway)}${place ? ` de ${place.name}` : ''}`
                  : ''}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="Cerrar"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-stone-500 hover:bg-stone-100"
            >
              ✕
            </button>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${DIFFICULTY_BADGE[selected.difficulty]}`}
            >
              {DIFFICULTY_LABEL[selected.difficulty]}
            </span>
            <span className="rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-700">
              {formatKm(selected.distanceM)}
            </span>
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-700">
              {ACCESS_LABEL[selected.accessType]}
            </span>
          </div>
          {session ? (
            <ButtonLink to={`/circuitos/${selected.slug}`} variante="primary" tamano="lg" ancho>
              Ver circuito
            </ButtonLink>
          ) : (
            <Button
              variante="primary"
              tamano="lg"
              ancho
              onClick={() =>
                setPedirCuenta({
                  motivo:
                    'Creá tu cuenta para ver el trazado completo, los accesos, los horarios y descargar el GPX.',
                  irA: `/circuitos/${selected.slug}`,
                })
              }
            >
              Ver circuito
            </Button>
          )}
        </div>
      )}

      {pedirCuenta && (
        <AuthModal
          motivo={pedirCuenta.motivo}
          onClose={() => setPedirCuenta(null)}
          onListo={() => {
            const destino = pedirCuenta.irA;
            setPedirCuenta(null);
            if (destino) navigate(destino);
          }}
        />
      )}
    </main>
  );
}
