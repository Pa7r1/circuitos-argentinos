import { useQuery } from '@tanstack/react-query';
import type { CircuitListQuery } from '@circuitos/shared';
import { api } from './api';

export const circuitKeys = {
  all: ['circuits'] as const,
  list: (query: CircuitListQuery) => [...circuitKeys.all, 'list', query] as const,
  detail: (slug: string) => [...circuitKeys.all, 'detail', slug] as const,
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
  return useQuery({
    queryKey: circuitKeys.detail(slug),
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
