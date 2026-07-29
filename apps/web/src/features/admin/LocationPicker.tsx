import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { PIN_ANCHOR, PIN_SIZE, pinSvg } from '../../components/map-pin';
import { LA_RIOJA } from '../../lib/map-style';
import { TRACK_COLOR } from '../../lib/map-style';
import { createBaseLayers, MAP_OPTIONS, useLeaflet } from '../../lib/use-leaflet';
import { PlaceSearch } from '../map/PlaceSearch';
import type { Place } from '../../lib/geocode';

/**
 * Dónde arranca el circuito, marcado con un clic. Es el reemplazo del punto que
 * antes salía del GPX: sin archivo, alguien tiene que decir dónde queda.
 *
 * El buscador de localidades es el mismo del mapa público: se busca el pueblo
 * más cercano y desde ahí se afina a ojo sobre la foto satelital.
 */
export function LocationPicker({
  value,
  onChange,
}: {
  /** [lon, lat], en el orden de GeoJSON y de la API. */
  value: [number, number] | null;
  onChange: (lonLat: [number, number]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [place, setPlace] = useState<Place | null>(null);
  const L = useLeaflet();

  useEffect(() => {
    if (!L) return;
    const map = L.map(containerRef.current!, MAP_OPTIONS);
    map.setView(value ? [value[1], value[0]] : LA_RIOJA, value ? 13 : 9);
    createBaseLayers(L, map, 'satelite');
    map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
      onChangeRef.current([e.latlng.lng, e.latlng.lat]);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // se crea una sola vez: el punto elegido se refleja en el efecto de abajo

  }, [L]);

  // el pin sigue al valor, venga de un clic o del circuito que se está editando
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L || !value) return;
    const latLng: [number, number] = [value[1], value[0]];
    if (markerRef.current) {
      markerRef.current.setLatLng(latLng);
    } else {
      markerRef.current = L.marker(latLng, {
        icon: L.divIcon({ className: '', html: pinSvg(TRACK_COLOR, '+'), iconSize: PIN_SIZE, iconAnchor: PIN_ANCHOR }),
        interactive: false,
      }).addTo(map);
    }
  }, [value, L]);

  return (
    <div>
      <p className="mb-1 block text-sm font-medium text-stone-700">Dónde arranca el circuito *</p>
      <div className="mb-2 flex items-center gap-2">
        <PlaceSearch
          selected={place}
          onSelect={(p) => {
            setPlace(p);
            mapRef.current?.setView([p.lonLat[1], p.lonLat[0]], 12);
          }}
          onClear={() => setPlace(null)}
        />
      </div>
      <div
        ref={containerRef}
        className="h-64 w-full rounded-lg bg-stone-300"
        aria-label="Mapa para marcar el punto de partida"
      />
      <p className="mt-1 text-xs text-stone-500">
        {value
          ? `Punto elegido: ${value[1].toFixed(5)}, ${value[0].toFixed(5)}. Tocá de nuevo para corregirlo.`
          : 'Buscá la localidad y tocá el mapa donde arranca el circuito.'}
      </p>
    </div>
  );
}
