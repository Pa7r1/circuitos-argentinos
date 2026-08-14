import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { DISCIPLINES } from '@circuitos/shared';
import { Button } from '../../components/Button';
import { Field, SelectField, VerPassword } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { api, RequestError } from '../../lib/api';
import { setSession } from '../../lib/session';

type Solapa = 'registro' | 'ingreso';
/** "olvide" no es una solapa: se llega desde el ingreso y se vuelve con un enlace. */
type Modo = Solapa | 'olvide';

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
  const [solapa, setSolapa] = useState<Modo>('registro');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [discipline, setDiscipline] = useState<string>('enduro');
  const [error, setError] = useState<string | null>(null);
  const [verPassword, setVerPassword] = useState(false);

  const [enviado, setEnviado] = useState(false);

  const alFallar = (e: unknown) => {
    setError(
      e instanceof RequestError
        ? e.message
        : 'No pudimos completar la operación. Reintentá en un momento.',
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res =
        solapa === 'registro'
          ? await api.register({ name, email, password, discipline })
          : await api.login({ email, password });
      setSession({ token: res.token, user: res.user });
    },
    onSuccess: () => onListo(),
    onError: alFallar,
  });

  const olvide = useMutation({
    mutationFn: () => api.forgotPassword(email),
    onSuccess: () => setEnviado(true),
    onError: alFallar,
  });

  const esRegistro = solapa === 'registro';
  const esOlvide = solapa === 'olvide';

  const titulo = esOlvide
    ? 'Recuperar tu contraseña'
    : esRegistro
      ? 'Creá tu cuenta'
      : 'Ingresá a tu cuenta';

  if (esOlvide) {
    return (
      <Modal title={titulo} onClose={onClose}>
        {enviado ? (
          <div className="space-y-4">
            <p className="text-sm text-white/80">
              Si <strong className="text-white">{email}</strong> tiene una cuenta, le mandamos un
              correo con un enlace para elegir una contraseña nueva. Sirve por una hora.
            </p>
            <p className="text-xs text-white/50">
              Revisá el correo no deseado. Si no llega nada, puede que esa dirección no esté
              registrada.
            </p>
            <Button
              type="button"
              variante="primary"
              tamano="lg"
              ancho
              onClick={() => {
                setSolapa('ingreso');
                setEnviado(false);
              }}
            >
              Volver a ingresar
            </Button>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              olvide.mutate();
            }}
          >
            <p className="text-sm text-white/70">
              Poné tu email y te mandamos un enlace para elegir una contraseña nueva.
            </p>
            <Field
              label="Email"
              id="auth-email-olvide"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error ?? undefined}
            />
            <Button type="submit" variante="primary" tamano="lg" ancho disabled={olvide.isPending}>
              {olvide.isPending ? 'Un momento…' : 'Mandame el enlace'}
            </Button>
            <button
              type="button"
              className="min-h-11 w-full text-sm text-white/60 underline-offset-4 hover:text-white hover:underline"
              onClick={() => {
                setSolapa('ingreso');
                setError(null);
              }}
            >
              Volver
            </button>
          </form>
        )}
      </Modal>
    );
  }

  return (
    <Modal title={titulo} onClose={onClose}>
      {motivo && (
        <p className="mb-4 rounded-xl border border-brand-400/25 bg-brand-400/12 p-3 text-sm text-brand-100">
          {motivo}
        </p>
      )}

      <div
        className="mb-5 flex gap-1 rounded-xl bg-white/8 p-1 ring-1 ring-white/10"
        role="tablist"
        aria-label="Crear cuenta o ingresar"
      >
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
            className={`min-h-11 flex-1 rounded-lg text-sm font-semibold transition-[color,background-color,box-shadow] duration-[var(--duracion-rapida)] ease-suave ${
              solapa === valor
                ? 'bg-white/15 text-white shadow-card'
                : 'text-white/55 hover:text-white/85'
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
          <Field
            label="Nombre y apellido"
            id="auth-name"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}

        <Field
          label="Email"
          id="auth-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Field
          label="Contraseña"
          id="auth-password"
          type={verPassword ? 'text' : 'password'}
          required
          minLength={esRegistro ? 10 : undefined}
          autoComplete={esRegistro ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          ayuda={esRegistro ? 'Mínimo 10 caracteres. Evitá las de siempre.' : undefined}
          // el error del servidor es casi siempre de credenciales: va acá
          error={error ?? undefined}
          adorno={<VerPassword visible={verPassword} onToggle={() => setVerPassword((v) => !v)} />}
        />

        {esRegistro && (
          <SelectField
            label="¿Qué practicás?"
            id="auth-discipline"
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
          >
            {DISCIPLINES.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </SelectField>
        )}

        <Button type="submit" variante="primary" tamano="lg" ancho disabled={mutation.isPending}>
          {mutation.isPending ? 'Un momento…' : esRegistro ? 'Crear cuenta' : 'Ingresar'}
        </Button>

        {esRegistro ? (
          <p className="text-center text-xs text-white/50">
            Usamos tu email solo para tu cuenta. No lo compartimos con nadie.
          </p>
        ) : (
          <button
            type="button"
            className="min-h-11 w-full text-sm text-white/60 underline-offset-4 hover:text-white hover:underline"
            onClick={() => {
              setSolapa('olvide');
              setError(null);
            }}
          >
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </form>
    </Modal>
  );
}
