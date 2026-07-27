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

  it('rechaza lo que no sea http o https', () => {
    // un javascript: en un href es un XSS, y el enlace lo pega una persona
    expect(resolveExternalMap('javascript:alert(1)')).toBeNull();
    expect(resolveExternalMap('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(resolveExternalMap('no-es-una-url')).toBeNull();
    expect(resolveExternalMap('   ')).toBeNull();
  });
});
