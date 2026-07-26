import { sql } from 'drizzle-orm';
import { fileURLToPath } from 'node:url';
import { createDb } from './index.js';
import { disciplines, provinces } from './schema.js';

const DISCIPLINES = [
  { slug: 'enduro', name: 'Enduro' },
  { slug: 'motocross', name: 'Motocross' },
  { slug: 'mtb', name: 'MTB' },
];

const PROVINCES = [
  { slug: 'buenos-aires', name: 'Buenos Aires' },
  { slug: 'caba', name: 'Ciudad Autónoma de Buenos Aires' },
  { slug: 'catamarca', name: 'Catamarca' },
  { slug: 'chaco', name: 'Chaco' },
  { slug: 'chubut', name: 'Chubut' },
  { slug: 'cordoba', name: 'Córdoba' },
  { slug: 'corrientes', name: 'Corrientes' },
  { slug: 'entre-rios', name: 'Entre Ríos' },
  { slug: 'formosa', name: 'Formosa' },
  { slug: 'jujuy', name: 'Jujuy' },
  { slug: 'la-pampa', name: 'La Pampa' },
  { slug: 'la-rioja', name: 'La Rioja' },
  { slug: 'mendoza', name: 'Mendoza' },
  { slug: 'misiones', name: 'Misiones' },
  { slug: 'neuquen', name: 'Neuquén' },
  { slug: 'rio-negro', name: 'Río Negro' },
  { slug: 'salta', name: 'Salta' },
  { slug: 'san-juan', name: 'San Juan' },
  { slug: 'san-luis', name: 'San Luis' },
  { slug: 'santa-cruz', name: 'Santa Cruz' },
  { slug: 'santa-fe', name: 'Santa Fe' },
  { slug: 'santiago-del-estero', name: 'Santiago del Estero' },
  { slug: 'tierra-del-fuego', name: 'Tierra del Fuego' },
  { slug: 'tucuman', name: 'Tucumán' },
];

// Trazado de ejemplo: ~20 puntos alrededor de La Rioja capital (-29.41, -66.85)
// para desarrollar el frontend sin datos reales.
function sampleTrackWkt(): { track: string; start: string } {
  const points: string[] = [];
  for (let i = 0; i < 20; i++) {
    const angle = (i / 19) * Math.PI * 1.5;
    const lon = -66.85 + 0.02 * Math.cos(angle) + i * 0.001;
    const lat = -29.41 + 0.015 * Math.sin(angle);
    points.push(`${lon.toFixed(6)} ${lat.toFixed(6)}`);
  }
  return {
    track: `LINESTRING(${points.join(',')})`,
    start: `POINT(${points[0]})`,
  };
}

export async function runSeed(url: string): Promise<void> {
  const { db, client } = createDb(url);
  try {
    await db.insert(disciplines).values(DISCIPLINES).onConflictDoNothing();
    await db.insert(provinces).values(PROVINCES).onConflictDoNothing();

    const { track, start } = sampleTrackWkt();
    await db.execute(sql`
      INSERT INTO circuits
        (slug, name, description, discipline_id, province_id, locality, difficulty,
         access_type, status, track, start_point, distance_m, elevation_gain_m)
      SELECT
        'quebrada-del-condor', 'Quebrada del Cóndor',
        'Circuito de enduro de ejemplo en las afueras de La Rioja capital.',
        d.id, p.id, 'La Rioja', 'intermedio',
        'libre', 'published',
        ST_GeogFromText(${track}), ST_GeogFromText(${start}),
        12500, 340
      FROM disciplines d, provinces p
      WHERE d.slug = 'enduro' AND p.slug = 'la-rioja'
      ON CONFLICT (slug) DO NOTHING
    `);
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
  await runSeed(url);
  console.log('seed aplicado');
}
