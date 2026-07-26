import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { DISCIPLINES } from '@circuitos/shared';
import { Modal } from '../../components/Modal';
import { api, RequestError } from '../../lib/api';
import { setSession } from '../../lib/session';

type Solapa = 'registro' | 'ingreso';

const inputClass =
  'w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-brand-600 focus:outline-none';

/**
 * Registro e ingreso de usuarios. El registro es el peaje para ver la ficha de
 * un circuito: sin cuenta se ve el mapa, con cuenta se ve el detalle.
 *
 * ponytail: acá va el botón "Continuar con Google" cuando se agregue OAuth; el
 * esquema de la base ya lo soporta (users.oauth_provider / oauth_subject).
 */
export function AuthModal({
  motivo,
  onClose,
  onListo,
}: {
  /** Texto que explica por qué apareció el modal */
  motivo?: string;
  onClose: () => void;
  onListo: () => void;
}) {
  const [solapa, setSolapa] = useState<Solapa>('registro');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [discipline, setDiscipline] = useState<string>('enduro');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res =
        solapa === 'registro'
          ? await api.register({ name, email, password, discipline })
          : await api.login({ email, password });
      setSession({ token: res.token, user: res.user });
    },
    onSuccess: () => onListo(),
    onError: (e) => {
      setError(
        e instanceof RequestError
          ? e.message
          : 'No pudimos completar la operación. Reintentá en un momento.',
      );
    },
  });

  const esRegistro = solapa === 'registro';

  return (
    <Modal title={esRegistro ? 'Creá tu cuenta' : 'Ingresá a tu cuenta'} onClose={onClose}>
      {motivo && <p className="mb-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-700">{motivo}</p>}

      <div className="mb-4 flex gap-1 rounded-lg bg-stone-100 p-1" role="tablist">
        {(
          [
            ['registro', 'Crear cuenta'],
            ['ingreso', 'Ya tengo cuenta'],
          ] as const
        ).map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={solapa === valor}
            onClick={() => {
              setSolapa(valor);
              setError(null);
            }}
            className={`min-h-11 flex-1 rounded-md text-sm font-medium ${
              solapa === valor ? 'bg-white shadow-sm' : 'text-stone-600'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
      >
        {esRegistro && (
          <div>
            <label htmlFor="auth-name" className="mb-1 block text-sm font-medium">
              Nombre y apellido
            </label>
            <input
              id="auth-name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label htmlFor="auth-email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="auth-password" className="mb-1 block text-sm font-medium">
            Contraseña
          </label>
          <input
            id="auth-password"
            type="password"
            required
            minLength={esRegistro ? 8 : undefined}
            autoComplete={esRegistro ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          {esRegistro && <p className="mt-1 text-xs text-stone-500">Mínimo 8 caracteres.</p>}
        </div>

        {esRegistro && (
          <div>
            <label htmlFor="auth-discipline" className="mb-1 block text-sm font-medium">
              ¿Qué practicás?
            </label>
            <select
              id="auth-discipline"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              className={inputClass}
            >
              {DISCIPLINES.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="min-h-11 w-full rounded-lg bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Un momento…' : esRegistro ? 'Crear cuenta' : 'Ingresar'}
        </button>

        {esRegistro && (
          <p className="text-center text-xs text-stone-500">
            Usamos tu email solo para tu cuenta. No lo compartimos con nadie.
          </p>
        )}
      </form>
    </Modal>
  );
}
