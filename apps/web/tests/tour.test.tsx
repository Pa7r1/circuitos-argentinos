import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tour } from '../src/components/Tour';
import {
  marcarTourVisto,
  reabrirTour,
  reiniciarToursParaTest,
  tourPendiente,
  VERSION_TOUR,
} from '../src/lib/tour-visto';

beforeEach(() => {
  reiniciarToursParaTest();
});

describe('recordar qué recorridos se vieron', () => {
  it('arranca pendiente y deja de estarlo al terminarlo', () => {
    expect(tourPendiente('mapa')).toBe(true);
    marcarTourVisto('mapa');
    expect(tourPendiente('mapa')).toBe(false);
  });

  it('cada recorrido se recuerda por separado', () => {
    marcarTourVisto('mapa');
    expect(tourPendiente('ficha')).toBe(true);
  });

  it('vuelve a estar pendiente si sube la versión del recorrido', () => {
    marcarTourVisto('mapa');
    expect(tourPendiente('mapa')).toBe(false);

    // se simula el "mañana cambia la interfaz y hay que volver a explicarla":
    // con un booleano en vez de una versión, esta gente quedaría para siempre
    // con una explicación que ya no se corresponde con lo que tiene delante
    const original = VERSION_TOUR.mapa;
    try {
      VERSION_TOUR.mapa = original + 1;
      expect(tourPendiente('mapa')).toBe(true);
    } finally {
      VERSION_TOUR.mapa = original;
    }
  });

  it('el botón de ayuda lo vuelve a dejar pendiente', () => {
    marcarTourVisto('mapa');
    reabrirTour('mapa');
    expect(tourPendiente('mapa')).toBe(true);
  });

  it('sobrevive a un localStorage con basura adentro', () => {
    localStorage.setItem('circuitos_tours', 'esto no es json');
    // no debe romper al leer: se pierde el recuerdo, no la aplicación
    expect(() => tourPendiente('mapa')).not.toThrow();
  });
});

describe('Tour', () => {
  const pasos = [
    { titulo: 'Bienvenida', texto: 'Sin ancla, va centrado.' },
    { ancla: 'existe', titulo: 'Con ancla', texto: 'Señala un elemento real.' },
    { ancla: 'no-existe', titulo: 'Fantasma', texto: 'Su elemento no está en la pantalla.' },
  ];

  /**
   * El tour decide si un paso sirve midiendo su elemento, y **jsdom no calcula
   * layout**: todo devuelve 0×0, así que sin esto se descartarían hasta los pasos
   * cuyo elemento sí existe. Se le da un rectángulo creíble al ancla de prueba.
   */
  function Anclado() {
    return (
      <div
        data-tour="existe"
        ref={(el) => {
          if (el) el.getBoundingClientRect = () => new DOMRect(20, 40, 200, 44);
        }}
      >
        anclado
      </div>
    );
  }

  it('descarta los pasos cuyo elemento no está en pantalla', () => {
    // el paso "Fantasma" apunta a un data-tour que nadie tiene: mostrarlo sería un
    // globo señalando la nada. Debe contar 2 pasos, no 3.
    render(
      <>
        <Anclado />
        <Tour pasos={pasos} etiqueta="Guía" onCerrar={() => {}} />
      </>,
    );
    expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument();
  });

  it('avanza, retrocede y termina', async () => {
    const onCerrar = vi.fn();
    render(
      <>
        <Anclado />
        <Tour pasos={pasos} etiqueta="Guía" onCerrar={onCerrar} />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Bienvenida' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('heading', { name: 'Con ancla' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(screen.getByRole('heading', { name: 'Bienvenida' })).toBeInTheDocument();

    // en el último paso el botón cambia de texto y cierra
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(onCerrar).toHaveBeenCalledOnce();
  });

  it('se puede saltar y también cerrar con Escape', async () => {
    const onCerrar = vi.fn();
    render(
      <>
        <Anclado />
        <Tour pasos={pasos} etiqueta="Guía" onCerrar={onCerrar} />
      </>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Saltar la guía' }));
    expect(onCerrar).toHaveBeenCalledOnce();

    await userEvent.keyboard('{Escape}');
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });

  it('se anuncia como diálogo con nombre, para un lector de pantalla', () => {
    render(<Tour pasos={pasos} etiqueta="Cómo se usa el mapa" onCerrar={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Cómo se usa el mapa' })).toBeInTheDocument();
  });

  it('elige el ancla visible cuando el mismo data-tour está repetido', () => {
    // Caso real: las acciones de la ficha se dibujan dos veces —tarjeta lateral en
    // escritorio y barra fija en teléfono— y solo una está a la vista. Si ganara la
    // primera del marcado, en teléfono el paso apuntaría a la oculta y se perdería.
    render(
      <>
        <div data-tour="doble" />
        <div
          data-tour="doble"
          ref={(el) => {
            if (el) el.getBoundingClientRect = () => new DOMRect(0, 0, 120, 40);
          }}
        />
        <Tour
          pasos={[{ ancla: 'doble', titulo: 'Repetida', texto: 'x' }]}
          etiqueta="Guía"
          onCerrar={() => {}}
        />
      </>,
    );
    expect(screen.getByText('Paso 1 de 1')).toBeInTheDocument();
  });

  it('no rompe si ningún paso tiene su elemento', () => {
    // caso real: el mapa todavía sin circuitos cargados
    const soloFantasmas = [{ ancla: 'no-existe', titulo: 'X', texto: 'Y' }];
    const { container } = render(
      <Tour pasos={soloFantasmas} etiqueta="Guía" onCerrar={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
