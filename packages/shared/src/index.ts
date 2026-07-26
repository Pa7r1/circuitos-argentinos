// DTOs y tipos compartidos entre apps/api y apps/web.

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

// --- Auth ---
export interface LoginRequest {
  user: string;
  password: string;
}

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
  track: GeoJsonLineString;
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

export interface ScheduleInput {
  dayOfWeek: number;
  opens?: string | null;
  closes?: string | null;
  note?: string | null;
}

/** Campos de la ficha que acompañan al GPX en el alta (multipart) */
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
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
}
