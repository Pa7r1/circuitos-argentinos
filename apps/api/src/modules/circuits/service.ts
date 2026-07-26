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

    async photo(url: string): Promise<{ data: Buffer; contentType: string }> {
      const foto = await repo.mediaByUrl(url);
      if (!foto) throw notFound('Foto no encontrada');
      return foto;
    },

    async gpx(slug: string): Promise<{ fileName: string; content: Buffer }> {
      const archivo = await repo.gpxBySlug(slug);
      if (!archivo) throw notFound('Este circuito no tiene archivo GPX disponible');
      return archivo;
    },
  };
}

export type CircuitsService = ReturnType<typeof circuitsService>;
