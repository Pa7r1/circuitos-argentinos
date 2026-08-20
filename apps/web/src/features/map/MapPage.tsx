import type { Map as LeafletMap, Marker } from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CircuitSummary } from '@circuitos/shared';
import { DISCIPLINES } from '@circuitos/shared';
import { Button, ButtonLink } from '../../components/Button';
import { DisciplineChip } from '../../components/DisciplineChip';
import { MapControls } from '../../components/MapControls';
import { BotonProponer, PieSitio } from '../../components/PieSitio';
import { clusterSvg, PIN_ANCHOR, PIN_SIZE, pinSvg, setPinSelected } from '../../components/map-pin';
import { agruparPines } from '../../lib/agrupar-pines';
import { useToast } from '../../components/Toast';
import {
  ACCESS_LABEL,
  DIFFICULTY_LABEL,
  DIFFICULTY_TEXT,
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
import { Tour } from '../../components/Tour';
import { tourPendiente, marcarTourVisto, reabrirTour } from '../../lib/tour-visto';
import { PASOS_MAPA } from './pasos-tour';
import { AccountButton } from '../auth/AccountButton';
import { AuthModal } from '../auth/AuthModal';
import { PlaceSearch } from './PlaceSearch';

/** Radio de una búsqueda por lugar: amplio a propósito, el circuito puede estar
 * lejos del pueblo pero se llega desde ahí. */
/**
 * A partir de acá dos pines se dibujan como uno solo con la cantidad.
 *
 * El disco mide 26 px, así que 34 los junta recién cuando de verdad se tocan. En
 * el zoom de provincia equivale a alrededor de un kilómetro —el caso que motivó
 * esto— y al acercarse se separan solos, sin ningún umbral en metros que ajustar.
 */
const UMBRAL_AGRUPADO_PX = 34;

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

/**
 * A qué altura arrancan los paneles que flotan sobre el mapa.
 *
 * Todos ocupan el 90 % del ancho, así que cualquiera de ellos le pasa por encima a
 * la esquina inferior izquierda —la pastilla de "Sumá tu circuito" y el pie legal—,
 * que llega a los 124 px contando los 24 de separación, el botón de 44, el hueco de
 * 8 y el pie. A los 96 px que tenían antes la tapaban, y se veía en la primera
 * visita de cualquier teléfono, que es justo cuando el aviso aparece y cuando la
 * acción más importa.
 *
 * 9,5rem deja 28 px de aire sobre esa columna, suficiente para que el pie se parta
 * en dos renglones sin volver a taparla. Va en una constante y no repetido en cada
 * panel porque ya pasó: se corrigió uno y los otros tres quedaron atrás.
 *
 * La clase se escribe entera: Tailwind escanea texto y no ve un fragmento armado en
 * tiempo de ejecución.
 */
const PANEL_SOBRE_EL_PIE = 'bottom-[calc(9.5rem+env(safe-area-inset-bottom))]';

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
  // 'desconocido' mientras no se sabe, o si el navegador no expone permissions
  const [permiso, setPermiso] = useState<PermissionState | 'desconocido'>('desconocido');
  const [avisoUbicacionCerrado, setAvisoUbicacionCerrado] = useState(false);
  const [layer, setLayer] = useState<MapLayer>('satelite');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [place, setPlace] = useState<Place | null>(null);
  const [radiusM, setRadiusM] = useState(SEARCH_RADIUS_M);
  const [selected, setSelected] = useState<CircuitSummary | null>(null);
  const [pedirCuenta, setPedirCuenta] = useState<{ motivo?: string; irA?: string } | null>(null);
  const [verTour, setVerTour] = useState(false);
  const toast = useToast();
  const L = useLeaflet();
  const session = useSession();
  const navigate = useNavigate();

  // ponytail: una sola consulta con todos los publicados (tope 200 del server) y
  // el filtrado en memoria. Cuando haya más circuitos que ese tope, pasar a
  // consultar por el bbox del viewport (el ST_DWithin de la API ya está listo).
  const { data: allCircuits, isPending, isError, refetch } = useCircuits({});
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
        // si llegó una posición, el permiso está dado: el aviso ya no hace falta
        setPermiso('granted');
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
              // el punto de "acá estoy" usa el color de acción: es la única marca
              // del mapa que habla de la persona y no de un circuito
              html: '<div class="h-4 w-4 rounded-full border-2 border-white bg-brand-500 shadow-md"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            }),
            // ver el comentario del punto de partida en CircuitPage: sin
            // `keyboard: false` Leaflet deja un botón sin nombre tabulable
            interactive: false,
            keyboard: false,
          }).addTo(map);
        }
      },
      (err) => {
        // PERMISSION_DENIED: no es un fallo pasajero, no tiene sentido reintentar
        if (err.code === err.PERMISSION_DENIED) setPermiso('denied');
        else if (fromButton) {
          toast('No pudimos obtener tu ubicación. Probá de nuevo en un rato.');
        }
      },
      // alta precisión: usa el GPS del teléfono, que es donde importa
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  /*
   * Preguntar por el permiso antes de pedirlo.
   *
   * Antes se llamaba a getCurrentPosition apenas cargaba el mapa: si la persona
   * denegaba, o dejaba el cartel del navegador sin contestar hasta que vencía el
   * timeout de 15 s, no aparecía absolutamente nada. El mapa se quedaba en La Rioja
   * y el "cerca mío" no andaba, sin ninguna explicación.
   *
   * `navigator.permissions` no existe en Safari viejo: ahí se pide como siempre.
   */
  useEffect(() => {
    if (!L) return;
    if (!navigator.permissions) {
      locateMe();
      return;
    }
    let vigente = true;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((estado) => {
        if (!vigente) return;
        setPermiso(estado.state);
        if (estado.state === 'granted') locateMe();
      })
      .catch(() => {
        if (vigente) locateMe();
      });
    return () => {
      vigente = false;
    };
  }, [L]);

  /*
   * Pines, agrupando los que se pisan.
   *
   * Se redibujan enteros en cada cambio de zoom porque el agrupamiento depende de
   * la escala: dos circuitos a 800 m son un solo punto en el zoom de provincia y
   * dos puntos separados en el de calle. Vaciar y rellenar una capa es bastante
   * menos código que ir agregando y quitando marcadores de a uno, y con las
   * decenas de circuitos que caben en pantalla no se nota.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L) return;

    const capa = L.layerGroup().addTo(map);
    const markers = markersRef.current;

    function dibujar() {
      if (!map || !L) return;
      capa.clearLayers();
      markers.clear();

      const grupos = agruparPines(
        circuits.map(({ circuit }) => {
          const punto = map.latLngToLayerPoint([
            circuit.startPoint.coordinates[1],
            circuit.startPoint.coordinates[0],
          ]);
          return { item: circuit, x: punto.x, y: punto.y };
        }),
        UMBRAL_AGRUPADO_PX,
      );

      for (const grupo of grupos) {
        // un solo circuito: el pin de siempre
        if (grupo.items.length === 1) {
          const circuit = grupo.items[0]!;
          const color = DISCIPLINE_COLOR[circuit.discipline] ?? '#e7e5e4';
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
              // Sin esto, tocar un pin MUEVE el mapa: Leaflet enfoca el marcador y
              // desplaza la vista para "traerlo a la vista", pero no sabe que la hoja
              // del circuito tapa la mitad de abajo de la pantalla, así que corría el
              // pin unos 45 px a la derecha y 93 px abajo. Está prendido por defecto
              // desde Leaflet 1.9. El pin ahora se resalta donde está y nada se mueve.
              autoPanOnFocus: false,
            },
          ).addTo(capa);
          // con divIcon Leaflet no aplica `alt`: el nombre accesible va al elemento
          const el = marker.getElement();
          el?.setAttribute('role', 'button');
          el?.setAttribute(
            'aria-label',
            `${circuit.name}, ${DIFFICULTY_LABEL[circuit.difficulty]}`,
          );
          // ancla del recorrido guiado: alcanza con que uno de los pines lo tenga
          el?.setAttribute('data-tour', 'pin');
          marker.on('click', () => setSelected(circuit));
          marker.on('keypress', () => setSelected(circuit));
          markers.set(circuit.slug, marker);
          continue;
        }

        // varios encimados: un disco con la cantidad, en el centro del grupo
        const centro = map.layerPointToLatLng([grupo.x, grupo.y]);
        const puntos = grupo.items.map(
          (c) => [c.startPoint.coordinates[1], c.startPoint.coordinates[0]] as [number, number],
        );
        const cluster = L.marker(centro, {
          icon: L.divIcon({
            className: '',
            html: clusterSvg(grupo.items.length),
            iconSize: PIN_SIZE,
            iconAnchor: PIN_ANCHOR,
          }),
          keyboard: true,
          title: `${grupo.items.length} circuitos acá`,
          autoPanOnFocus: false,
        }).addTo(capa);
        const el = cluster.getElement();
        el?.setAttribute('role', 'button');
        el?.setAttribute('aria-label', `${grupo.items.length} circuitos juntos, tocá para separar`);

        const abrir = () => {
          /*
           * Acercar hasta que se separen. Si ya no se puede acercar más —dos
           * circuitos en la misma coordenada, o el tope del mapa— el grupo
           * quedaría clavado sin hacer nada, así que ahí se abre el primero.
           */
          if (map.getZoom() >= map.getMaxZoom()) {
            setSelected(grupo.items[0]!);
            return;
          }
          map.fitBounds(L.latLngBounds(puntos), { padding: [60, 60], maxZoom: map.getMaxZoom() });
        };
        cluster.on('click', abrir);
        cluster.on('keypress', abrir);
      }
    }

    dibujar();
    map.on('zoomend', dibujar);
    return () => {
      map.off('zoomend', dibujar);
      capa.remove();
      markers.clear();
    };
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

  /*
   * El recorrido espera a que los pines estén dibujados. Si arrancara antes, el
   * paso que señala un pin no encontraría su elemento y se saltearía justo el que
   * explica lo más importante del mapa.
   */
  useEffect(() => {
    if (isPending || !tourPendiente('mapa')) return;
    const id = setTimeout(() => setVerTour(true), 600);
    return () => clearTimeout(id);
  }, [isPending, circuits.length]);

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
      <div
        ref={containerRef}
        className="h-full w-full bg-stone-800"
        aria-label="Mapa de circuitos"
      />

      {/* panel flotante: buscador y cuenta arriba, filtros y resultado debajo */}
      <div className="absolute top-3 left-1/2 z-[500] w-[95%] max-w-xl -translate-x-1/2 space-y-2">
        {/*
          El z-index va explícito acá y en la fila de chips de abajo, y no se puede
          sacar: `flotante` usa `backdrop-blur`, y `backdrop-filter` CREA UN CONTEXTO
          DE APILADO. Eso encierra el z-index del desplegable de resultados dentro de
          esta cápsula, así que dejaba de competir con los chips; como los chips vienen
          después en el DOM y también tienen backdrop-filter, se pintaban encima y
          tapaban la lista. Con z-index propio, el orden deja de depender del DOM.
        */}
        <div
          data-tour="buscador"
          className="flotante relative z-20 flex items-center gap-2 rounded-2xl p-2"
        >
          <PlaceSearch selected={place} onSelect={selectPlace} onClear={clearPlace} />
          {/*
            El resultado del filtro vive dentro de la barra y no en una píldora aparte:
            es la respuesta a "¿hizo algo lo que toqué?", y como dato depende del
            buscador y de los chips, no es un elemento más que compita con ellos.
          */}
          {!isPending && (
            <span
              aria-live="polite"
              className="shrink-0 border-l border-white/15 py-0.5 pl-2.5 text-[11px] leading-[1.15] font-semibold text-white/75"
            >
              <span className="block text-sm text-white tabular-nums">{circuits.length}</span>
              {circuits.length === 1 ? 'circuito' : 'circuitos'}
              {place && (
                <span className="sr-only">{` a ${Math.round(radiusM / 1000)} km de ${place.name}`}</span>
              )}
            </span>
          )}
          <AccountButton onPedirCuenta={() => setPedirCuenta({})} />
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-1.5">
          <div
            data-tour="chips"
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Filtrar por disciplina"
          >
            {DISCIPLINES.map((d) => (
              <DisciplineChip
                key={d.slug}
                nombre={d.name}
                color={DISCIPLINE_COLOR[d.slug]!}
                activo={!hidden.has(d.slug)}
                onToggle={() =>
                  setHidden((prev) => {
                    const next = new Set(prev);
                    if (next.has(d.slug)) next.delete(d.slug);
                    else next.add(d.slug);
                    return next;
                  })
                }
              />
            ))}
          </div>
        </div>
      </div>

      <MapControls
        map={map}
        layer={layer}
        onLayerChange={setLayer}
        onLocate={() => locateMe(true)}
        ubicacionBloqueada={permiso === 'denied'}
        onAyuda={() => {
          reabrirTour('mapa');
          setVerTour(true);
        }}
      />

      {/*
        Por qué pedimos la ubicación, antes de pedirla. Un permiso que salta solo y
        sin contexto se deniega de entrada, y una vez denegado el navegador no
        vuelve a preguntar: hay que ir a la configuración del sitio a mano.

        No tapa el mapa ni exige contestar: se puede ignorar y seguir usando todo.
      */}
      {!isPending &&
        !isError &&
        !avisoUbicacionCerrado &&
        permiso !== 'granted' &&
        permiso !== 'desconocido' && (
          <div className={`hoja flotante absolute ${PANEL_SOBRE_EL_PIE} left-1/2 z-[500] w-[90%] max-w-sm -translate-x-1/2 rounded-2xl p-4`}>
            <p className="mb-3 text-sm text-white/80">
              {permiso === 'denied'
                ? 'Tenés la ubicación bloqueada para este sitio. Se habilita desde el candado de la barra de direcciones, y sirve para ordenar los circuitos por cercanía.'
                : 'Si compartís tu ubicación, ordenamos los circuitos por los que te quedan más cerca.'}
            </p>
            <div className="flex gap-2">
              {permiso !== 'denied' && (
                <Button variante="primary" className="flex-1" onClick={() => locateMe(true)}>
                  Usar mi ubicación
                </Button>
              )}
              <Button
                variante="secondary"
                ancho={permiso === 'denied'}
                className={permiso === 'denied' ? '' : 'shrink-0'}
                onClick={() => setAvisoUbicacionCerrado(true)}
              >
                {permiso === 'denied' ? 'Entendido' : 'Ahora no'}
              </Button>
            </div>
          </div>
        )}

      {/*
        El mapa ocupa la pantalla entera, así que no hay "abajo de todo" donde poner
        un pie: va en la esquina opuesta a la atribución de Leaflet y en su mismo
        z-400, para que se lea como cromo del mapa y no como interfaz.

        Va en cápsula `flotante` y no como texto suelto por lo mismo que la
        atribución: sobre el arenal claro de Chilecito, un texto blanco al 40 % es
        directamente ilegible. El z-400 explícito convive con el z-600 de la hoja
        del circuito, que es lo que exige el contexto de apilado del backdrop-blur.

        Va levantado 1,5rem porque en teléfono la atribución ocupa todo el ancho de
        la última franja, y taparla no es una opción: es la licencia de los tiles.

        Desde que "Sumá tu circuito" dejó de ser un enlace más de la fila, la
        esquina es una columna: la pastilla arriba, la letra chica debajo. El
        `max-w-[58%]` pasó a este contenedor —sigue siendo el ancho que deja libre
        la atribución— y el z-400 también, así que las dos cosas se apilan igual que
        antes respecto de la hoja del circuito.
      */}
      <div className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-2 z-[400] flex max-w-[58%] flex-col items-start gap-2">
        <BotonProponer />
        <PieSitio
          accion={false}
          className="flotante rounded-lg px-2.5 py-1.5 text-[10px] text-white/70"
        />
      </div>

      {isPending && (
        <p className="hoja flotante absolute top-1/2 left-1/2 z-[500] max-w-[85%] -translate-x-1/2 rounded-full px-4 py-2.5 text-center text-sm font-medium">
          {despertando ? 'Despertando el servidor, puede tardar un minuto…' : 'Cargando circuitos…'}
        </p>
      )}

      {/*
        Los dos casos que antes dejaban un mapa mudo: la API no responde, o todavía
        no hay nada cargado. El toast de error se iba a los cuatro segundos y quien
        llegaba después quedaba mirando un mapa vacío sin saber si buscó mal o si el
        sitio está roto.
      */}
      {isError && (
        <div className={`hoja flotante absolute ${PANEL_SOBRE_EL_PIE} left-1/2 z-[500] w-[90%] max-w-sm -translate-x-1/2 rounded-2xl p-4 text-center`}>
          <p className="mb-1 text-sm font-semibold text-white">No pudimos traer los circuitos</p>
          <p className="mb-3 text-sm text-white/70">
            Puede ser tu conexión, o que el servidor se esté despertando.
          </p>
          <Button variante="primary" ancho onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {!isPending && !isError && (allCircuits?.length ?? 0) === 0 && (
        <div className={`hoja flotante absolute ${PANEL_SOBRE_EL_PIE} left-1/2 z-[500] w-[90%] max-w-sm -translate-x-1/2 rounded-2xl p-4 text-center`}>
          <p className="mb-1 text-sm font-semibold text-white">Todavía no hay circuitos</p>
          <p className="text-sm text-white/70">
            Estamos cargando los primeros. Volvé en unos días y va a haber dónde andar.
          </p>
        </div>
      )}

      {/* sin resultados dentro del radio buscado */}
      {place && !isPending && !isError && circuits.length === 0 && (
        <div className={`hoja flotante absolute ${PANEL_SOBRE_EL_PIE} left-1/2 z-[500] w-[90%] max-w-sm -translate-x-1/2 rounded-2xl p-4 text-center`}>
          <p className="mb-3 text-sm text-white/80">
            No hay circuitos a menos de {Math.round(radiusM / 1000)} km de{' '}
            <strong className="font-semibold text-white">{place.name}</strong>.
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
          className="hoja flotante absolute right-0 bottom-0 left-0 z-[600] mx-auto max-w-xl rounded-t-2xl px-4 pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-sheet sm:bottom-4 sm:w-[95%] sm:rounded-2xl"
        >
          {/* el tirador dice "esto es una hoja que se puede cerrar" sin una palabra */}
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/25" />

          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              {/* la disciplina y el lugar van arriba y chicos: son el contexto, no el dato */}
              <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-white/60 uppercase">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: DISCIPLINE_COLOR[selected.discipline] }}
                  aria-hidden="true"
                />
                {DISCIPLINES.find((d) => d.slug === selected.discipline)?.name}
                {selected.locality ? ` · ${selected.locality}` : ''}
              </p>
              <h2 className="titulo truncate text-xl text-white">{selected.name}</h2>
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="Cerrar"
              className="-mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-white/60 transition-colors duration-[var(--duracion-rapida)] hover:bg-white/12 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/*
            Tres datos como datos y no como tres píldoras iguales. Cuando todo tiene
            la misma forma y el mismo peso, nada se lee primero y la tarjeta parece
            un formulario. Acá el valor va grande y la etiqueta chica debajo.
          */}
          <dl
            className={`mb-4 grid gap-2 border-y border-white/10 py-2.5 ${
              selectedAway !== null ? 'grid-cols-3' : 'grid-cols-2'
            }`}
          >
            <div>
              <dd className="text-lg leading-tight font-bold text-white tabular-nums">
                {formatKm(selected.distanceM)}
              </dd>
              <dt className="text-[11px] text-white/50">Recorrido</dt>
            </div>
            <div>
              <dd
                className={`text-lg leading-tight font-bold ${DIFFICULTY_TEXT[selected.difficulty]}`}
              >
                {DIFFICULTY_LABEL[selected.difficulty]}
              </dd>
              <dt className="text-[11px] text-white/50">Dificultad</dt>
            </div>
            {/*
              La distancia hasta el circuito solo existe si sabemos desde dónde: con
              el permiso de ubicación denegado y sin búsqueda, esta columna quedaba
              con un guion y una etiqueta suelta. Un dato vacío ocupa lugar y no
              informa: mejor que la grilla pase a dos columnas.
            */}
            {selectedAway !== null && (
              <div>
                <dd className="text-lg leading-tight font-bold text-white">
                  {formatDistanceAway(selectedAway).replace('a ', '')}
                </dd>
                <dt className="truncate text-[11px] text-white/50">
                  {place ? `de ${place.name}` : 'De tu ubicación'}
                </dt>
              </div>
            )}
          </dl>
          {/* el acceso condiciona si el viaje se puede hacer: va antes de la acción */}
          <p
            className={`mb-3 flex items-center gap-1.5 text-sm ${
              selected.accessType === 'libre' ? 'text-white/70' : 'text-amber-300'
            }`}
          >
            <span aria-hidden="true">{selected.accessType === 'libre' ? '✓' : '⚠'}</span>
            {ACCESS_LABEL[selected.accessType]}
          </p>

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

      {verTour && (
        <Tour
          etiqueta="Cómo se usa el mapa"
          pasos={PASOS_MAPA}
          onCerrar={() => {
            marcarTourVisto('mapa');
            setVerTour(false);
          }}
        />
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
