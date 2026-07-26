import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  AdminCircuitListItem,
  CircuitCreateFields,
  CircuitUpdateBody,
} from '@circuitos/shared';
import type { Config } from '../../config.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { processGpx, trackToWkt } from '../../lib/gpx.js';
import { uniqueSlug } from '../../lib/slug.js';
import type { AdminRepository, CircuitUpdateSets } from './repository.js';

const IMAGE_TYPES: { ext: string; mime: string; matches: (b: Buffer) => boolean }[] = [
  { ext: 'jpg', mime: 'image/jpeg', matches: (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
  { ext: 'png', mime: 'image/png', matches: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  {
    ext: 'webp',
    mime: 'image/webp',
    matches: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

export function adminService(config: Config, repo: AdminRepository) {
  async function saveGpxFile(slug: string, gpxBuffer: Buffer): Promise<string> {
    await mkdir(config.GPX_DIR, { recursive: true });
    const filePath = path.join(config.GPX_DIR, `${slug}.gpx`);
    await writeFile(filePath, gpxBuffer);
    return `/gpx/${slug}.gpx`;
  }

  async function resolveRefs(
    discipline?: string,
    province?: string,
  ): Promise<{ disciplineId?: number; provinceId?: number }> {
    const result: { disciplineId?: number; provinceId?: number } = {};
    if (discipline !== undefined) {
      const id = await repo.disciplineIdBySlug(discipline);
      if (id === null) throw badRequest('DISCIPLINA_INVALIDA', `Disciplina desconocida: ${discipline}`);
      result.disciplineId = id;
    }
    if (province !== undefined) {
      const id = await repo.provinceIdBySlug(province);
      if (id === null) throw badRequest('PROVINCIA_INVALIDA', `Provincia desconocida: ${province}`);
      result.provinceId = id;
    }
    return result;
  }

  return {
    list(): Promise<AdminCircuitListItem[]> {
      return repo.listAll();
    },

    async create(fields: CircuitCreateFields, gpxBuffer: Buffer): Promise<{ id: string; slug: string }> {
      const { disciplineId, provinceId } = await resolveRefs(fields.discipline, fields.province);
      const track = processGpx(gpxBuffer.toString('utf8'));
      const slug = await uniqueSlug(fields.name, (s) => repo.slugExists(s));
      const wkt = trackToWkt(track.coordinates);
      const gpxUrl = await saveGpxFile(slug, gpxBuffer);

      return repo.create({
        slug,
        name: fields.name,
        description: fields.description ?? null,
        disciplineId: disciplineId!,
        provinceId: provinceId!,
        locality: fields.locality ?? null,
        difficulty: fields.difficulty,
        accessType: fields.accessType,
        accessNotes: fields.accessNotes ?? null,
        trackWkt: wkt.track,
        startWkt: wkt.start,
        distanceM: track.distanceM,
        elevationGainM: track.elevationGainM,
        gpxUrl,
        schedules: fields.schedules ?? [],
      });
    },

    async update(id: string, body: CircuitUpdateBody): Promise<void> {
      const existing = await repo.findById(id);
      if (!existing) throw notFound('Circuito no encontrado');

      const refs = await resolveRefs(body.discipline, body.province);
      const sets: CircuitUpdateSets = {
        name: body.name,
        description: body.description,
        locality: body.locality,
        difficulty: body.difficulty,
        accessType: body.accessType,
        accessNotes: body.accessNotes,
        status: body.status,
        schedules: body.schedules,
        ...refs,
      };
      await repo.update(id, sets);
    },

    /** Reemplaza el GPX de un circuito re-ejecutando el pipeline completo. */
    async replaceGpx(id: string, gpxBuffer: Buffer): Promise<void> {
      const existing = await repo.findById(id);
      if (!existing) throw notFound('Circuito no encontrado');

      const track = processGpx(gpxBuffer.toString('utf8'));
      const wkt = trackToWkt(track.coordinates);
      const gpxUrl = await saveGpxFile(existing.slug, gpxBuffer);

      await repo.update(id, {
        trackWkt: wkt.track,
        startWkt: wkt.start,
        distanceM: track.distanceM,
        elevationGainM: track.elevationGainM,
        gpxUrl,
      });
    },

    /** Soft delete: el circuito pasa a archived, nunca se borra la fila. */
    async archive(id: string): Promise<void> {
      const existing = await repo.findById(id);
      if (!existing) throw notFound('Circuito no encontrado');
      await repo.update(id, { status: 'archived' });
    },

    async addMedia(id: string, file: Buffer): Promise<{ url: string }> {
      const existing = await repo.findById(id);
      if (!existing) throw notFound('Circuito no encontrado');

      const type = IMAGE_TYPES.find((t) => t.matches(file));
      if (!type) {
        throw badRequest('IMAGEN_INVALIDA', 'Solo se aceptan imágenes JPEG, PNG o WebP');
      }

      const dir = path.join(config.MEDIA_DIR, id);
      await mkdir(dir, { recursive: true });
      const fileName = `${Date.now()}.${type.ext}`;
      await writeFile(path.join(dir, fileName), file);

      const url = `/media/${id}/${fileName}`;
      await repo.addMedia(id, url, 'photo');
      return { url };
    },
  };
}

export type AdminService = ReturnType<typeof adminService>;
