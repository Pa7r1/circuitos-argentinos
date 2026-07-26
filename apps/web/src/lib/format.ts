import type { AccessType, CircuitStatus, Difficulty } from '@circuitos/shared';

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  facil: 'Fácil',
  intermedio: 'Intermedio',
  dificil: 'Difícil',
  extremo: 'Extremo',
};

/** Color de cada disciplina: identifica el pin en el mapa y su chip de filtro. */
export const DISCIPLINE_COLOR: Record<string, string> = {
  enduro: '#ea580c',
  motocross: '#2563eb',
  mtb: '#7c3aed',
};

/**
 * Variante oscura para fondos con texto blanco: el naranja del pin no llega al
 * contraste AA (3,4:1) sobre blanco, estos tonos sí.
 */
export const DISCIPLINE_CHIP_BG: Record<string, string> = {
  enduro: '#c2410c',
  motocross: '#1d4ed8',
  mtb: '#6d28d9',
};

/** Inicial que va dentro del pin. */
export const DISCIPLINE_LETTER: Record<string, string> = {
  enduro: 'E',
  motocross: 'M',
  mtb: 'B',
};

export const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  facil: 'bg-green-100 text-green-800',
  intermedio: 'bg-yellow-100 text-yellow-800',
  dificil: 'bg-orange-100 text-orange-800',
  extremo: 'bg-red-100 text-red-800',
};

export const ACCESS_LABEL: Record<AccessType, string> = {
  libre: 'Acceso libre',
  con_permiso: 'Requiere permiso',
  pago: 'Acceso pago',
};

export const STATUS_LABEL: Record<CircuitStatus, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  archived: 'Archivado',
};

export const DAY_LABEL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function formatKm(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatDistanceAway(meters: number): string {
  return meters < 1000 ? `a ${meters} m` : `a ${Math.round(meters / 1000)} km`;
}
