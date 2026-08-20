import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisoActualizacion } from '../src/components/AvisoActualizacion';
import {
  hayActualizacion,
  marcarActualizacionLista,
  reiniciarActualizacionParaTest,
  suscribirActualizacion,
} from '../src/lib/actualizacion';
import { recargarPorChunkAusente } from '../src/lib/recarga-por-chunk';

/** `location.reload` no existe de verdad en jsdom: se reemplaza por un espía. */
function espiarRecarga() {
  const recargar = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: recargar },
  });
  return recargar;
}

const locationOriginal = Object.getOwnPropertyDescriptor(window, 'location');

afterEach(() => {
  if (locationOriginal) Object.defineProperty(window, 'location', locationOriginal);
});

describe('store de actualización', () => {
  beforeEach(() => {
    reiniciarActualizacionParaTest();
  });

  it('arranca sin actualización pendiente', () => {
    expect(hayActualizacion()).toBe(false);
  });

  it('avisa a los suscriptores cuando el worker nuevo toma el control', () => {
    const oyente = vi.fn();
    suscribirActualizacion(oyente);
    marcarActualizacionLista();
    expect(hayActualizacion()).toBe(true);
    expect(oyente).toHaveBeenCalledTimes(1);
  });

  it('no vuelve a avisar si el mismo worker se anuncia dos veces', () => {
    const oyente = vi.fn();
    suscribirActualizacion(oyente);
    marcarActualizacionLista();
    marcarActualizacionLista();
    expect(oyente).toHaveBeenCalledTimes(1);
  });

  it('deja de avisar después de desuscribirse', () => {
    const oyente = vi.fn();
    const cortar = suscribirActualizacion(oyente);
    cortar();
    marcarActualizacionLista();
    expect(oyente).not.toHaveBeenCalled();
  });
});

describe('AvisoActualizacion', () => {
  beforeEach(() => {
    reiniciarActualizacionParaTest();
  });

  const montar = () =>
    render(
      <MemoryRouter>
        <AvisoActualizacion />
      </MemoryRouter>,
    );

  it('no muestra nada mientras no haya versión nueva', () => {
    montar();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('aparece cuando hay versión nueva y recarga al tocar Actualizar', async () => {
    const recargar = espiarRecarga();
    montar();
    marcarActualizacionLista();

    expect(await screen.findByRole('status')).toHaveTextContent('versión nueva');
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('se puede descartar sin recargar', async () => {
    const recargar = espiarRecarga();
    montar();
    marcarActualizacionLista();

    await userEvent.click(await screen.findByLabelText('Descartar el aviso de actualización'));
    expect(screen.queryByRole('status')).toBeNull();
    expect(recargar).not.toHaveBeenCalled();
  });
});

describe('recarga por chunk ausente', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('recarga la primera vez', () => {
    const recargar = espiarRecarga();
    expect(recargarPorChunkAusente()).toBe(true);
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('no recarga dos veces seguidas: sería un bucle', () => {
    const recargar = espiarRecarga();
    recargarPorChunkAusente();
    expect(recargarPorChunkAusente()).toBe(false);
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('vuelve a intentarlo cuando pasó la ventana de guardia', () => {
    const recargar = espiarRecarga();
    recargarPorChunkAusente();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120_000);
    expect(recargarPorChunkAusente()).toBe(true);
    expect(recargar).toHaveBeenCalledTimes(2);
  });
});
