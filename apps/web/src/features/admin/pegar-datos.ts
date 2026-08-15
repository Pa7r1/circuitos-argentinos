import {
  ACCESS_TYPES,
  DIFFICULTIES,
  DISCIPLINES,
  PROVINCES,
  resolveExternalMap,
  type AccessType,
  type Difficulty,
} from '@circuitos/shared';

/**
 * Lee la planilla que se manda por WhatsApp (`docs/PLANTILLA-CIRCUITO.md`) y la
 * convierte en campos del formulario.
 *
 * Los datos de cada circuito llegan por mensaje, en texto o transcritos de un
 * audio, y se tipeaban campo por campo. Esto es solo un atajo para llenar el
 * formulario: nada se guarda sin que alguien lo revise y le apriete guardar.
 */
export interface CamposPegados {
  name?: string;
  discipline?: string;
  province?: string;
  locality?: string;
  difficulty?: Difficulty;
  accessType?: AccessType;
  accessNotes?: string;
  description?: string;
  externalMapUrl?: string;
  km?: string;
  desnivel?: string;
}

export interface ResultadoPegado {
  campos: CamposPegados;
  /** Etiquetas que aparecían en el texto y no se supieron interpretar. */
  ignoradas: string[];
}

/** Sin tildes, sin mayúsculas y sin espacios de más: así se comparan las etiquetas. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Etiqueta de la planilla → campo del formulario. Varias por campo, porque nadie escribe igual. */
const ETIQUETAS: Record<string, keyof CamposPegados> = {
  nombre: 'name',
  circuito: 'name',
  disciplina: 'discipline',
  provincia: 'province',
  localidad: 'locality',
  ciudad: 'locality',
  pueblo: 'locality',
  dificultad: 'difficulty',
  acceso: 'accessType',
  'tipo de acceso': 'accessType',
  'notas de acceso': 'accessNotes',
  'como se entra': 'accessNotes',
  descripcion: 'description',
  enlace: 'externalMapUrl',
  link: 'externalMapUrl',
  recorrido: 'externalMapUrl',
  relive: 'externalMapUrl',
  strava: 'externalMapUrl',
  wikiloc: 'externalMapUrl',
  distancia: 'km',
  km: 'km',
  kilometros: 'km',
  desnivel: 'desnivel',
};

/** Valores de los enums escritos como los escribe una persona. */
const DIFICULTADES: Record<string, Difficulty> = {
  facil: 'facil',
  principiante: 'facil',
  intermedio: 'intermedio',
  medio: 'intermedio',
  dificil: 'dificil',
  avanzado: 'dificil',
  extremo: 'extremo',
  experto: 'extremo',
};

const ACCESOS: Record<string, AccessType> = {
  libre: 'libre',
  abierto: 'libre',
  gratis: 'libre',
  'con permiso': 'con_permiso',
  permiso: 'con_permiso',
  privado: 'con_permiso',
  pago: 'pago',
  arancelado: 'pago',
};

/** Busca en un catálogo por slug o por nombre, ya normalizados. */
function porNombre(
  catalogo: readonly { slug: string; name: string }[],
  valor: string,
): string | undefined {
  const buscado = normalizar(valor);
  return catalogo.find((i) => normalizar(i.name) === buscado || i.slug === buscado)?.slug;
}

/** Deja solo dígitos y una coma o punto decimal: "12,5 km" → "12,5". */
function soloNumero(valor: string): string | undefined {
  const limpio = valor.replace(/[^\d,.]/g, '').replace(/\.(?=.*\.)/g, '');
  return limpio === '' ? undefined : limpio;
}

export function parsearPlantilla(texto: string): ResultadoPegado {
  const campos: CamposPegados = {};
  const ignoradas: string[] = [];

  for (const linea of texto.split('\n')) {
    const corte = linea.indexOf(':');
    if (corte === -1) continue;

    const etiqueta = normalizar(linea.slice(0, corte).replace(/^[-*\s]+/, ''));
    const valor = linea.slice(corte + 1).trim();
    // una etiqueta sin nada al lado es la planilla en blanco, no un error
    if (valor === '' || valor === '-') continue;

    const campo = ETIQUETAS[etiqueta];
    if (!campo) {
      if (etiqueta !== '') ignoradas.push(etiqueta);
      continue;
    }

    switch (campo) {
      case 'difficulty': {
        const v = DIFICULTADES[normalizar(valor)];
        if (v && DIFFICULTIES.includes(v)) campos.difficulty = v;
        else ignoradas.push(etiqueta);
        break;
      }
      case 'accessType': {
        const v = ACCESOS[normalizar(valor)];
        if (v && ACCESS_TYPES.includes(v)) campos.accessType = v;
        else ignoradas.push(etiqueta);
        break;
      }
      case 'discipline': {
        const slug = porNombre(DISCIPLINES, valor);
        if (slug) campos.discipline = slug;
        else ignoradas.push(etiqueta);
        break;
      }
      case 'province': {
        const slug = porNombre(PROVINCES, valor);
        if (slug) campos.province = slug;
        else ignoradas.push(etiqueta);
        break;
      }
      case 'externalMapUrl': {
        // pasa por el catálogo de proveedores: acepta la URL con idioma adelante
        // y también el código de inserción pegado entero
        const mapa = resolveExternalMap(valor);
        if (mapa) campos.externalMapUrl = mapa.url;
        else ignoradas.push(etiqueta);
        break;
      }
      case 'km':
      case 'desnivel': {
        const numero = soloNumero(valor);
        if (numero) campos[campo] = numero;
        else ignoradas.push(etiqueta);
        break;
      }
      default:
        campos[campo] = valor;
    }
  }

  return { campos, ignoradas };
}
