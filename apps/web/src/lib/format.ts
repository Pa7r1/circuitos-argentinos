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
 * Dificultad. Verde → ámbar → naranja → rojo se lee como una progresión, pero el
 * color nunca va solo: siempre lo acompaña la palabra.
 *
 * Antes había dos mapas —uno para fondo claro y otro para la hoja del mapa— y se
 * desincronizaban. Ahora que toda la app es oscura queda uno solo: fondo tenue del
 * mismo tono y texto claro, que es lo que llega a contraste sobre grafito.
 */
export const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  facil: 'bg-green-500/15 text-green-300',
  intermedio: 'bg-amber-500/15 text-amber-300',
  dificil: 'bg-orange-500/15 text-orange-300',
  extremo: 'bg-red-500/15 text-red-300',
};

/** Solo el color del texto, para cuando el fondo lo pone otro. */
export const DIFFICULTY_TEXT: Record<Difficulty, string> = {
  facil: 'text-green-300',
  intermedio: 'text-amber-300',
  dificil: 'text-orange-300',
  extremo: 'text-red-300',
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
  propuesto: 'Propuesto',
  rechazado: 'Rechazado',
};

export const DAY_LABEL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function formatKm(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatDistanceAway(meters: number): string {
  return meters < 1000 ? `a ${meters} m` : `a ${Math.round(meters / 1000)} km`;
}
