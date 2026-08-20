import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { CircuitListQuery, CircuitStatus } from '@circuitos/shared';
import { api } from './api';
import { useSession } from './use-session';

export const circuitKeys = {
  all: ['circuits'] as const,
  list: (query: CircuitListQuery) => [...circuitKeys.all, 'list', query] as const,
  /**
   * La ficha depende de quién la pide, y por eso el visitante entra en la clave.
   *
   * Sin esto, quien abría un enlace compartido sin cuenta guardaba el 401 del
   * peaje bajo esta clave; al registrarse ahí mismo, la clave seguía siendo la
   * misma y la respuesta cacheada también, así que **se quedaba mirando la
   * pantalla de registro con la sesión ya iniciada**. El `retry` del QueryClient
   * no reintenta 4xx —el 401 es una respuesta válida, no un fallo—, de modo que
   * nada volvía a pedirlo. Con el visitante adentro, iniciar sesión es una clave
   * nueva y la ficha se pide de nuevo, ahora con el token puesto.
   */
  detail: (slug: string, visitante: string) =>
    [...circuitKeys.all, 'detail', slug, visitante] as const,
  /**
   * Prefijo de todas las páginas del panel: invalidarlo alcanza para las
   * páginas y filtros que estén cacheados, sin tener que enumerarlos.
   */
  adminList: ['admin-circuits'] as const,
  adminPagina: (params: AdminListParams) => [...circuitKeys.adminList, params] as const,
  adminStats: ['admin-stats'] as const,
};

export interface AdminListParams {
  limit: number;
  offset: number;
  /** Sin estado, el servidor devuelve los cinco en su orden de prioridad. */
  estado?: CircuitStatus;
  /** Texto a buscar en el nombre. Va al servidor: busca en todo, no en la página. */
  q?: string;
}

export function useCircuits(query: CircuitListQuery, enabled = true) {
  return useQuery({
    queryKey: circuitKeys.list(query),
    queryFn: () => api.listCircuits(query),
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCircuitDetail(slug: string) {
  const session = useSession();
  return useQuery({
    queryKey: circuitKeys.detail(slug, session?.user.id ?? 'anonimo'),
    queryFn: () => api.circuitDetail(slug),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Página del listado del panel. Los parámetros entran en la clave: sin eso, dos
 * páginas distintas compartían caché y la segunda mostraba la primera.
 *
 * `placeholderData` deja la página anterior en pantalla mientras llega la
 * siguiente: sin eso, cada clic en «Siguiente» vaciaba la lista y la altura de
 * la página saltaba.
 */
export function useAdminCircuits(enabled: boolean, params: AdminListParams) {
  return useQuery({
    queryKey: circuitKeys.adminPagina(params),
    queryFn: () => api.admin.listPaginado(params),
    enabled,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
}

/** Contadores del panel: los comparten el resumen de arriba y la chapa de propuestas. */
export function useAdminStats(enabled: boolean) {
  return useQuery({
    queryKey: circuitKeys.adminStats,
    queryFn: () => api.admin.stats(),
    enabled,
    staleTime: 0,
  });
}
