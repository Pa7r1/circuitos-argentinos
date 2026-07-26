import { sql, type SQL } from 'drizzle-orm';
import type { AdminCircuitDetail, AdminCircuitListItem, ScheduleInput } from '@circuitos/shared';
import type { Db } from '../../db/index.js';

export interface CircuitInsert {
  slug: string;
  name: string;
  description: string | null;
  disciplineId: number;
  provinceId: number;
  locality: string | null;
  difficulty: string;
  accessType: string;
  accessNotes: string | null;
  trackWkt: string;
  startWkt: string;
  distanceM: number;
  elevationGainM: number | null;
  gpxUrl: string;
  schedules: ScheduleInput[];
}

export interface CircuitUpdateSets {
  name?: string;
  description?: string | null;
  disciplineId?: number;
  provinceId?: number;
  locality?: string | null;
  difficulty?: string;
  accessType?: string;
  accessNotes?: string | null;
  status?: string;
  trackWkt?: string;
  startWkt?: string;
  distanceM?: number;
  elevationGainM?: number | null;
  gpxUrl?: string;
  schedules?: ScheduleInput[];
}

export function adminRepository(db: Db) {
  async function insertSchedules(
    tx: Pick<Db, 'execute'>,
    circuitId: string,
    schedules: ScheduleInput[],
  ): Promise<void> {
    for (const s of schedules) {
      await tx.execute(sql`
        INSERT INTO circuit_schedules (circuit_id, day_of_week, opens, closes, note)
        VALUES (${circuitId}, ${s.dayOfWeek}, ${s.opens ?? null}, ${s.closes ?? null}, ${s.note ?? null})
      `);
    }
  }

  return {
    async slugExists(slug: string): Promise<boolean> {
      const rows = await db.execute(sql`SELECT 1 FROM circuits WHERE slug = ${slug}`);
      return (rows as unknown as unknown[]).length > 0;
    },

    async disciplineIdBySlug(slug: string): Promise<number | null> {
      const rows = (await db.execute(
        sql`SELECT id FROM disciplines WHERE slug = ${slug}`,
      )) as unknown as { id: number }[];
      return rows[0]?.id ?? null;
    },

    async provinceIdBySlug(slug: string): Promise<number | null> {
      const rows = (await db.execute(
        sql`SELECT id FROM provinces WHERE slug = ${slug}`,
      )) as unknown as { id: number }[];
      return rows[0]?.id ?? null;
    },

    async findById(id: string): Promise<{ id: string; slug: string; status: string } | null> {
      const rows = (await db.execute(
        sql`SELECT id, slug, status FROM circuits WHERE id = ${id}`,
      )) as unknown as { id: string; slug: string; status: string }[];
      return rows[0] ?? null;
    },

    async fullById(id: string): Promise<AdminCircuitDetail | null> {
      const rows = (await db.execute(sql`
        SELECT c.id, c.slug, c.name, c.description, d.slug AS discipline, p.slug AS province,
               c.locality, c.difficulty, c.access_type, c.access_notes, c.status,
               c.distance_m, c.elevation_gain_m
        FROM circuits c
        JOIN disciplines d ON d.id = c.discipline_id
        JOIN provinces p ON p.id = c.province_id
        WHERE c.id = ${id}
      `)) as unknown as Record<string, unknown>[];
      const row = rows[0];
      if (!row) return null;

      const schedules = (await db.execute(sql`
        SELECT day_of_week, opens, closes, note FROM circuit_schedules
        WHERE circuit_id = ${id} ORDER BY day_of_week ASC
      `)) as unknown as { day_of_week: number; opens: string | null; closes: string | null; note: string | null }[];
      const media = (await db.execute(sql`
        SELECT url, kind, position FROM circuit_media
        WHERE circuit_id = ${id} ORDER BY position ASC
      `)) as unknown as { url: string; kind: 'photo' | 'video'; position: number }[];

      return {
        id: row.id as string,
        slug: row.slug as string,
        name: row.name as string,
        description: row.description as string | null,
        discipline: row.discipline as string,
        province: row.province as string,
        locality: row.locality as string | null,
        difficulty: row.difficulty as AdminCircuitDetail['difficulty'],
        accessType: row.access_type as AdminCircuitDetail['accessType'],
        accessNotes: row.access_notes as string | null,
        status: row.status as AdminCircuitDetail['status'],
        distanceM: row.distance_m as number,
        elevationGainM: row.elevation_gain_m as number | null,
        schedules: schedules.map((s) => ({
          dayOfWeek: s.day_of_week,
          opens: s.opens?.slice(0, 5) ?? null,
          closes: s.closes?.slice(0, 5) ?? null,
          note: s.note,
        })),
        media,
      };
    },

    async listAll(): Promise<AdminCircuitListItem[]> {
      const rows = (await db.execute(sql`
        SELECT c.id, c.slug, c.name, c.status, c.difficulty,
               d.slug AS discipline, p.slug AS province,
               c.distance_m, c.created_at, c.updated_at
        FROM circuits c
        JOIN disciplines d ON d.id = c.discipline_id
        JOIN provinces p ON p.id = c.province_id
        ORDER BY c.updated_at DESC
      `)) as unknown as Record<string, unknown>[];
      return rows.map((r) => ({
        id: r.id as string,
        slug: r.slug as string,
        name: r.name as string,
        status: r.status as AdminCircuitListItem['status'],
        difficulty: r.difficulty as AdminCircuitListItem['difficulty'],
        discipline: r.discipline as string,
        province: r.province as string,
        distanceM: r.distance_m as number,
        createdAt: new Date(r.created_at as string).toISOString(),
        updatedAt: new Date(r.updated_at as string).toISOString(),
      }));
    },

    async create(data: CircuitInsert): Promise<{ id: string; slug: string }> {
      return db.transaction(async (tx) => {
        const rows = (await tx.execute(sql`
          INSERT INTO circuits
            (slug, name, description, discipline_id, province_id, locality, difficulty,
             access_type, access_notes, status, track, start_point, distance_m,
             elevation_gain_m, gpx_url)
          VALUES
            (${data.slug}, ${data.name}, ${data.description}, ${data.disciplineId},
             ${data.provinceId}, ${data.locality}, ${data.difficulty}, ${data.accessType},
             ${data.accessNotes}, 'draft', ST_GeogFromText(${data.trackWkt}),
             ST_GeogFromText(${data.startWkt}), ${data.distanceM}, ${data.elevationGainM},
             ${data.gpxUrl})
          RETURNING id, slug
        `)) as unknown as { id: string; slug: string }[];
        const created = rows[0]!;
        await insertSchedules(tx, created.id, data.schedules);
        return created;
      });
    },

    async update(id: string, sets: CircuitUpdateSets): Promise<void> {
      const fragments: SQL[] = [];
      const map: [keyof CircuitUpdateSets, SQL][] = [
        ['name', sql`name = ${sets.name}`],
        ['description', sql`description = ${sets.description}`],
        ['disciplineId', sql`discipline_id = ${sets.disciplineId}`],
        ['provinceId', sql`province_id = ${sets.provinceId}`],
        ['locality', sql`locality = ${sets.locality}`],
        ['difficulty', sql`difficulty = ${sets.difficulty}`],
        ['accessType', sql`access_type = ${sets.accessType}`],
        ['accessNotes', sql`access_notes = ${sets.accessNotes}`],
        ['status', sql`status = ${sets.status}`],
        ['distanceM', sql`distance_m = ${sets.distanceM}`],
        ['elevationGainM', sql`elevation_gain_m = ${sets.elevationGainM}`],
        ['gpxUrl', sql`gpx_url = ${sets.gpxUrl}`],
      ];
      for (const [key, fragment] of map) {
        if (sets[key] !== undefined) fragments.push(fragment);
      }
      if (sets.trackWkt !== undefined) {
        fragments.push(sql`track = ST_GeogFromText(${sets.trackWkt})`);
      }
      if (sets.startWkt !== undefined) {
        fragments.push(sql`start_point = ST_GeogFromText(${sets.startWkt})`);
      }

      await db.transaction(async (tx) => {
        if (fragments.length > 0) {
          await tx.execute(sql`
            UPDATE circuits SET ${sql.join(fragments, sql`, `)} WHERE id = ${id}
          `);
        }
        if (sets.schedules !== undefined) {
          await tx.execute(sql`DELETE FROM circuit_schedules WHERE circuit_id = ${id}`);
          await insertSchedules(tx, id, sets.schedules);
        }
      });
    },

    async addMedia(circuitId: string, url: string, kind: string): Promise<void> {
      await db.execute(sql`
        INSERT INTO circuit_media (circuit_id, url, kind, position)
        VALUES (
          ${circuitId}, ${url}, ${kind},
          (SELECT COALESCE(MAX(position) + 1, 0) FROM circuit_media WHERE circuit_id = ${circuitId})
        )
      `);
    },
  };
}

export type AdminRepository = ReturnType<typeof adminRepository>;
