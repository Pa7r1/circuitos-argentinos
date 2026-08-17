import { useQuery } from '@tanstack/react-query';
import type { CircuitListQuery } from '@circuitos/shared';
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
  adminList: ['admin-circuits'] as const,
};

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

export function useAdminCircuits(enabled: boolean) {
  return useQuery({
    queryKey: circuitKeys.adminList,
    queryFn: () => api.admin.list(),
    enabled,
    staleTime: 0,
  });
}
