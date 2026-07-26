import type { CircuitDetail, CircuitSummary } from '@circuitos/shared';
import { notFound } from '../../lib/errors.js';
import type { CircuitListFilters, CircuitsRepository } from './repository.js';

export function circuitsService(repo: CircuitsRepository) {
  return {
    list(filters: CircuitListFilters): Promise<CircuitSummary[]> {
      return repo.list(filters);
    },

    async detail(slug: string): Promise<CircuitDetail> {
      const circuit = await repo.detailBySlug(slug);
      if (!circuit) throw notFound('Circuito no encontrado');
      return circuit;
    },
  };
}

export type CircuitsService = ReturnType<typeof circuitsService>;
