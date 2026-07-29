import { IconoMapa, IconoSatelite } from './map-icons';
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
      className={`flotante inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors duration-[var(--duracion-rapida)] ease-suave hover:bg-white/12 motion-safe:active:scale-[0.97] ${className}`}
    >
      {next === 'satelite' ? <IconoSatelite size={18} /> : <IconoMapa size={18} />}
      {next === 'satelite' ? 'Satélite' : 'Mapa'}
    </button>
  );
}
