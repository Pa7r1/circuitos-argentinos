// DTOs y tipos compartidos entre apps/api y apps/web.

export * from './external-map.js';

// --- GeoJSON mínimo (lo único que viaja por la API) ---
export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number]; // [lon, lat]
}

export interface GeoJsonLineString {
  type: 'LineString';
  coordinates: [number, number, ...number[]][]; // [lon, lat, ele?]
}

// --- Enums de dominio ---
export const DIFFICULTIES = ['facil', 'intermedio', 'dificil', 'extremo'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const ACCESS_TYPES = ['libre', 'con_permiso', 'pago'] as const;
export type AccessType = (typeof ACCESS_TYPES)[number];

export const CIRCUIT_STATUSES = ['draft', 'published', 'archived'] as const;
export type CircuitStatus = (typeof CIRCUIT_STATUSES)[number];

// --- Catálogos fijos (fuente única para seed de la API y selects del frontend) ---
export const DISCIPLINES = [
  { slug: 'enduro', name: 'Enduro' },
  { slug: 'motocross', name: 'Motocross' },
  { slug: 'mtb', name: 'MTB' },
] as const;

export const PROVINCES = [
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
] as const;

// --- Auth ---
export type UserRole = 'user' | 'admin';

/** Login del admin único por variables de entorno (puerta de servicio). */
export interface AdminLoginRequest {
  user: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  /** slug de la disciplina que practica; opcional */
  discipline?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  discipline: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

/** Respuesta del login de admin por env: no hay fila de usuario detrás. */
export interface LoginResponse {
  token: string;
}

// --- Circuits públicos ---
export interface CircuitSummary {
  slug: string;
  name: string;
  difficulty: Difficulty;
  accessType: AccessType;
  distanceM: number;
  discipline: string; // slug de la disciplina
  locality: string | null;
  startPoint: GeoJsonPoint;
  /** Solo presente cuando se filtró por lat/lon */
  metersAway?: number;
}

export interface CircuitSchedule {
  dayOfWeek: number; // 0=domingo .. 6=sábado
  opens: string | null; // HH:MM
  closes: string | null;
  note: string | null;
}

export interface CircuitMedia {
  url: string;
  kind: 'photo' | 'video';
  position: number;
}

export interface CircuitDetail {
  slug: string;
  name: string;
  description: string | null;
  discipline: string;
  province: string; // slug
  provinceName: string;
  locality: string | null;
  difficulty: Difficulty;
  accessType: AccessType;
  accessNotes: string | null;
  distanceM: number;
  elevationGainM: number | null;
  startPoint: GeoJsonPoint;
  /** null cuando el circuito se cargó con un enlace en vez de un GPX. */
  track: GeoJsonLineString | null;
  /** Recorrido en Relive, Strava, Wikiloc… cuando no hay archivo propio. */
  externalMapUrl: string | null;
  /** Si es false no se ofrece la descarga: no hay archivo que bajar. */
  hasGpx: boolean;
  schedules: CircuitSchedule[];
  media: CircuitMedia[];
}

export interface CircuitListQuery {
  lat?: number;
  lon?: number;
  radius_m?: number;
  discipline?: string;
  province?: string;
}

// --- Admin ---
export interface AdminCircuitListItem {
  id: string;
  slug: string;
  name: string;
  status: CircuitStatus;
  difficulty: Difficulty;
  discipline: string;
  province: string;
  distanceM: number;
  createdAt: string;
  updatedAt: string;
}

/** Ficha completa para el formulario de edición del admin */
export interface AdminCircuitDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  discipline: string;
  province: string;
  locality: string | null;
  difficulty: Difficulty;
  accessType: AccessType;
  accessNotes: string | null;
  status: CircuitStatus;
  distanceM: number;
  elevationGainM: number | null;
  externalMapUrl: string | null;
  /** Para reposicionar el pin al editar un circuito cargado con enlace. */
  startPoint: GeoJsonPoint;
  hasTrack: boolean;
  schedules: CircuitSchedule[];
  media: CircuitMedia[];
}

export interface ScheduleInput {
  dayOfWeek: number;
  opens?: string | null;
  closes?: string | null;
  note?: string | null;
}

/**
 * Campos de la ficha en el alta (multipart). El GPX es opcional: si no viene,
 * hay que mandar el punto de partida y la distancia, porque son los datos que
 * el GPX aportaba.
 */
export interface CircuitCreateFields {
  name: string;
  description?: string;
  discipline: string; // slug
  province: string; // slug
  locality?: string;
  difficulty: Difficulty;
  accessType: AccessType;
  accessNotes?: string;
  schedules?: ScheduleInput[];
  externalMapUrl?: string;
  startLat?: number;
  startLon?: number;
  distanceM?: number;
  elevationGainM?: number;
}

export interface CircuitUpdateBody {
  name?: string;
  description?: string | null;
  discipline?: string;
  province?: string;
  locality?: string | null;
  difficulty?: Difficulty;
  accessType?: AccessType;
  accessNotes?: string | null;
  status?: CircuitStatus;
  schedules?: ScheduleInput[];
  externalMapUrl?: string | null;
  /** Se mandan juntos: mover el pin de un circuito cargado con enlace. */
  startLat?: number;
  startLon?: number;
  distanceM?: number;
  elevationGainM?: number | null;
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
}
