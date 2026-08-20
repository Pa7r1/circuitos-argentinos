import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Acciones } from '../src/features/circuit-detail/CircuitPage';

const props = {
  directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=-29.1,-67.5',
  onDescargar: vi.fn(),
  onCompartir: vi.fn(),
};

const montar = (hasGpx: boolean) =>
  render(
    <MemoryRouter>
      <Acciones {...props} hasGpx={hasGpx} />
    </MemoryRouter>,
  );

describe('Acciones', () => {
  it('con archivo ofrece las tres acciones', () => {
    montar(true);
    expect(screen.getByRole('link', { name: /cómo llegar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /compartir/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gpx/i })).toBeInTheDocument();
  });

  it('sin archivo no ofrece la descarga: sería un botón que da error', () => {
    montar(false);
    expect(screen.queryByRole('button', { name: /gpx/i })).not.toBeInTheDocument();
  });

  it('las secundarias conservan su nombre al quedarse sin texto en teléfono', () => {
    // en teléfono el texto se oculta y solo queda el ícono: si el nombre accesible
    // dependiera del texto visible, un lector de pantalla anunciaría "botón" a secas
    montar(true);
    const compartir = screen.getByRole('button', { name: 'Compartir este circuito' });
    const gpx = screen.getByRole('button', {
      name: 'Descargar el GPX para el GPS, Strava o Wikiloc',
    });
    expect(compartir.querySelector('span.hidden')).toHaveTextContent('Compartir');
    expect(gpx.querySelector('span.hidden')).toHaveTextContent('GPX');
  });
});
