import { useEffect, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { MapLayer } from '../lib/map-style';

/**
 * Controles del mapa en una sola columna: acercar, alejar, mi ubicación y capa.
 *
 * Son botones propios y no `L.control.zoom` porque el control de Leaflet trae su
 * propia estética y hay que pelearle el CSS para integrarlo. Además, en un
 * teléfono el zoom se hace con los dedos, pero en computadora sin estos botones
 * solo queda la rueda del mouse.
 */
export function MapControls({
  map,
  layer,
  onLayerChange,
  onLocate,
}: {
  map: LeafletMap | null;
  layer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  onLocate: () => void;
}) {
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    if (!map) return;
    const actualizar = () => setZoom(map.getZoom());
    actualizar();
    map.on('zoomend', actualizar);
    return () => {
      map.off('zoomend', actualizar);
    };
  }, [map]);

  // el paso va forzado a 1: con el zoomSnap de 0.25 que usa el encuadre, cada
  // clic movería un cuarto de nivel y el botón se sentiría roto
  const acercar = () => map?.zoomIn(1);
  const alejar = () => map?.zoomOut(1);

  const topeArriba = map !== null && zoom !== null && zoom >= map.getMaxZoom();
  const topeAbajo = map !== null && zoom !== null && zoom <= map.getMinZoom();
  const siguienteCapa: MapLayer = layer === 'satelite' ? 'mapa' : 'satelite';

  return (
    <div className="absolute top-1/2 right-3 z-[500] flex -translate-y-1/2 flex-col gap-2">
      <div className="flotante flex flex-col overflow-hidden rounded-xl">
        <Boton
          onClick={acercar}
          disabled={topeArriba}
          etiqueta="Acercar el mapa"
          className="border-b border-stone-200"
        >
          +
        </Boton>
        <Boton onClick={alejar} disabled={topeAbajo} etiqueta="Alejar el mapa">
          −
        </Boton>
      </div>

      <Boton
        onClick={onLocate}
        etiqueta="Centrar el mapa en mi ubicación"
        className="flotante rounded-xl"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          ◎
        </span>
      </Boton>

      <Boton
        onClick={() => onLayerChange(siguienteCapa)}
        etiqueta={siguienteCapa === 'satelite' ? 'Ver foto satelital' : 'Ver mapa de calles'}
        className="flotante rounded-xl"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          {siguienteCapa === 'satelite' ? '🛰️' : '🗺️'}
        </span>
      </Boton>
    </div>
  );
}

function Boton({
  onClick,
  disabled,
  etiqueta,
  className = '',
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  etiqueta: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      className={`flex h-11 w-11 items-center justify-center text-xl font-semibold text-stone-800 transition-colors hover:bg-stone-100 disabled:text-stone-300 disabled:hover:bg-transparent ${className}`}
    >
      {children}
    </button>
  );
}
