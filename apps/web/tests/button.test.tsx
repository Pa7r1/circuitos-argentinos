import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Button, ButtonLink } from '../src/components/Button';

const enRouter = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Button', () => {
  it('avisa del toque con un cambio de escala que respeta el movimiento reducido', () => {
    render(<Button>Ver circuito</Button>);
    // El acuse de pulsación es la única señal que da la app en un teléfono, donde
    // no hay :hover. Y va bajo motion-safe: quien pide menos movimiento no lo ve.
    expect(screen.getByRole('button')).toHaveClass('motion-safe:active:scale-[0.97]');
  });

  it('no dispara la acción cuando está deshabilitado', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Guardar
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('mantiene el objetivo táctil accesible de 44 px en el tamaño más chico', () => {
    render(<Button tamano="sm">Cerrar</Button>);
    expect(screen.getByRole('button')).toHaveClass('min-h-11');
  });
});

describe('ButtonLink', () => {
  it('navega por el router cuando el destino es interno', () => {
    enRouter(<ButtonLink to="/circuitos/la-cuesta">Ver circuito</ButtonLink>);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/circuitos/la-cuesta');
  });

  it('deja pasar los esquemas propios sin que el router los reescriba', () => {
    // "Cómo llegar" usa geo: para abrir la app de mapas del teléfono. Si esto
    // entrara al router, el href quedaría como /geo:... y no abriría nada.
    const destino = 'geo:-29.41,-66.85?q=-29.41,-66.85(La%20Cuesta)';
    enRouter(<ButtonLink to={destino}>Cómo llegar</ButtonLink>);
    expect(screen.getByRole('link')).toHaveAttribute('href', destino);
  });

  it('deja pasar los enlaces externos tal cual', () => {
    enRouter(<ButtonLink to="https://www.relive.cc/view/123">Ver en Relive</ButtonLink>);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://www.relive.cc/view/123');
  });
});
