import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker, Polyline } from 'leaflet';
import { Button } from '../../components/Button';
import { distanceM } from '../../lib/geo';
import { LA_RIOJA, TRACK_CASING, TRACK_COLOR } from '../../lib/map-style';
import type { PuntoLonLat } from '../../lib/puntos-a-gpx';
import { createBaseLayers, MAP_OPTIONS, useLeaflet } from '../../lib/use-leaflet';
import { PlaceSearch } from '../map/PlaceSearch';
import type { Place } from '../../lib/geocode';

/** Un GPX de miles de puntos marcados con el dedo no aporta nada y pesa. */
const MAX_PUNTOS = 500;
/**
 * Por debajo de esto el trazo es demasiado grueso para la distancia que abarca.
 * No bloquea: avisa, porque el que conoce el circuito sabe mejor que nosotros
 * cuántas curvas tiene.
 */
const METROS_POR_PUNTO_GRUESO = 600;

/**
 * Recorrido marcado a mano sobre la foto satelital.
 *
 * Es la salida para quien no grabó su vuelta con ninguna aplicación. Nunca va a
 * ser un GPS —entre dos toques hay una recta y el camino curva—, así que todo acá
 * apunta a achicar esa diferencia y, sobre todo, a que se **vea** cuánta hay: los
 * vértices se arrastran para corregir y la distancia se actualiza a cada toque, que
 * es la señal honesta de si el trazo se parece al recorrido real.
 */
export function DibujarRecorrido({
  puntos,
  onChange,
}: {
  /** En orden GeoJSON `[lon, lat]`, como toda la API. */
  puntos: PuntoLonLat[];
  onChange: (puntos: PuntoLonLat[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const lineaRef = useRef<{ base: Polyline; encima: Polyline } | null>(null);
  const marcadoresRef = useRef<Marker[]>([]);
  const puntosRef = useRef(puntos);
  puntosRef.current = puntos;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [place, setPlace] = useState<Place | null>(null);
  const L = useLeaflet();

  const metros = puntos.reduce(
    (total, punto, i) => (i === 0 ? 0 : total + distanceM(puntos[i - 1]!, punto)),
    0,
  );
  const grueso = puntos.length >= 2 && metros / (puntos.length - 1) > METROS_POR_PUNTO_GRUESO;

  useEffect(() => {
    if (!L) return;
    const map = L.map(containerRef.current!, MAP_OPTIONS);
    map.setView(LA_RIOJA, 9);
    createBaseLayers(L, map, 'satelite');

    map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
      if (puntosRef.current.length >= MAX_PUNTOS) return;
      onChangeRef.current([...puntosRef.current, [e.latlng.lng, e.latlng.lat]]);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      lineaRef.current = null;
      marcadoresRef.current = [];
    };

  }, [L]);

  /*
   * Redibuja la línea y los vértices con cada cambio.
   *
   * Los marcadores se rehacen enteros en vez de sincronizarse uno a uno: son unas
   * decenas como mucho, y el código de ir emparejando índices con marcadores
   * existentes es donde aparecerían los errores de esta pantalla.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L) return;

    const latLngs = puntos.map(([lon, lat]) => [lat, lon] as [number, number]);

    if (lineaRef.current) {
      lineaRef.current.base.setLatLngs(latLngs);
      lineaRef.current.encima.setLatLngs(latLngs);
    } else {
      // el mismo trazado blanco por debajo que usa la ficha: sobre la foto
      // satelital, una línea de un solo color se pierde en el terreno claro
      lineaRef.current = {
        base: L.polyline(latLngs, { color: TRACK_CASING, weight: 7 }).addTo(map),
        encima: L.polyline(latLngs, { color: TRACK_COLOR, weight: 4 }).addTo(map),
      };
    }

    for (const marcador of marcadoresRef.current) marcador.remove();
    marcadoresRef.current = puntos.map(([lon, lat], i) => {
      const esInicio = i === 0;
      const marcador = L.marker([lat, lon], {
        draggable: true,
        keyboard: false,
        title: esInicio ? 'Arranque del circuito' : `Punto ${i + 1}`,
        icon: L.divIcon({
          className: '',
          html: `<span style="display:block;width:${esInicio ? 16 : 12}px;height:${esInicio ? 16 : 12}px;border-radius:9999px;background:${esInicio ? '#16a34a' : TRACK_COLOR};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.5)"></span>`,
          iconSize: esInicio ? [16, 16] : [12, 12],
          iconAnchor: esInicio ? [8, 8] : [6, 6],
        }),
      }).addTo(map);

      // arrastrar un vértice es lo que más precisión aporta: corrige sin rehacer
      marcador.on('dragend', () => {
        const { lat: nuevaLat, lng: nuevaLon } = marcador.getLatLng();
        const copia = [...puntosRef.current];
        copia[i] = [nuevaLon, nuevaLat];
        onChangeRef.current(copia);
      });
      return marcador;
    });
  }, [puntos, L]);

  const km = (metros / 1000).toFixed(1).replace('.', ',');

  return (
    <div>
      <div className="mb-2">
        <PlaceSearch
          selected={place}
          onSelect={(p) => {
            setPlace(p);
            // zoom alto: sobre la foto se ven la huella y el alambrado, y el trazo
            // se apoya en algo real en vez de en la memoria
            mapRef.current?.setView([p.lonLat[1], p.lonLat[0]], 15);
          }}
          onClear={() => setPlace(null)}
        />
      </div>

      <div
        ref={containerRef}
        className="h-72 w-full rounded-xl bg-stone-800 ring-1 ring-white/10 sm:h-96"
        aria-label="Mapa para dibujar el recorrido"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-white/70" aria-live="polite">
          {puntos.length === 0 ? (
            'Buscá la zona, acercá el mapa y tocá siguiendo el recorrido.'
          ) : (
            <>
              <strong className="font-semibold text-white tabular-nums">{km} km</strong>
              <span className="text-white/55"> · {puntos.length} puntos</span>
            </>
          )}
        </p>
        <Button
          variante="secondary"
          tamano="sm"
          disabled={puntos.length === 0}
          onClick={() => onChange(puntos.slice(0, -1))}
        >
          Deshacer
        </Button>
        <Button
          variante="secondary"
          tamano="sm"
          disabled={puntos.length < 3}
          onClick={() => onChange([...puntos, puntos[0]!])}
          title="Vuelve al punto de arranque"
        >
          Cerrar la vuelta
        </Button>
        <Button
          variante="danger"
          tamano="sm"
          disabled={puntos.length === 0}
          onClick={() => onChange([])}
        >
          Borrar
        </Button>
      </div>

      {grueso && (
        <p className="mt-2 text-sm text-amber-300">
          El trazo va bastante derecho para los kilómetros que abarca. Si el camino curva, marcá
          más seguido: así la distancia se parece a la real.
        </p>
      )}
      {puntos.length >= MAX_PUNTOS && (
        <p className="mt-2 text-sm text-amber-300">
          Llegaste al máximo de {MAX_PUNTOS} puntos. Con eso alcanza de sobra.
        </p>
      )}
      <p className="mt-2 text-xs text-white/55">
        El punto verde es el arranque. Podés arrastrar cualquier punto para corregirlo.
      </p>
    </div>
  );
}
