import type { AccessType, CircuitStatus, Difficulty } from '@circuitos/shared';

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  facil: 'Fácil',
  intermedio: 'Intermedio',
  dificil: 'Difícil',
  extremo: 'Extremo',
};

/**
 * Color de cada disciplina: identifica el pin en el mapa y su chip de filtro.
 *
 * Va sobre grafito y en superficies chicas (un punto de 8 px, el anillo del pin),
 * así que son tonos claros y saturados: un color oscuro sobre grafito no se ve.
 * Los tres están bien separados en tono —ámbar, celeste y verde— para que se
 * distingan también con daltonismo rojo-verde, que es el más frecuente.
 *
 * El naranja se fue: el terreno de las fotos satelitales ya es ocre y anaranjado,
 * y un pin naranja sobre tierra naranja desaparece.
 */
export const DISCIPLINE_COLOR: Record<string, string> = {
  enduro: '#fbbf24',
  motocross: '#38bdf8',
  mtb: '#4ade80',
};

/** Inicial que va dentro del pin. */
export const DISCIPLINE_LETTER: Record<string, string> = {
  enduro: 'E',
  motocross: 'M',
  mtb: 'B',
};

/**
 * Dificultad sobre superficie grafito. Las clases de `DIFFICULTY_BADGE` son de
 * fondo claro y ahí quedan ilegibles, así que la escala oscura tiene su propio
 * mapa: verde → ámbar → naranja → rojo, que se lee como una progresión aunque no
 * se distingan los colores entre sí, porque el orden va acompañado del texto.
 */
export const DIFFICULTY_ON_DARK: Record<Difficulty, string> = {
  facil: 'text-green-400',
  intermedio: 'text-amber-400',
  dificil: 'text-orange-400',
  extremo: 'text-red-400',
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
