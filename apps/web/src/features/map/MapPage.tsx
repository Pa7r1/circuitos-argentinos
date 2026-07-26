import * as maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CircuitSummary } from '@circuitos/shared';
import { DISCIPLINES } from '@circuitos/shared';
import { useToast } from '../../components/Toast';
import {
  ACCESS_LABEL,
  DIFFICULTY_BADGE,
  DIFFICULTY_COLOR,
  DIFFICULTY_LABEL,
  formatDistanceAway,
  formatKm,
} from '../../lib/format';
import { LA_RIOJA, OSM_STYLE } from '../../lib/map-style';
import { useCircuits } from '../../lib/queries';

type Position = { kind: 'pending' } | { kind: 'ok'; lonLat: [number, number] } | { kind: 'denied' };

export function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [position, setPosition] = useState<Position>({ kind: 'pending' });
  const [discipline, setDiscipline] = useState<string | undefined>();
  const [selected, setSelected] = useState<CircuitSummary | null>(null);
  const toast = useToast();

  const geoQuery =
    position.kind === 'ok'
      ? { lat: position.lonLat[1], lon: position.lonLat[0], radius_m: 100_000, discipline }
      : { discipline };
  const { data: circuits, isError } = useCircuits(geoQuery, position.kind !== 'pending');

  // mapa
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: OSM_STYLE,
      center: LA_RIOJA,
      zoom: 9,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    return () => map.remove();
  }, []);

  // geolocalización: si falla o la rechazan, fallback silencioso a La Rioja
  useEffect(() => {
    if (!navigator.geolocation) {
      setPosition({ kind: 'denied' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lonLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setPosition({ kind: 'ok', lonLat });
        const map = mapRef.current;
        if (map) {
          map.easeTo({ center: lonLat, zoom: 10 });
          const dot = document.createElement('div');
          dot.className = 'h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow';
          dot.setAttribute('aria-label', 'Tu ubicación');
          new maplibregl.Marker({ element: dot }).setLngLat(lonLat).addTo(map);
        }
      },
      () => setPosition({ kind: 'denied' }),
      { timeout: 6000, maximumAge: 60_000 },
    );
  }, []);

  // pins de circuitos
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !circuits) return;
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = circuits.map((circuit) => {
      const el = document.createElement('button');
      el.className = 'block h-6 w-6 cursor-pointer rounded-full border-2 border-white shadow-md';
      el.style.backgroundColor = DIFFICULTY_COLOR[circuit.difficulty];
      el.setAttribute('aria-label', `${circuit.name}, ${DIFFICULTY_LABEL[circuit.difficulty]}`);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelected(circuit);
      });
      return new maplibregl.Marker({ element: el })
        .setLngLat([circuit.startPoint.coordinates[0], circuit.startPoint.coordinates[1]])
        .addTo(map);
    });
  }, [circuits]);

  useEffect(() => {
    if (isError) toast('No se pudieron cargar los circuitos. Reintentá en un momento.');
  }, [isError, toast]);

  function recenter() {
    if (position.kind === 'ok') {
      mapRef.current?.easeTo({ center: position.lonLat, zoom: 11 });
    } else {
      toast('Activá la ubicación del navegador para centrar el mapa en vos.');
    }
  }

  return (
    <main className="relative h-full">
      <h1 className="sr-only">Circuitos Argentinos — mapa de circuitos off-road</h1>
      <div ref={containerRef} className="h-full w-full" aria-label="Mapa de circuitos" />

      {/* barra superior flotante */}
      <div className="absolute top-3 left-1/2 z-10 flex w-[95%] max-w-xl -translate-x-1/2 items-center gap-2 rounded-full bg-white/95 px-3 py-2 shadow-lg">
        <span className="hidden pl-1 text-sm font-bold text-brand-700 sm:block">Circuitos</span>
        <div className="flex flex-1 justify-center gap-1.5" role="group" aria-label="Filtrar por disciplina">
          {DISCIPLINES.map((d) => (
            <button
              key={d.slug}
              onClick={() => setDiscipline(discipline === d.slug ? undefined : d.slug)}
              aria-pressed={discipline === d.slug}
              className={`min-h-11 rounded-full px-3 text-sm font-medium transition-colors ${
                discipline === d.slug
                  ? 'bg-brand-600 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
        <button
          onClick={recenter}
          aria-label="Re-centrar el mapa en mi ubicación"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-lg hover:bg-stone-200"
        >
          ◎
        </button>
      </div>

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
                {DISCIPLINES.find((d) => d.slug === selected.discipline)?.name}
                {selected.locality ? ` · ${selected.locality}` : ''}
                {selected.metersAway !== undefined
                  ? ` · ${formatDistanceAway(selected.metersAway)}`
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
            <span className={`rounded-full px-2.5 py-1 font-medium ${DIFFICULTY_BADGE[selected.difficulty]}`}>
              {DIFFICULTY_LABEL[selected.difficulty]}
            </span>
            <span className="rounded-full bg-stone-100 px-2.5 py-1">{formatKm(selected.distanceM)}</span>
            <span className="rounded-full bg-stone-100 px-2.5 py-1">{ACCESS_LABEL[selected.accessType]}</span>
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
