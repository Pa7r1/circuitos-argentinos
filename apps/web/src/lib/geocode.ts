import { useQuery } from '@tanstack/react-query';

/** Lugar encontrado en el catálogo oficial de toponimia argentina. */
export interface Place {
  id: string;
  name: string;
  /** provincia y departamento, para desambiguar homónimos */
  detail: string;
  lonLat: [number, number];
}

const GEOREF = 'https://apis.datos.gob.ar/georef/api';

interface GeorefEntry {
  id: string;
  nombre: string;
  centroide: { lat: number; lon: number };
  provincia?: { nombre: string };
  departamento?: { nombre: string };
}

function toPlaces(entries: GeorefEntry[]): Place[] {
  return entries.map((e) => ({
    id: e.id,
    name: e.nombre,
    detail: [e.departamento?.nombre, e.provincia?.nombre].filter(Boolean).join(', '),
    lonLat: [e.centroide.lon, e.centroide.lat],
  }));
}

async function fetchFrom(resource: 'localidades' | 'departamentos', q: string): Promise<Place[]> {
  const url = `${GEOREF}/${resource}?nombre=${encodeURIComponent(q)}&max=8&campos=id,nombre,centroide,provincia,departamento`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Georef respondió ${res.status}`);
  const data = (await res.json()) as Record<string, GeorefEntry[]>;
  return toPlaces(data[resource] ?? []);
}

/** Busca localidades; si no hay ninguna, prueba con departamentos. */
export async function searchPlaces(q: string): Promise<Place[]> {
  const localidades = await fetchFrom('localidades', q);
  if (localidades.length > 0) return localidades;
  return fetchFrom('departamentos', q);
}

export function usePlaceSearch(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: ['places', q],
    queryFn: () => searchPlaces(q),
    enabled: q.length >= 3,
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
}
