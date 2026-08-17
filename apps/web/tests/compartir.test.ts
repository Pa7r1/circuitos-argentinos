import { describe, expect, it } from 'vitest';
import { DESTINOS, textoCompartir } from '../src/lib/compartir';

const URL_FICHA = 'https://circuitos-argentinos.makkem.com/circuitos/las-canteras';

function href(id: string, texto = 'Mirá esto') {
  const destino = DESTINOS.find((d) => d.id === id);
  if (!destino) throw new Error(`falta el destino ${id}`);
  return destino.href(URL_FICHA, texto);
}

describe('enlaces para compartir', () => {
  it('manda la URL de la ficha a cada red', () => {
    expect(href('whatsapp')).toBe(
      'https://wa.me/?text=Mir%C3%A1%20esto%20https%3A%2F%2Fcircuitos-argentinos.makkem.com%2Fcircuitos%2Flas-canteras',
    );
    expect(href('facebook')).toContain(
      'sharer.php?u=https%3A%2F%2Fcircuitos-argentinos.makkem.com',
    );
    expect(href('telegram')).toContain('t.me/share/url?url=https%3A%2F%2F');
    expect(href('x')).toContain('twitter.com/intent/tweet?url=https%3A%2F%2F');
  });

  it('escapa lo que la persona escribió en el nombre del circuito', () => {
    // un & o un # sin escapar cortan la URL y el enlace llega partido
    const url = href('whatsapp', 'Cerro Negro & Cía #enduro');
    expect(url).toContain('%26');
    expect(url).toContain('%23');
    expect(url).not.toContain(' ');
  });

  it('nombra la localidad cuando se sabe', () => {
    expect(textoCompartir('Las Canteras', 'Chilecito')).toBe(
      'Mirá este circuito: Las Canteras, en Chilecito',
    );
    expect(textoCompartir('Las Canteras', null)).toBe('Mirá este circuito: Las Canteras');
  });

  it('no ofrece Instagram, que no acepta enlaces desde la web', () => {
    // si algún día alguien lo agrega, este test explica por qué no estaba
    expect(DESTINOS.map((d) => d.id)).not.toContain('instagram');
  });
});
