import { sql, type SQL } from 'drizzle-orm';
import type {
  AdminCircuitDetail,
  AdminCircuitList,
  AdminCircuitListItem,
  GeoJsonPoint,
  ScheduleInput,
} from '@circuitos/shared';
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
  /** null cuando el circuito se carga con un enlace en vez de un GPX. */
  trackWkt: string | null;
  startWkt: string;
  distanceM: number;
  elevationGainM: number | null;
  gpxUrl: string | null;
  externalMapUrl: string | null;
  /** `draft` cuando lo carga el admin, `propuesto` cuando llega de la comunidad. */
  status: string;
  /** Quién lo propuso; null en las altas del panel. */
  createdBy: string | null;
  contactPhone: string | null;
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
  externalMapUrl?: string | null;
  rejectionReason?: string | null;
  schedules?: ScheduleInput[];
}

export interface ListAllOptions {
  limit: number;
  offset: number;
  estado?: string;
  /** Texto libre para buscar por nombre. Ya viene recortado por la ruta. */
  q?: string;
}

/**
 * Nombre comparable: minúsculas y sin acentos. `translate` alcanza para el
 * castellano y no obliga a instalar `unaccent`, que sería una extensión más que
 * habría que crear a mano en la base de producción.
 */
const sinAcentos = (valor: SQL) =>
  sql`translate(lower(${valor}), 'áàäâãéèëêíìïîóòöôõúùüûñ', 'aaaaaeeeeiiiiooooouuuun')`;

/**
 * Lo que escribe la persona es texto, no un patrón: `%` y `_` son comodines de
 * LIKE y hay que neutralizarlos, o buscar "100%" devuelve cualquier cosa. El
 * `\\` se escapa primero porque es el propio carácter de escape.
 */
const patronLike = (q: string): string => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

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

    /** Quién lo propuso y en qué estado está: lo que hace falta para autorizar una foto. */
    async ownerOf(id: string): Promise<{ createdBy: string | null; status: string } | null> {
      const rows = (await db.execute(
        sql`SELECT created_by, status FROM circuits WHERE id = ${id}`,
      )) as unknown as { created_by: string | null; status: string }[];
      const row = rows[0];
      return row ? { createdBy: row.created_by, status: row.status } : null;
    },

    /**
     * Bytes de una foto del panel, sin mirar el estado del circuito: el panel
     * necesita ver las miniaturas de un borrador, de una propuesta y de algo que
     * ya se rechazó, que es justo lo que la ruta pública dejó de servir.
     *
     * La pertenencia se comprueba contra la base: el `circuit_id` de la fila
     * tiene que ser el del pedido. Componer la URL con el `circuitId` recibido no
     * alcanzaría como control —sería comparar cadenas—, así que la condición va
     * sobre la columna.
     */
    async mediaOfCircuit(
      circuitId: string,
      fileName: string,
    ): Promise<{ data: Buffer; contentType: string } | null> {
      const rows = (await db.execute(sql`
        SELECT m.data, m.content_type
        FROM circuit_media m
        WHERE m.circuit_id = ${circuitId} AND m.url = ${`/media/${circuitId}/${fileName}`}
      `)) as unknown as { data: Buffer; content_type: string }[];
      const row = rows[0];
      return row ? { data: row.data, contentType: row.content_type } : null;
    },

    async countMedia(circuitId: string): Promise<number> {
      const rows = (await db.execute(
        sql`SELECT count(*)::int AS total FROM circuit_media WHERE circuit_id = ${circuitId}`,
      )) as unknown as { total: number }[];
      return rows[0]?.total ?? 0;
    },

    async fullById(id: string): Promise<AdminCircuitDetail | null> {
      const rows = (await db.execute(sql`
        SELECT c.id, c.slug, c.name, c.description, d.slug AS discipline, p.slug AS province,
               c.locality, c.difficulty, c.access_type, c.access_notes, c.status,
               c.distance_m, c.elevation_gain_m, c.external_map_url,
               c.contact_phone, c.rejection_reason,
               ST_AsGeoJSON(c.start_point) AS start_point,
               c.track IS NOT NULL AS has_track,
               u.name AS proponente_name, u.email AS proponente_email
        FROM circuits c
        JOIN disciplines d ON d.id = c.discipline_id
        JOIN provinces p ON p.id = c.province_id
        -- LEFT: los circuitos que carga el admin no tienen proponente, y los de
        -- alguien que borró su cuenta tampoco (created_by queda en null)
        LEFT JOIN users u ON u.id = c.created_by
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
        externalMapUrl: row.external_map_url as string | null,
        startPoint: JSON.parse(row.start_point as string) as GeoJsonPoint,
        hasTrack: row.has_track as boolean,
        // el contacto solo existe si el circuito lo propuso alguien con cuenta viva
        proponente: row.proponente_email
          ? {
              name: row.proponente_name as string,
              email: row.proponente_email as string,
              phone: row.contact_phone as string | null,
            }
          : null,
        rejectionReason: row.rejection_reason as string | null,
        schedules: schedules.map((s) => ({
          dayOfWeek: s.day_of_week,
          opens: s.opens?.slice(0, 5) ?? null,
          closes: s.closes?.slice(0, 5) ?? null,
          note: s.note,
        })),
        media,
      };
    },

    /**
     * Una página de la lista del panel.
     *
     * El orden sale del SQL y no del cliente: primero lo publicado, después lo que
     * espera revisión, después lo archivado y al final el resto. Sin `LIMIT` la
     * lista crecía sin techo y se traía la tabla entera en cada apertura del panel.
     *
     * El total viaja en la misma consulta con `count(*) OVER()`: es la cuenta de
     * filas que la ventana ve *antes* del LIMIT, o sea el total del filtro, y
     * ahorra el segundo viaje a la base.
     *
     * El `c.id` del final no es decorativo: `updated_at` no es único —dos circuitos
     * insertados en la misma transacción comparten el valor— y sin un desempate
     * único Postgres no garantiza el mismo orden entre dos consultas. Con LIMIT eso
     * se traduce en una fila que sale en la página 1 y otra vez en la 2, mientras
     * otra no sale en ninguna.
     */
    async listAll(opts: ListAllOptions): Promise<AdminCircuitList> {
      const conds: SQL[] = [];
      if (opts.estado) conds.push(sql`c.status = ${opts.estado}`);
      if (opts.q) {
        conds.push(
          sql`${sinAcentos(sql`c.name`)} LIKE ${sinAcentos(sql`${patronLike(opts.q)}`)} ESCAPE '\\'`,
        );
      }
      const filtro = conds.length > 0 ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;
      const rows = (await db.execute(sql`
        SELECT c.id, c.slug, c.name, c.status, c.difficulty,
               d.slug AS discipline, p.slug AS province,
               c.distance_m, c.created_at, c.updated_at,
               count(*) OVER()::int AS total
        FROM circuits c
        JOIN disciplines d ON d.id = c.discipline_id
        JOIN provinces p ON p.id = c.province_id
        ${filtro}
        ORDER BY CASE c.status
                   WHEN 'published' THEN 0
                   WHEN 'propuesto' THEN 1
                   WHEN 'archived' THEN 2
                   ELSE 3
                 END,
                 c.updated_at DESC,
                 c.id
        LIMIT ${opts.limit} OFFSET ${opts.offset}
      `)) as unknown as Record<string, unknown>[];

      return {
        items: rows.map((r) => ({
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
        })),
        // sin filas la ventana no devuelve nada: la página vacía vale 0
        total: (rows[0]?.total as number | undefined) ?? 0,
        limit: opts.limit,
        offset: opts.offset,
      };
    },

    /**
     * ¿Esta persona ya tiene una propuesta sin revisar con este mismo nombre?
     *
     * Se compara sin distinguir mayúsculas y colapsando los espacios de sobra:
     * quien reintenta el formulario lo escribe casi igual, no idéntico. Solo mira
     * `propuesto`: volver a proponer algo que se rechazó es legítimo.
     */
    async propuestaPendienteConNombre(userId: string, name: string): Promise<boolean> {
      const rows = (await db.execute(sql`
        SELECT 1 FROM circuits
        WHERE created_by = ${userId}
          AND status = 'propuesto'
          AND regexp_replace(btrim(lower(name)), '[[:space:]]+', ' ', 'g')
              = regexp_replace(btrim(lower(${name})), '[[:space:]]+', ' ', 'g')
      `)) as unknown as unknown[];
      return rows.length > 0;
    },

    /**
     * Borrado real de la fila. Fotos, GPX y horarios se van con ella por el
     * `ON DELETE CASCADE` de las tres tablas hijas: no hay que borrarlas a mano.
     */
    async deleteById(id: string): Promise<boolean> {
      const rows = (await db.execute(
        sql`DELETE FROM circuits WHERE id = ${id} RETURNING id`,
      )) as unknown as { id: string }[];
      return rows.length > 0;
    },

    async create(data: CircuitInsert): Promise<{ id: string; slug: string }> {
      return db.transaction(async (tx) => {
        const rows = (await tx.execute(sql`
          INSERT INTO circuits
            (slug, name, description, discipline_id, province_id, locality, difficulty,
             access_type, access_notes, status, created_by, contact_phone, track,
             start_point, distance_m, elevation_gain_m, gpx_url, external_map_url)
          VALUES
            (${data.slug}, ${data.name}, ${data.description}, ${data.disciplineId},
             ${data.provinceId}, ${data.locality}, ${data.difficulty}, ${data.accessType},
             ${data.accessNotes}, ${data.status}, ${data.createdBy}, ${data.contactPhone},
             -- ST_GeogFromText(NULL) es NULL, así que el circuito sin GPX entra igual
             ST_GeogFromText(${data.trackWkt}),
             ST_GeogFromText(${data.startWkt}), ${data.distanceM}, ${data.elevationGainM},
             ${data.gpxUrl}, ${data.externalMapUrl})
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
        ['externalMapUrl', sql`external_map_url = ${sets.externalMapUrl}`],
        ['rejectionReason', sql`rejection_reason = ${sets.rejectionReason}`],
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

    async counts(): Promise<Record<string, number>> {
      const rows = (await db.execute(sql`
        SELECT status, count(*)::int AS total FROM circuits GROUP BY status
      `)) as unknown as { status: string; total: number }[];
      return Object.fromEntries(rows.map((r) => [r.status, r.total]));
    },

    async deleteMedia(circuitId: string, url: string): Promise<boolean> {
      const rows = (await db.execute(sql`
        DELETE FROM circuit_media WHERE circuit_id = ${circuitId} AND url = ${url}
        RETURNING id
      `)) as unknown as { id: number }[];
      return rows.length > 0;
    },

    async addMedia(
      circuitId: string,
      url: string,
      kind: string,
      data: Buffer,
      contentType: string,
    ): Promise<void> {
      await db.execute(sql`
        INSERT INTO circuit_media (circuit_id, url, kind, position, data, content_type)
        VALUES (
          ${circuitId}, ${url}, ${kind},
          (SELECT COALESCE(MAX(position) + 1, 0) FROM circuit_media WHERE circuit_id = ${circuitId}),
          ${data}, ${contentType}
        )
      `);
    },

    /** Guarda o reemplaza el GPX original del circuito. */
    async saveGpx(circuitId: string, fileName: string, content: Buffer): Promise<void> {
      await db.execute(sql`
        INSERT INTO circuit_gpx (circuit_id, file_name, content)
        VALUES (${circuitId}, ${fileName}, ${content})
        ON CONFLICT (circuit_id) DO UPDATE
          SET file_name = EXCLUDED.file_name, content = EXCLUDED.content, updated_at = now()
      `);
    },
  };
}

export type AdminRepository = ReturnType<typeof adminRepository>;
