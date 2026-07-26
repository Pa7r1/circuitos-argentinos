import type maplibregl from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CircuitSummary } from '@circuitos/shared';
import { DISCIPLINES } from '@circuitos/shared';
import { MapLayerToggle } from '../../components/MapLayerToggle';
import { createPin, setPinSelected } from '../../components/map-pin';
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
import { boundsAround, distanceM } from '../../lib/geo';
import type { Place } from '../../lib/geocode';
import { applyMapLayer, LA_RIOJA_BOUNDS, MAP_STYLE, type MapLayer } from '../../lib/map-style';
import { useCircuits } from '../../lib/queries';
import { useMaplibre } from '../../lib/use-maplibre';
import { PlaceSearch } from './PlaceSearch';

/** Radio de una búsqueda por lugar: amplio a propósito, el circuito puede estar
 * lejos del pueblo pero se llega desde ahí. */
const SEARCH_RADIUS_M = 80_000;
const WIDE_RADIUS_M = 200_000;

/** Deja aire arriba y abajo para que el panel flotante y el bottom-sheet no tapen pines. */
const FIT_PADDING = { top: 140, bottom: 120, left: 24, right: 24 };

export function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const meMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [myPosition, setMyPosition] = useState<[number, number] | null>(null);
  const [layer, setLayer] = useState<MapLayer>('satelite');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [place, setPlace] = useState<Place | null>(null);
  const [radiusM, setRadiusM] = useState(SEARCH_RADIUS_M);
  const [selected, setSelected] = useState<CircuitSummary | null>(null);
  const toast = useToast();
  const gl = useMaplibre();

  // ponytail: una sola consulta con todos los publicados (tope 200 del server) y
  // el filtrado en memoria. Cuando haya más circuitos que ese tope, pasar a
  // consultar por el bbox del viewport (el ST_DWithin de la API ya está listo).
  const { data: allCircuits, isPending, isError } = useCircuits({});

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

  // mapa (recién cuando maplibre terminó de cargar)
  useEffect(() => {
    if (!gl) return;
    const map = new gl.Map({
      container: containerRef.current!,
      style: MAP_STYLE,
      bounds: LA_RIOJA_BOUNDS, // sin ubicación se ve toda la provincia
      fitBoundsOptions: { padding: FIT_PADDING },
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.on('click', () => setSelected(null));
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      meMarkerRef.current = null;
    };
  }, [gl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) applyMapLayer(map, layer);
    else map.once('load', () => applyMapLayer(map, layer));
  }, [layer, gl]);

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
        if (!map) return;
        map.easeTo({ center: lonLat, zoom: 11 });
        if (meMarkerRef.current) {
          meMarkerRef.current.setLngLat(lonLat);
        } else {
          const dot = document.createElement('div');
          dot.className = 'h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow-md';
          dot.setAttribute('aria-label', 'Tu ubicación');
          meMarkerRef.current = new gl!.Marker({ element: dot })
            .setLngLat(lonLat)
            .addTo(map);
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
    if (gl) locateMe();
  }, [gl]);

  // pines
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !gl) return;
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
      const el = createPin(
        color,
        letter,
        `${circuit.name}, ${DIFFICULTY_LABEL[circuit.difficulty]}`,
      );
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelected(circuit);
      });
      markers.set(
        circuit.slug,
        new gl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([circuit.startPoint.coordinates[0], circuit.startPoint.coordinates[1]])
          .addTo(map),
      );
    }
  }, [circuits, gl]);

  // resaltar el pin del circuito abierto
  useEffect(() => {
    for (const [slug, marker] of markersRef.current) {
      setPinSelected(marker.getElement(), slug === selected?.slug);
    }
  }, [selected, circuits]);

  useEffect(() => {
    if (isError) toast('No se pudieron cargar los circuitos. Reintentá en un momento.');
  }, [isError, toast]);

  function selectPlace(next: Place) {
    setPlace(next);
    setRadiusM(SEARCH_RADIUS_M);
    setSelected(null);
    mapRef.current?.fitBounds(boundsAround(next.lonLat, SEARCH_RADIUS_M), {
      padding: FIT_PADDING,
    });
  }

  function clearPlace() {
    setPlace(null);
    setRadiusM(SEARCH_RADIUS_M);
    mapRef.current?.fitBounds(LA_RIOJA_BOUNDS, { padding: FIT_PADDING });
  }

  const selectedAway = circuits.find((i) => i.circuit.slug === selected?.slug)?.away ?? null;

  return (
    <main className="relative h-full">
      <h1 className="sr-only">Circuitos Argentinos — mapa de circuitos off-road</h1>
      <div ref={containerRef} className="h-full w-full" aria-label="Mapa de circuitos" />

      {/* panel flotante: buscador + ubicación, y debajo los filtros por disciplina */}
      <div className="absolute top-3 left-1/2 z-10 w-[95%] max-w-xl -translate-x-1/2 space-y-2 rounded-2xl bg-white/95 p-2 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <PlaceSearch selected={place} onSelect={selectPlace} onClear={clearPlace} />
          <button
            onClick={() => locateMe(true)}
            aria-label="Centrar el mapa en mi ubicación"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-stone-100 text-lg hover:bg-stone-200"
          >
            ◎
          </button>
        </div>
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
                className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors"
                style={
                  on
                    ? { backgroundColor: DISCIPLINE_CHIP_BG[d.slug], color: '#fff' }
                    : { backgroundColor: '#f5f5f4', color: '#57534e' }
                }
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
      </div>

      {/* capa del mapa y contador: debajo del panel, para que el bottom-sheet no los tape */}
      <div className="absolute top-32 left-3 z-10 flex flex-wrap items-center gap-2">
        <MapLayerToggle layer={layer} onChange={setLayer} />
        {!isPending && (
          <span className="rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-medium shadow-md">
            {circuits.length === 1 ? '1 circuito' : `${circuits.length} circuitos`}
            {place ? ` a ${Math.round(radiusM / 1000)} km de ${place.name}` : ''}
          </span>
        )}
      </div>

      {isPending && (
        <p className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-white/95 px-4 py-2 text-sm font-medium shadow-md">
          Cargando circuitos…
        </p>
      )}

      {/* sin resultados dentro del radio buscado */}
      {place && !isPending && circuits.length === 0 && (
        <div className="absolute bottom-24 left-1/2 z-10 w-[90%] max-w-sm -translate-x-1/2 rounded-xl bg-white p-3 text-center shadow-xl">
          <p className="mb-2 text-sm">
            No hay circuitos a menos de {Math.round(radiusM / 1000)} km de{' '}
            <strong>{place.name}</strong>.
          </p>
          {radiusM < WIDE_RADIUS_M ? (
            <button
              onClick={() => {
                setRadiusM(WIDE_RADIUS_M);
                mapRef.current?.fitBounds(boundsAround(place.lonLat, WIDE_RADIUS_M), {
                  padding: FIT_PADDING,
                });
              }}
              className="min-h-11 w-full rounded-lg bg-brand-600 px-3 font-semibold text-white"
            >
              Ampliar a {WIDE_RADIUS_M / 1000} km
            </button>
          ) : (
            <button
              onClick={clearPlace}
              className="min-h-11 w-full rounded-lg bg-brand-600 px-3 font-semibold text-white"
            >
              Ver todos los circuitos
            </button>
          )}
        </div>
      )}

      {/* bottom sheet del circuito seleccionado */}
      {selected && (
        <div
          role="dialog"
          aria-label={selected.name}
          className="absolute right-0 bottom-0 left-0 z-10 mx-auto max-w-xl rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.15)]"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">{selected.name}</h2>
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
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${DIFFICULTY_BADGE[selected.difficulty]}`}
            >
              {DIFFICULTY_LABEL[selected.difficulty]}
            </span>
            <span className="rounded-full bg-stone-100 px-2.5 py-1">
              {formatKm(selected.distanceM)}
            </span>
            <span className="rounded-full bg-stone-100 px-2.5 py-1">
              {ACCESS_LABEL[selected.accessType]}
            </span>
          </div>
          <Link
            to={`/circuitos/${selected.slug}`}
            className="block min-h-11 w-full rounded-lg bg-brand-600 py-3 text-center font-semibold text-white hover:bg-brand-700"
          >
            Ver circuito
          </Link>
        </div>
      )}
    </main>
  );
}
