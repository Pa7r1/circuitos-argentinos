import type {
  AdminCircuitListItem,
  CircuitCreateFields,
  CircuitUpdateBody,
} from '@circuitos/shared';
import type { Config } from '../../config.js';
import { badRequest, DomainError, notFound } from '../../lib/errors.js';
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

/** Dónde se descarga el GPX de un circuito. Se guarda en `circuits.gpx_url`. */
const gpxDownloadUrl = (slug: string) => `/api/v1/circuits/${slug}/gpx`;

/**
 * WKT del punto de partida cargado a mano. Los números ya vienen validados por
 * el esquema de la ruta, así que no hay forma de inyectar nada acá.
 */
const pointWkt = (lon: number, lat: number) => `POINT(${lon} ${lat})`;

export interface AdminStats {
  published: number;
  draft: number;
  archived: number;
  users: number;
}

/** Tope de fotos por propuesta: suficiente para mostrar el lugar, sin volverse un álbum. */
const MAX_FOTOS_PROPUESTA = 3;

export function adminService(
  config: Config,
  repo: AdminRepository,
  countUsers: () => Promise<number>,
) {
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

  /** Guarda una foto ya validada como imagen y devuelve su URL pública. */
  async function guardarFoto(id: string, file: Buffer): Promise<{ url: string }> {
    const existing = await repo.findById(id);
    if (!existing) throw notFound('Circuito no encontrado');

    const type = IMAGE_TYPES.find((t) => t.matches(file));
    if (!type) {
      throw badRequest('IMAGEN_INVALIDA', 'Solo se aceptan imágenes JPEG, PNG o WebP');
    }

    const fileName = `${Date.now()}.${type.ext}`;
    const url = `/media/${id}/${fileName}`;
    await repo.addMedia(id, url, 'photo', file, type.mime);
    return { url };
  }

  return {
    list(): Promise<AdminCircuitListItem[]> {
      return repo.listAll();
    },

    async stats(): Promise<AdminStats> {
      const [counts, users] = await Promise.all([repo.counts(), countUsers()]);
      return {
        published: counts.published ?? 0,
        draft: counts.draft ?? 0,
        archived: counts.archived ?? 0,
        users,
      };
    },

    async removeMedia(id: string, url: string): Promise<void> {
      const existing = await repo.findById(id);
      if (!existing) throw notFound('Circuito no encontrado');
      if (!(await repo.deleteMedia(id, url))) throw notFound('Foto no encontrada');
    },

    async detail(id: string) {
      const circuit = await repo.fullById(id);
      if (!circuit) throw notFound('Circuito no encontrado');
      return circuit;
    },

    /**
     * Alta con GPX o con enlace. Sin GPX, el punto de partida y la distancia los
     * carga el administrador: son justo los datos que el archivo aportaba, y desde
     * Relive o Strava no se puede exportar.
     */
    /**
     * Alta de un circuito. `origen` distingue las dos puertas de entrada: el panel
     * crea borradores propios, y la comunidad propone circuitos que esperan
     * revisión. El estado y el autor **nunca** salen del cuerpo del pedido.
     */
    async create(
      fields: CircuitCreateFields,
      gpxBuffer: Buffer | null,
      origen: { status: string; createdBy: string | null; contactPhone: string | null } = {
        status: 'draft',
        createdBy: null,
        contactPhone: null,
      },
    ): Promise<{ id: string; slug: string }> {
      const { disciplineId, provinceId } = await resolveRefs(fields.discipline, fields.province);
      const slug = await uniqueSlug(fields.name, (s) => repo.slugExists(s));

      const gpx = gpxBuffer ? processGpx(gpxBuffer.toString('utf8')) : null;
      const wkt = gpx ? trackToWkt(gpx.coordinates) : null;

      const creado = await repo.create({
        slug,
        name: fields.name,
        description: fields.description ?? null,
        disciplineId: disciplineId!,
        provinceId: provinceId!,
        locality: fields.locality ?? null,
        difficulty: fields.difficulty,
        accessType: fields.accessType,
        accessNotes: fields.accessNotes ?? null,
        trackWkt: wkt?.track ?? null,
        startWkt: wkt?.start ?? pointWkt(fields.startLon!, fields.startLat!),
        distanceM: gpx?.distanceM ?? fields.distanceM!,
        elevationGainM: gpx?.elevationGainM ?? fields.elevationGainM ?? null,
        gpxUrl: gpxBuffer ? gpxDownloadUrl(slug) : null,
        externalMapUrl: fields.externalMapUrl ?? null,
        status: origen.status,
        createdBy: origen.createdBy,
        contactPhone: origen.contactPhone,
        schedules: fields.schedules ?? [],
      });

      // el archivo va después: la tabla del GPX referencia al circuito
      if (gpxBuffer) await repo.saveGpx(creado.id, `${slug}.gpx`, gpxBuffer);
      return creado;
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
        rejectionReason: body.rejectionReason,
        schedules: body.schedules,
        externalMapUrl: body.externalMapUrl,
        distanceM: body.distanceM,
        elevationGainM: body.elevationGainM,
        ...refs,
      };
      // lat y lon viajan juntos o no viajan: la ruta ya lo exige
      if (body.startLat !== undefined && body.startLon !== undefined) {
        sets.startWkt = pointWkt(body.startLon, body.startLat);
      }
      await repo.update(id, sets);
    },

    /** Reemplaza el GPX de un circuito re-ejecutando el pipeline completo. */
    async replaceGpx(id: string, gpxBuffer: Buffer): Promise<void> {
      const existing = await repo.findById(id);
      if (!existing) throw notFound('Circuito no encontrado');

      const track = processGpx(gpxBuffer.toString('utf8'));
      const wkt = trackToWkt(track.coordinates);

      await repo.update(id, {
        trackWkt: wkt.track,
        startWkt: wkt.start,
        distanceM: track.distanceM,
        elevationGainM: track.elevationGainM,
        gpxUrl: gpxDownloadUrl(existing.slug),
      });
      await repo.saveGpx(id, `${existing.slug}.gpx`, gpxBuffer);
    },

    /** Soft delete: el circuito pasa a archived, nunca se borra la fila. */
    async archive(id: string): Promise<void> {
      const existing = await repo.findById(id);
      if (!existing) throw notFound('Circuito no encontrado');
      await repo.update(id, { status: 'archived' });
    },

    addMedia: guardarFoto,

    /**
     * Foto sobre una propuesta propia y todavía sin revisar.
     *
     * Las dos condiciones importan: sin la de dueño, cualquiera con cuenta le
     * agrega fotos a un circuito ajeno sabiendo su id; sin la de estado, podría
     * seguir editando el circuito después de que vos lo publicaste.
     */
    async addMediaDePropuesta(id: string, userId: string, file: Buffer): Promise<{ url: string }> {
      const duenio = await repo.ownerOf(id);
      if (!duenio) throw notFound('Circuito no encontrado');
      if (duenio.status !== 'propuesto' || duenio.createdBy !== userId) {
        throw new DomainError(403, 'PROHIBIDO', 'Esa propuesta no es tuya');
      }
      if ((await repo.countMedia(id)) >= MAX_FOTOS_PROPUESTA) {
        throw badRequest('DEMASIADAS_FOTOS', `Podés subir hasta ${MAX_FOTOS_PROPUESTA} fotos`);
      }
      return guardarFoto(id, file);
    },
  };
}

export type AdminService = ReturnType<typeof adminService>;
