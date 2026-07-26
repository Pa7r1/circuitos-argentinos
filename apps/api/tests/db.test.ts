import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { runSeed } from '../src/db/seed.js';
import { createCleanTestDb } from './helpers/test-db.js';

let testUrl: string;
let sql: postgres.Sql;

beforeAll(async () => {
  testUrl = await createCleanTestDb();
  sql = postgres(testUrl, { max: 1, onnotice: () => {} });
});

afterAll(async () => {
  await sql?.end();
});

describe('migraciones', () => {
  it('aplican sobre una base limpia y crean las 5 tablas', async () => {
    const tables = await sql`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    const names = tables.map((t) => t.tablename);
    for (const expected of [
      'disciplines',
      'provinces',
      'circuits',
      'circuit_schedules',
      'circuit_media',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('el trigger de updated_at funciona', async () => {
    await runSeed(testUrl);
    const [before] = await sql`SELECT updated_at FROM circuits WHERE slug = 'quebrada-del-condor'`;
    await sql`UPDATE circuits SET name = name WHERE slug = 'quebrada-del-condor'`;
    const [after] = await sql`SELECT updated_at FROM circuits WHERE slug = 'quebrada-del-condor'`;
    expect(new Date(after!.updated_at as string).getTime()).toBeGreaterThan(
      new Date(before!.updated_at as string).getTime(),
    );
  });
});

describe('seed', () => {
  it('es idempotente: correrlo dos veces deja los mismos datos', async () => {
    await runSeed(testUrl);
    await runSeed(testUrl);
    const [counts] = await sql`
      SELECT
        (SELECT count(*)::int FROM disciplines) AS disciplines,
        (SELECT count(*)::int FROM provinces) AS provinces,
        (SELECT count(*)::int FROM circuits) AS circuits
    `;
    expect(counts).toMatchObject({ disciplines: 3, provinces: 24, circuits: 1 });
  });

  it('el circuito de ejemplo tiene track y start_point válidos', async () => {
    const [row] = await sql`
      SELECT ST_NPoints(track::geometry) AS npoints,
             ST_GeometryType(start_point::geometry) AS start_type
      FROM circuits WHERE slug = 'quebrada-del-condor'
    `;
    expect(row!.npoints).toBeGreaterThanOrEqual(20);
    expect(row!.start_type).toBe('ST_Point');
  });
});

describe('queries geoespaciales', () => {
  it('ST_DWithin encuentra el circuito de ejemplo cerca de La Rioja', async () => {
    const rows = await sql`
      SELECT slug FROM circuits
      WHERE ST_DWithin(start_point, ST_GeogFromText('POINT(-66.8558 -29.4131)'), 50000)
    `;
    expect(rows.map((r) => r.slug)).toContain('quebrada-del-condor');
  });

  it('ST_DWithin usa el índice GIST (Index Scan en el plan)', async () => {
    // con una sola fila el planificador elige seq scan; se desactiva para
    // comprobar que el índice existe y es usable
    await sql`SET enable_seqscan = off`;
    const plan = await sql`
      EXPLAIN SELECT slug FROM circuits
      WHERE ST_DWithin(start_point, ST_GeogFromText('POINT(-66.8558 -29.4131)'), 50000)
    `;
    await sql`SET enable_seqscan = on`;
    const planText = plan.map((r) => r['QUERY PLAN']).join('\n');
    expect(planText).toMatch(/Index Scan.*circuits_start_point_gist_idx/s);
  });
});
