import type { MapLayer } from '../lib/map-style';

/** Botón para alternar entre foto satelital y mapa de calles. */
export function MapLayerToggle({
  layer,
  onChange,
  className = '',
}: {
  layer: MapLayer;
  onChange: (layer: MapLayer) => void;
  className?: string;
}) {
  const next: MapLayer = layer === 'satelite' ? 'mapa' : 'satelite';
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      aria-label={next === 'satelite' ? 'Ver foto satelital' : 'Ver mapa de calles'}
      className={`min-h-11 rounded-lg bg-white/95 px-3 text-sm font-medium shadow-md hover:bg-white ${className}`}
    >
      {next === 'satelite' ? '🛰️ Satélite' : '🗺️ Mapa'}
    </button>
  );
}
