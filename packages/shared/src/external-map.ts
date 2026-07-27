/**
 * Enlaces a recorridos de terceros (Relive, Strava, Wikiloc…).
 *
 * Existe porque desde esas aplicaciones no se puede exportar el GPX, así que lo
 * único que llega es el enlace. Cuando el proveedor permite embeberlo, el
 * recorrido se ve dentro de la ficha; cuando no, queda un enlace y ya.
 */

export interface MapProvider {
  id: string;
  name: string;
  /** El primer grupo de captura es el identificador del recorrido. */
  pattern: RegExp;
  /** Cómo se arma la URL embebible. Sin esto, el proveedor solo se enlaza. */
  embed?: (id: string) => string;
}

/**
 * Verificado mirando las cabeceras de cada sitio: solo se embebe lo que no manda
 * `X-Frame-Options` ni un `frame-ancestors` que nos excluya.
 */
export const MAP_PROVIDERS: MapProvider[] = [
  {
    id: 'relive',
    name: 'Relive',
    // ojo: la URL que comparte Relive (/view/<id>) responde X-Frame-Options: DENY.
    // La que se puede embeber es la misma con /embed al final.
    pattern: /^(?:www\.)?relive\.com\/view\/([\w-]+)/i,
    embed: (id) => `https://www.relive.com/view/${id}/embed`,
  },
  {
    id: 'strava-activity',
    name: 'Strava',
    pattern: /^(?:www\.)?strava\.com\/activities\/(\d+)/i,
    embed: (id) => `https://strava-embeds.com/activity/${id}`,
  },
  {
    id: 'strava-route',
    name: 'Strava',
    pattern: /^(?:www\.)?strava\.com\/routes\/(\d+)/i,
    embed: (id) => `https://strava-embeds.com/route/${id}`,
  },
  {
    id: 'wikiloc',
    name: 'Wikiloc',
    // los enlaces terminan en "-<id>", por ejemplo /rutas-motocross/nombre-12345678
    pattern: /^(?:www\.)?wikiloc\.com\/.*?-(\d+)(?:$|[?#])/i,
    embed: (id) => `https://www.wikiloc.com/wikiloc/embedv2.do?id=${id}`,
  },
  {
    id: 'komoot',
    name: 'Komoot',
    pattern: /^(?:www\.)?komoot\.(?:com|de|es)\/tour\/(\d+)/i,
    embed: (id) => `https://www.komoot.com/tour/${id}/embed`,
  },
  {
    id: 'google-my-maps',
    name: 'Google My Maps',
    pattern: /^(?:www\.)?google\.[a-z.]+\/maps\/d\//i,
    // el identificador viaja en el parámetro mid, no en la ruta: se resuelve aparte
  },
  {
    id: 'wikiloc-app',
    name: 'Wikiloc',
    pattern: /^(?:es|www)\.wikiloc\.com\/wikiloc\/view\.do\?id=(\d+)/i,
    embed: (id) => `https://www.wikiloc.com/wikiloc/embedv2.do?id=${id}`,
  },
];

export interface ExternalMap {
  /** La URL tal cual la cargó el administrador; es la que se enlaza. */
  url: string;
  providerId: string;
  /** Nombre para mostrar: "Relive", "Strava" o el dominio si no lo conocemos. */
  providerName: string;
  /** URL para el iframe, o null si ese proveedor no se puede embeber. */
  embedUrl: string | null;
}

/**
 * Interpreta el enlace de un recorrido. Devuelve null si no es una URL http(s):
 * el enlace lo pega una persona y un `javascript:` en un href es un XSS.
 */
export function resolveExternalMap(raw: string): ExternalMap | null {
  const url = raw.trim();
  if (url === '') return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const sinEsquema = `${parsed.host}${parsed.pathname}${parsed.search}`;

  for (const provider of MAP_PROVIDERS) {
    const match = sinEsquema.match(provider.pattern);
    if (!match) continue;

    // Google My Maps identifica el mapa con el parámetro mid, no con la ruta
    if (provider.id === 'google-my-maps') {
      const mid = parsed.searchParams.get('mid');
      return {
        url,
        providerId: provider.id,
        providerName: provider.name,
        embedUrl: mid ? `https://www.google.com/maps/d/embed?mid=${encodeURIComponent(mid)}` : null,
      };
    }

    const id = match[1];
    return {
      url,
      providerId: provider.id,
      providerName: provider.name,
      embedUrl: id && provider.embed ? provider.embed(id) : null,
    };
  }

  // desconocido: se enlaza igual, con el dominio como nombre
  return {
    url,
    providerId: 'desconocido',
    providerName: parsed.host.replace(/^www\./, ''),
    embedUrl: null,
  };
}
