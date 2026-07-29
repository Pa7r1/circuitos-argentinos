import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DisciplineChip } from '../src/components/DisciplineChip';

const chip = () => screen.getByRole('button');

describe('DisciplineChip', () => {
  it('expone el estado con aria-pressed y no solo con el color', () => {
    // Es lo único que ve un lector de pantalla: sin esto, el filtro encendido y el
    // apagado son la misma palabra repetida tres veces.
    const { rerender } = render(
      <DisciplineChip nombre="Enduro" color="#ea580c" activo onToggle={() => {}} />,
    );
    expect(chip()).toHaveAttribute('aria-pressed', 'true');

    rerender(<DisciplineChip nombre="Enduro" color="#ea580c" activo={false} onToggle={() => {}} />);
    expect(chip()).toHaveAttribute('aria-pressed', 'false');
  });

  it('distingue encendido de apagado por relleno del punto, no solo por color', () => {
    const { rerender } = render(
      <DisciplineChip nombre="MTB" color="#7c3aed" activo onToggle={() => {}} />,
    );
    const punto = () => chip().querySelector('span[aria-hidden="true"]')!;
    // encendido: punto lleno del color de la disciplina
    expect(punto().getAttribute('style')).toContain('background-color');

    rerender(<DisciplineChip nombre="MTB" color="#7c3aed" activo={false} onToggle={() => {}} />);
    // apagado: punto hueco (solo el aro interior), sin relleno
    const apagado = punto().getAttribute('style') ?? '';
    expect(apagado).toContain('inset');
    expect(apagado).not.toContain('background-color');
  });

  it('avisa cada vez que se toca, para poder alternarlo', async () => {
    const onToggle = vi.fn();
    render(<DisciplineChip nombre="Motocross" color="#2563eb" activo onToggle={onToggle} />);
    await userEvent.click(chip());
    await userEvent.click(chip());
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('mantiene el objetivo táctil de 44 px', () => {
    render(<DisciplineChip nombre="Enduro" color="#ea580c" activo onToggle={() => {}} />);
    expect(chip()).toHaveClass('min-h-11');
  });
});
