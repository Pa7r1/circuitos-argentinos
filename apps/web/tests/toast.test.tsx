import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../src/components/Toast';

/** Dispara los avisos que le pidan, desde dentro del provider. */
function Disparador({ avisos }: { avisos: string[] }) {
  const toast = useToast();
  return (
    <button onClick={() => avisos.forEach((a) => toast(a))}>disparar</button>
  );
}

function montar(avisos: string[]) {
  render(
    <ToastProvider>
      <Disparador avisos={avisos} />
    </ToastProvider>,
  );
  act(() => {
    screen.getByText('disparar').click();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('cola de avisos', () => {
  it('muestra varios a la vez en vez de pisarse', () => {
    // antes había uno solo: el segundo mensaje borraba al primero y se leía la mitad
    montar(['primero', 'segundo']);
    expect(screen.getByText('primero')).toBeInTheDocument();
    expect(screen.getByText('segundo')).toBeInTheDocument();
  });

  it('no deja más de tres en pantalla', () => {
    montar(['uno', 'dos', 'tres', 'cuatro']);
    expect(screen.queryByText('uno')).not.toBeInTheDocument();
    expect(screen.getByText('cuatro')).toBeInTheDocument();
  });

  it('un aviso largo se queda más tiempo que uno corto', () => {
    const largo = 'a'.repeat(120);
    montar(['ok', largo]);

    // pasado el piso de lectura, el corto ya se fue y el largo sigue
    act(() => void vi.advanceTimersByTime(4000 + 200));
    expect(screen.queryByText('ok')).not.toBeInTheDocument();
    expect(screen.getByText(largo)).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(5000));
    expect(screen.queryByText(largo)).not.toBeInTheDocument();
  });
});
