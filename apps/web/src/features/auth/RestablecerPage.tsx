import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, ButtonLink } from '../../components/Button';
import { Field, VerPassword } from '../../components/Field';
import { api, RequestError } from '../../lib/api';

/**
 * Pantalla a la que lleva el enlace del correo. El token viaja en el query string
 * y se usa una sola vez.
 *
 * No inicia sesión al terminar a propósito: quien cambió la contraseña la acaba de
 * elegir y el gestor del navegador solo la guarda si se usa para entrar. Además, si
 * el enlace lo abrió otra persona, no le regala una sesión.
 */
export function RestablecerPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.resetPassword(token, password),
    onError: (e) =>
      setError(
        e instanceof RequestError
          ? e.message
          : 'No pudimos cambiar la contraseña. Reintentá en un momento.',
      ),
  });

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center p-6">
      <div className="tarjeta p-6">
        {token === '' ? (
          <>
            <h1 className="titulo mb-2 text-xl">Falta el enlace</h1>
            <p className="mb-5 text-white/70">
              Esta página se abre desde el correo que te mandamos. Copiá el enlace completo o pedí
              uno nuevo.
            </p>
            <ButtonLink to="/" variante="primary" tamano="lg" ancho>
              Ir al mapa
            </ButtonLink>
          </>
        ) : mutation.isSuccess ? (
          <>
            <h1 className="titulo mb-2 text-xl">Listo, ya tenés contraseña nueva</h1>
            <p className="mb-5 text-white/70">Entrá con ella desde el mapa.</p>
            <ButtonLink to="/" variante="primary" tamano="lg" ancho>
              Ir al mapa
            </ButtonLink>
          </>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              mutation.mutate();
            }}
          >
            <h1 className="titulo mb-1 text-xl">Elegí una contraseña nueva</h1>
            <p className="mb-4 text-sm text-white/70">
              El enlace sirve una sola vez y vence a la hora de pedirlo.
            </p>
            <Field
              label="Contraseña nueva"
              id="reset-password"
              type={verPassword ? 'text' : 'password'}
              required
              minLength={10}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              ayuda="Mínimo 10 caracteres. Evitá las de siempre."
              error={error ?? undefined}
              adorno={
                <VerPassword visible={verPassword} onToggle={() => setVerPassword((v) => !v)} />
              }
            />
            <Button type="submit" variante="primary" tamano="lg" ancho disabled={mutation.isPending}>
              {mutation.isPending ? 'Un momento…' : 'Cambiar la contraseña'}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
