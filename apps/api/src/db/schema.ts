import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  index,
  integer,
  pgTable,
  serial,
  smallint,
  smallserial,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// Drizzle no soporta geography de PostGIS nativamente: el tipo se declara como texto
// (WKT/GeoJSON) y toda lectura/escritura geoespacial pasa por SQL crudo parametrizado.
const geographyLineString = customType<{ data: string }>({
  dataType: () => 'geography(LineString,4326)',
});
const geographyPoint = customType<{ data: string }>({
  dataType: () => 'geography(Point,4326)',
});

/** Contenido binario de fotos y archivos GPX. */
const bytea = customType<{ data: Buffer }>({
  dataType: () => 'bytea',
});

export const disciplines = pgTable('disciplines', {
  id: smallserial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
});

export const provinces = pgTable('provinces', {
  id: smallserial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    // siempre en minúsculas: el service normaliza antes de escribir
    email: text('email').notNull().unique(),
    // null cuando la cuenta entra por un proveedor externo (Google, etc.)
    passwordHash: text('password_hash'),
    disciplineId: smallint('discipline_id').references(() => disciplines.id),
    role: text('role').notNull().default('user'),
    oauthProvider: text('oauth_provider'),
    oauthSubject: text('oauth_subject'),
    /*
     * Recuperación de contraseña. Se guarda el SHA-256 del token, nunca el token:
     * quien lea la base no puede usarlo para entrar a una cuenta ajena. Van como
     * columnas y no como tabla aparte porque hay a lo sumo un pedido vivo por
     * persona, así que una tabla sería una fila por usuario y un trabajo de
     * limpieza que nadie necesita.
     */
    resetTokenHash: text('reset_token_hash'),
    resetExpiresAt: timestamp('reset_expires_at', { withTimezone: true }),
    /** Cuándo aceptó los términos. Null en las cuentas anteriores a que existieran. */
    termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('users_role_check', sql`${t.role} in ('user','admin')`),
    // ninguna cuenta puede quedar sin forma de entrar
    check(
      'users_credencial_check',
      sql`${t.passwordHash} is not null or (${t.oauthProvider} is not null and ${t.oauthSubject} is not null)`,
    ),
    unique('users_oauth_unique').on(t.oauthProvider, t.oauthSubject),
  ],
);

export const circuits = pgTable(
  'circuits',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    disciplineId: smallint('discipline_id')
      .notNull()
      .references(() => disciplines.id),
    provinceId: smallint('province_id')
      .notNull()
      .references(() => provinces.id),
    locality: text('locality'),
    difficulty: text('difficulty').notNull(),
    accessType: text('access_type').notNull(),
    accessNotes: text('access_notes'),
    status: text('status').notNull().default('draft'),
    // nullable: los circuitos cargados con un enlace a Relive o Strava no tienen
    // trazado propio, porque esas aplicaciones no dejan exportar el GPX
    track: geographyLineString('track'),
    startPoint: geographyPoint('start_point').notNull(),
    distanceM: integer('distance_m').notNull(),
    elevationGainM: integer('elevation_gain_m'),
    gpxUrl: text('gpx_url'),
    /** Recorrido publicado en Relive, Strava, Wikiloc… */
    externalMapUrl: text('external_map_url'),
    /*
     * Quién propuso el circuito. Null en los que carga el admin.
     *
     * `on delete set null`: si la persona borra su cuenta, el circuito ya
     * publicado no se cae con ella. El teléfono, en cambio, sí se borra: es un
     * dato personal y la política de privacidad promete eliminarlo.
     */
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    /** Teléfono de quien propuso, para coordinar. Nunca sale de /admin. */
    contactPhone: text('contact_phone'),
    /** Por qué se rechazó una propuesta; sirve para no volver a recibir lo mismo. */
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('circuits_difficulty_check', sql`${t.difficulty} in ('facil','intermedio','dificil','extremo')`),
    check('circuits_access_type_check', sql`${t.accessType} in ('libre','con_permiso','pago')`),
    /*
     * `propuesto` es lo que manda la comunidad y todavía no se revisó; `rechazado`
     * es lo que se revisó y no entra. Ninguno de los dos sale en el mapa, que solo
     * muestra `published`.
     */
    check(
      'circuits_status_check',
      sql`${t.status} in ('draft','published','archived','propuesto','rechazado')`,
    ),
    // un circuito tiene que poder mostrar algo: o su trazado o el recorrido de un
    // tercero. Sin esta regla se pueden cargar fichas vacías.
    check(
      'circuits_track_o_enlace_check',
      sql`${t.track} is not null or ${t.externalMapUrl} is not null`,
    ),
    index('circuits_status_discipline_province_idx').on(t.status, t.disciplineId, t.provinceId),
    index('circuits_start_point_gist_idx').using('gist', t.startPoint),
    index('circuits_track_gist_idx').using('gist', t.track),
  ],
);

export const circuitSchedules = pgTable(
  'circuit_schedules',
  {
    id: serial('id').primaryKey(),
    circuitId: uuid('circuit_id')
      .notNull()
      .references(() => circuits.id, { onDelete: 'cascade' }),
    dayOfWeek: smallint('day_of_week').notNull(),
    opens: time('opens'),
    closes: time('closes'),
    note: text('note'),
  },
  (t) => [check('circuit_schedules_day_of_week_check', sql`${t.dayOfWeek} between 0 and 6`)],
);

export const circuitMedia = pgTable(
  'circuit_media',
  {
    id: serial('id').primaryKey(),
    circuitId: uuid('circuit_id')
      .notNull()
      .references(() => circuits.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    kind: text('kind').notNull().default('photo'),
    position: smallint('position').notNull().default(0),
    // los archivos viven en la base, no en disco: el plan gratuito de Render borra
    // el disco en cada despliegue y las fotos desaparecían
    data: bytea('data').notNull(),
    contentType: text('content_type').notNull(),
  },
  (t) => [check('circuit_media_kind_check', sql`${t.kind} in ('photo','video')`)],
);

/**
 * GPX original de cada circuito, para descargarlo y abrirlo en Relive o Strava.
 * Va en su propia tabla y no como columna de `circuits` para que las consultas
 * del mapa no arrastren los bytes del archivo.
 */
export const circuitGpx = pgTable('circuit_gpx', {
  circuitId: uuid('circuit_id')
    .primaryKey()
    .references(() => circuits.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  content: bytea('content').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
