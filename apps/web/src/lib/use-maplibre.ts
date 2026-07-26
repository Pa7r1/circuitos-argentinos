import { useEffect, useState } from 'react';

type Maplibre = typeof import('maplibre-gl');

let cached: Maplibre | null = null;

/**
 * Carga maplibre-gl bajo demanda: es más de 1 MB y bloquea el hilo principal al
 * parsearse, así que el shell de la pantalla pinta antes de que llegue el mapa.
 */
export function useMaplibre(): Maplibre | null {
  const [gl, setGl] = useState<Maplibre | null>(cached);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    void import('maplibre-gl').then((mod) => {
      cached = mod;
      if (alive) setGl(mod);
    });
    return () => {
      alive = false;
    };
  }, []);

  return gl;
}
