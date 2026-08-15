import { describe, expect, it } from 'vitest';
import { resolveExternalMap } from '@circuitos/shared';

describe('resolveExternalMap', () => {
  it('embebe Relive con /embed, no con la URL que comparte la app', () => {
    // la URL compartida responde X-Frame-Options: DENY y no se puede meter en un iframe
    const map = resolveExternalMap('https://www.relive.com/view/vKv23E8PxoO/explore');
    expect(map?.providerName).toBe('Relive');
    expect(map?.embedUrl).toBe('https://www.relive.com/view/vKv23E8PxoO/embed');
    expect(map?.url).toBe('https://www.relive.com/view/vKv23E8PxoO/explore');
  });

  it('reconoce actividades y rutas de Strava', () => {
    expect(resolveExternalMap('https://www.strava.com/activities/1234567890')?.embedUrl).toBe(
      'https://strava-embeds.com/activity/1234567890',
    );
    expect(resolveExternalMap('https://strava.com/routes/98765')?.embedUrl).toBe(
      'https://strava-embeds.com/route/98765',
    );
  });

  it('reconoce Wikiloc, Komoot y Google My Maps', () => {
    expect(
      resolveExternalMap('https://www.wikiloc.com/rutas-enduro/vuelta-al-cerro-12345678')?.embedUrl,
    ).toBe('https://www.wikiloc.com/wikiloc/embedv2.do?id=12345678');
    expect(resolveExternalMap('https://www.komoot.com/tour/123456')?.embedUrl).toBe(
      'https://www.komoot.com/tour/123456/embed',
    );
    expect(
      resolveExternalMap('https://www.google.com/maps/d/viewer?mid=1AbC-dEf&ll=-29,-66')?.embedUrl,
    ).toBe('https://www.google.com/maps/d/embed?mid=1AbC-dEf');
  });

  it('un sitio desconocido se enlaza igual, con el dominio como nombre', () => {
    const map = resolveExternalMap('https://mapas.example.org/recorrido/7');
    expect(map).toEqual({
      url: 'https://mapas.example.org/recorrido/7',
      providerId: 'desconocido',
      providerName: 'mapas.example.org',
      embedUrl: null,
    });
  });

  it('acepta el idioma que Relive mete en la URL que comparte', () => {
    // es la URL que sale del botón de compartir de la app; sin esto el enlace caía
    // en "desconocido" y la ficha decía que no se podía mostrar
    const map = resolveExternalMap('https://www.relive.com/es/view/vQvykNrjW46');
    expect(map?.providerName).toBe('Relive');
    expect(map?.embedUrl).toBe('https://www.relive.com/view/vQvykNrjW46/embed');
    // el enlace se guarda tal cual vino: es el que se abre en otra pestaña
    expect(map?.url).toBe('https://www.relive.com/es/view/vQvykNrjW46');
  });

  it('el idioma se ignora en cualquier proveedor, y no se come rutas de dos letras', () => {
    expect(resolveExternalMap('https://www.relive.com/fr/view/abc123')?.providerName).toBe('Relive');
    expect(resolveExternalMap('https://www.komoot.com/es-es/tour/123456')?.embedUrl).toBe(
      'https://www.komoot.com/tour/123456/embed',
    );
    // "maps" no es un idioma: si se recortara, Google My Maps dejaría de reconocerse
    expect(
      resolveExternalMap('https://www.google.com/maps/d/viewer?mid=xyz')?.providerId,
    ).toBe('google-my-maps');
  });

  it('saca la URL del código de inserción pegado entero', () => {
    // lo que da el botón "Incorporar" de Relive: la primera URL del snippet es la
    // de embedly, que no es el recorrido
    const incorporar = `<div class="embedly-responsive"><iframe class="embedly-embed" src="https://cdn.embedly.com/widgets/media.html?src=https://www.relive.com/view/vQvykNrjW46/widget?r=embed-site&amp;url=https://www.relive.com/view/vQvykNrjW46?r=embed-site" width="1024" height="801"></iframe></div>`;
    expect(resolveExternalMap(incorporar)?.embedUrl).toBe(
      'https://www.relive.com/view/vQvykNrjW46/embed',
    );
  });

  it('un código pegado sin ningún proveedor conocido no vale como enlace', () => {
    expect(resolveExternalMap('<iframe src="https://ejemplo.com/mapa"></iframe>')).toBeNull();
    expect(resolveExternalMap('<blockquote>sin enlaces</blockquote>')).toBeNull();
  });

  it('rechaza lo que no sea http o https', () => {
    // un javascript: en un href es un XSS, y el enlace lo pega una persona
    expect(resolveExternalMap('javascript:alert(1)')).toBeNull();
    expect(resolveExternalMap('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(resolveExternalMap('no-es-una-url')).toBeNull();
    expect(resolveExternalMap('   ')).toBeNull();
  });
});
