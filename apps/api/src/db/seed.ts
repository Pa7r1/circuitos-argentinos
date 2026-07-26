import { sql } from 'drizzle-orm';
import { fileURLToPath } from 'node:url';
import { createDb } from './index.js';
import { DISCIPLINES, PROVINCES } from '@circuitos/shared';
import { disciplines, provinces } from './schema.js';

// Trazado de ejemplo: ~20 puntos alrededor de La Rioja capital (-29.41, -66.85)
// para desarrollar el frontend sin datos reales.
function sampleTrackWkt(): { track: string; start: string; points: [number, number][] } {
  const points: string[] = [];
  const coords: [number, number][] = [];
  for (let i = 0; i < 20; i++) {
    const angle = (i / 19) * Math.PI * 1.5;
    const lon = -66.85 + 0.02 * Math.cos(angle) + i * 0.001;
    const lat = -29.41 + 0.015 * Math.sin(angle);
    points.push(`${lon.toFixed(6)} ${lat.toFixed(6)}`);
    coords.push([Number(lon.toFixed(6)), Number(lat.toFixed(6))]);
  }
  return {
    track: `LINESTRING(${points.join(',')})`,
    start: `POINT(${points[0]})`,
    points: coords,
  };
}

/** GPX del circuito de ejemplo, para que la descarga funcione desde el primer arranque. */
function sampleGpx(points: [number, number][]): string {
  const trkpts = points
    .map(([lon, lat]) => `      <trkpt lat="${lat}" lon="${lon}"><ele>520</ele></trkpt>`)
    .join('\n');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Circuitos Argentinos" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Quebrada del Cóndor</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
  return gpx;
}

/** Email de la cuenta administradora; el mismo en desarrollo y en producción. */
export const ADMIN_EMAIL = 'admin@circuitos.com';

export async function runSeed(url: string, adminPasswordHash?: string): Promise<void> {
  const { db, client } = createDb(url);
  try {
    await db.insert(disciplines).values(DISCIPLINES.map((d) => ({ ...d }))).onConflictDoNothing();
    await db.insert(provinces).values(PROVINCES.map((p) => ({ ...p }))).onConflictDoNothing();

    const { track, start, points } = sampleTrackWkt();
    const gpxUrl = '/api/v1/circuits/quebrada-del-condor/gpx';
    await db.execute(sql`
      INSERT INTO circuits
        (slug, name, description, discipline_id, province_id, locality, difficulty,
         access_type, status, track, start_point, distance_m, elevation_gain_m, gpx_url)
      SELECT
        'quebrada-del-condor', 'Quebrada del Cóndor',
        'Circuito de enduro de ejemplo en las afueras de La Rioja capital.',
        d.id, p.id, 'La Rioja', 'intermedio',
        'libre', 'published',
        ST_GeogFromText(${track}), ST_GeogFromText(${start}),
        12500, 340, ${gpxUrl}
      FROM disciplines d, provinces p
      WHERE d.slug = 'enduro' AND p.slug = 'la-rioja'
      ON CONFLICT (slug) DO NOTHING
    `);

    // el GPX va en la base, así la descarga funciona desde el primer arranque y
    // sobrevive a los despliegues (en Render el disco se borra en cada uno)
    await db.execute(sql`
      INSERT INTO circuit_gpx (circuit_id, file_name, content)
      SELECT id, 'quebrada-del-condor.gpx', ${Buffer.from(sampleGpx(points))}
      FROM circuits WHERE slug = 'quebrada-del-condor'
      ON CONFLICT (circuit_id) DO NOTHING
    `);

    // Cuenta administradora. Sin esto una base recién creada no tiene ninguna
    // cuenta con rol admin y /admin rechaza cualquier credencial. Se reutiliza el
    // hash de ADMIN_PASSWORD_HASH: no se inventa una contraseña ni se escribe
    // ninguna en el repositorio. El ON CONFLICT lo hace seguro contra la base de
    // producción, donde la cuenta ya existe.
    if (adminPasswordHash) {
      await db.execute(sql`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ('Administración', ${ADMIN_EMAIL}, ${adminPasswordHash}, 'admin')
        ON CONFLICT (email) DO NOTHING
      `);
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.loadEnvFile('../../.env');
  } catch {
    // variables por entorno
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no definida');
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminPasswordHash) {
    console.warn('ADMIN_PASSWORD_HASH no definida: no se crea la cuenta de administración');
  }
  await runSeed(url, adminPasswordHash);
  console.log(
    adminPasswordHash ? `seed aplicado (admin: ${ADMIN_EMAIL})` : 'seed aplicado (sin admin)',
  );
}
