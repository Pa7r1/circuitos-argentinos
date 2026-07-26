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

    async detailBySlug(slug: string): Promise<CircuitDetail | null> {
      const rows = await db.execute(sql`
        SELECT c.id, c.slug, c.name, c.description,
               d.slug AS discipline, p.slug AS province, p.name AS province_name,
               c.locality, c.difficulty, c.access_type, c.access_notes,
               c.distance_m, c.elevation_gain_m,
               ST_AsGeoJSON(c.start_point) AS start_point,
               ST_AsGeoJSON(c.track) AS track
        FROM circuits c
        JOIN disciplines d ON d.id = c.discipline_id
        JOIN provinces p ON p.id = c.province_id
        WHERE c.slug = ${slug} AND c.status = 'published'
      `);
      const row = (rows as unknown as Record<string, unknown>[])[0];
      if (!row) return null;

      const id = row.id as string;
      const schedules = (await db.execute(sql`
        SELECT day_of_week, opens, closes, note
        FROM circuit_schedules WHERE circuit_id = ${id}
        ORDER BY day_of_week ASC
      `)) as unknown as { day_of_week: number; opens: string | null; closes: string | null; note: string | null }[];

      const media = (await db.execute(sql`
        SELECT url, kind, position
        FROM circuit_media WHERE circuit_id = ${id}
        ORDER BY position ASC
      `)) as unknown as CircuitMedia[];

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
        track: JSON.parse(row.track as string) as GeoJsonLineString,
        schedules: schedules.map(
          (s): CircuitSchedule => ({
            dayOfWeek: s.day_of_week,
            opens: s.opens?.slice(0, 5) ?? null,
            closes: s.closes?.slice(0, 5) ?? null,
            note: s.note,
          }),
        ),
        media: media.map((m) => ({ url: m.url, kind: m.kind, position: m.position })),
      };
    },
  };
}

export type CircuitsRepository = ReturnType<typeof circuitsRepository>;
