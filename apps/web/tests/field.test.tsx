import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Field, VerPassword } from '../src/components/Field';

/** Campo de contraseña armado como en los formularios reales de la app. */
function CampoPassword() {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      label="Contraseña"
      id="pass"
      type={visible ? 'text' : 'password'}
      autoComplete="current-password"
      adorno={<VerPassword visible={visible} onToggle={() => setVisible((v) => !v)} />}
    />
  );
}

describe('Field', () => {
  it('revela y vuelve a ocultar la contraseña', async () => {
    render(<CampoPassword />);
    const campo = document.querySelector('#pass')!;
    expect(campo).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: /Mostrar la contraseña/i }));
    expect(campo).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', { name: /Ocultar la contraseña/i }));
    expect(campo).toHaveAttribute('type', 'password');
  });

  it('no rompe el autoComplete al revelar, para que el gestor la siga guardando', async () => {
    render(<CampoPassword />);
    await userEvent.click(screen.getByRole('button', { name: /Mostrar la contraseña/i }));
    expect(document.querySelector('#pass')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('el botón de revelar no entra en el orden de tabulación antes que el campo', () => {
    render(<CampoPassword />);
    // el adorno se apoya sobre el input pero va después en el DOM: al tabular,
    // primero se escribe y recién después se decide si mostrarla
    const orden = Array.from(document.querySelectorAll('#pass, button'));
    expect(orden[0]).toHaveAttribute('id', 'pass');
  });

  it('asocia el error al campo para que un lector de pantalla lo anuncie', () => {
    render(<Field label="Email" id="mail" error="Ese email ya tiene cuenta" />);
    const campo = document.querySelector('#mail')!;
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAttribute('aria-describedby', 'mail-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Ese email ya tiene cuenta');
  });
});
