import { sql, type SQL } from 'drizzle-orm';
import type {
  CircuitDetail,
  CircuitMedia,
  CircuitSchedule,
  CircuitSummary,
  GeoJsonLineString,
  GeoJsonPoint,
} from '@circuitos/shared';
import type { Db } from '../../db/index.js';

export interface CircuitListFilters {
  lat?: number;
  lon?: number;
  radiusM: number;
  discipline?: string;
  province?: string;
}

interface SummaryRow {
  slug: string;
  name: string;
  difficulty: CircuitSummary['difficulty'];
  access_type: CircuitSummary['accessType'];
  distance_m: number;
  discipline: string;
  locality: string | null;
  start_point: string;
  meters_away: string | null;
}

export function circuitsRepository(db: Db) {
  return {
    async list(filters: CircuitListFilters): Promise<CircuitSummary[]> {
      const conds: SQL[] = [sql`c.status = 'published'`];
      if (filters.discipline) conds.push(sql`d.slug = ${filters.discipline}`);
      if (filters.province) conds.push(sql`p.slug = ${filters.province}`);

      const hasGeo = filters.lat !== undefined && filters.lon !== undefined;
      const point = hasGeo
        ? sql`ST_SetSRID(ST_MakePoint(${filters.lon}, ${filters.lat}), 4326)::geography`
        : null;
      if (point) conds.push(sql`ST_DWithin(c.start_point, ${point}, ${filters.radiusM})`);

      const rows = await db.execute(sql`
        SELECT c.slug, c.name, c.difficulty, c.access_type, c.distance_m,
               d.slug AS discipline, c.locality,
               ST_AsGeoJSON(c.start_point) AS start_point,
               ${point ? sql`ST_Distance(c.start_point, ${point})` : sql`NULL`} AS meters_away
        FROM circuits c
        JOIN disciplines d ON d.id = c.discipline_id
        JOIN provinces p ON p.id = c.province_id
        WHERE ${sql.join(conds, sql` AND `)}
        ORDER BY ${point ? sql`meters_away ASC` : sql`c.name ASC`}
        LIMIT 200
      `);

      return (rows as unknown as SummaryRow[]).map((r) => ({
        slug: r.slug,
        name: r.name,
        difficulty: r.difficulty,
        accessType: r.access_type,
        distanceM: r.distance_m,
        discipline: r.discipline,
        locality: r.locality,
        startPoint: JSON.parse(r.start_point) as GeoJsonPoint,
        ...(r.meters_away !== null ? { metersAway: Math.round(Number(r.meters_away)) } : {}),
      }));
    },

    /**
     * Foto guardada en la base. La URL es la clave: es única por circuito.
     *
     * Esta ruta es pública y sin token, así que sirve **solo** lo publicado. Un
     * circuito que no está `published` no tiene por qué ser visible desde afuera:
     * `archived` estuvo público y su URL puede haber quedado en un caché o en un
     * historial, `rechazado` es un circuito que decidimos que no va y cuyas fotos
     * subió cualquiera con cuenta, y `draft`/`propuesto` todavía no se mostraron
     * nunca.
     *
     * Antes se dejaban pasar `draft` y `propuesto` porque el panel pedía las
     * miniaturas con un `<img src>` plano, que no manda el token, y filtrarlos lo
     * dejaba sin imágenes justo mientras se decidía si publicar. Ese motivo ya no
     * existe: el panel tiene su propia vía autenticada
     * (`GET /api/v1/admin/circuits/:id/media/:fileName`), que sirve los bytes sin
     * mirar el estado. No volver a abrir esta consulta a otros estados.
     */
    async mediaByUrl(url: string): Promise<{ data: Buffer; contentType: string } | null> {
      const rows = (await db.execute(sql`
        SELECT m.data, m.content_type
        FROM circuit_media m
        JOIN circuits c ON c.id = m.circuit_id
        WHERE m.url = ${url} AND c.status = 'published'
      `)) as unknown as { data: Buffer; content_type: string }[];
      const row = rows[0];
      return row ? { data: row.data, contentType: row.content_type } : null;
    },

    /** GPX original de un circuito publicado. */
    async gpxBySlug(slug: string): Promise<{ fileName: string; content: Buffer } | null> {
      const rows = (await db.execute(sql`
        SELECT g.file_name, g.content
        FROM circuit_gpx g
        JOIN circuits c ON c.id = g.circuit_id
        WHERE c.slug = ${slug} AND c.status = 'published'
      `)) as unknown as { file_name: string; content: Buffer }[];
      const row = rows[0];
      return row ? { fileName: row.file_name, content: row.content } : null;
    },

    async detailBySlug(slug: string): Promise<CircuitDetail | null> {
      const rows = await db.execute(sql`
        SELECT c.id, c.slug, c.name, c.description,
               d.slug AS discipline, p.slug AS province, p.name AS province_name,
               c.locality, c.difficulty, c.access_type, c.access_notes,
               c.distance_m, c.elevation_gain_m, c.external_map_url,
               ST_AsGeoJSON(c.start_point) AS start_point,
               -- null en los circuitos cargados con enlace, que no tienen trazado
               ST_AsGeoJSON(c.track) AS track,
               -- se pregunta por el archivo, no por gpx_url: en producción hay
               -- filas con el GPX guardado y esa columna en null, y la descarga
               -- desaparecía de una ficha que sí tenía archivo
               EXISTS (SELECT 1 FROM circuit_gpx g WHERE g.circuit_id = c.id) AS has_gpx,
               -- horarios y fotos en la misma consulta: la API y la base están en
               -- regiones distintas y cada ida y vuelta extra se nota en la ficha
               COALESCE((
                 SELECT json_agg(json_build_object(
                          'dayOfWeek', s.day_of_week, 'opens', s.opens,
                          'closes', s.closes, 'note', s.note)
                        ORDER BY s.day_of_week)
                 FROM circuit_schedules s WHERE s.circuit_id = c.id
               ), '[]'::json) AS schedules,
               COALESCE((
                 SELECT json_agg(json_build_object(
                          'url', m.url, 'kind', m.kind, 'position', m.position)
                        ORDER BY m.position)
                 FROM circuit_media m WHERE m.circuit_id = c.id
               ), '[]'::json) AS media
        FROM circuits c
        JOIN disciplines d ON d.id = c.discipline_id
        JOIN provinces p ON p.id = c.province_id
        WHERE c.slug = ${slug} AND c.status = 'published'
      `);
      const row = (rows as unknown as Record<string, unknown>[])[0];
      if (!row) return null;

      const schedules = row.schedules as CircuitSchedule[];
      const media = row.media as CircuitMedia[];

      return {
        slug: row.slug as string,
        name: row.name as string,
        description: row.description as string | null,
        discipline: row.discipline as string,
        province: row.province as string,
        provinceName: row.province_name as string,
        locality: row.locality as string | null,
        difficulty: row.difficulty as CircuitDetail['difficulty'],
        accessType: row.access_type as CircuitDetail['accessType'],
        accessNotes: row.access_notes as string | null,
        distanceM: row.distance_m as number,
        elevationGainM: row.elevation_gain_m as number | null,
        startPoint: JSON.parse(row.start_point as string) as GeoJsonPoint,
        track: row.track ? (JSON.parse(row.track as string) as GeoJsonLineString) : null,
        externalMapUrl: row.external_map_url as string | null,
        hasGpx: row.has_gpx as boolean,
        // la columna es `time`: llega como "09:00:00" y la ficha muestra "09:00"
        schedules: schedules.map((s): CircuitSchedule => ({
          dayOfWeek: s.dayOfWeek,
          opens: s.opens?.slice(0, 5) ?? null,
          closes: s.closes?.slice(0, 5) ?? null,
          note: s.note,
        })),
        media: media.map((m) => ({ url: m.url, kind: m.kind, position: m.position })),
      };
    },
  };
}

export type CircuitsRepository = ReturnType<typeof circuitsRepository>;
