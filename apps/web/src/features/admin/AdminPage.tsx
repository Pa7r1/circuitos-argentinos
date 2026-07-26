import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminCircuitDetail, AdminCircuitListItem, CircuitStatus } from '@circuitos/shared';
import { DISCIPLINES, PROVINCES } from '@circuitos/shared';
import { Button, ButtonLink } from '../../components/Button';
import { Field } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { api, RequestError } from '../../lib/api';
import { STATUS_LABEL } from '../../lib/format';
import { circuitKeys, useAdminCircuits } from '../../lib/queries';
import { clearSession, setSession } from '../../lib/session';
import { useSession } from '../../lib/use-session';
import { CircuitForm } from './CircuitForm';

const STATUS_STYLE: Record<CircuitStatus, string> = {
  draft: 'bg-stone-200 text-stone-700',
  published: 'bg-green-100 text-green-800',
  archived: 'bg-red-100 text-red-800',
};

const FILTROS: (CircuitStatus | 'todos')[] = ['todos', 'published', 'draft', 'archived'];

/** El listado guarda slugs; en pantalla van los nombres de siempre. */
const nombreDisciplina = (slug: string) =>
  DISCIPLINES.find((d) => d.slug === slug)?.name ?? slug;
const nombreProvincia = (slug: string) => PROVINCES.find((p) => p.slug === slug)?.name ?? slug;

/**
 * Ingreso al panel con la misma credencial que el resto de la app: una sola cuenta
 * para todo. El permiso lo da el rol de administrador de la cuenta, no una puerta
 * aparte.
 */
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      const { token, user } = await api.login({ email, password });
      setSession({ token, user });
    },
    onError: (e) => {
      // el error va en el formulario, donde está mirando la persona, y también
      // en el toast para quien use lector de pantalla
      const mensaje = e instanceof RequestError ? e.message : 'No se pudo iniciar sesión';
      setError(mensaje);
      toast(mensaje);
    },
  });

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col justify-center p-6">
      <div className="tarjeta p-6">
        <h1 className="text-xl font-bold">Panel de administración</h1>
        <p className="mt-1 mb-5 text-sm text-stone-600">
          Entrá con la misma cuenta que usás en el mapa.
        </p>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate();
          }}
        >
          <Field
            label="Email"
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Contraseña"
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error ?? undefined}
          />
          <Button type="submit" variante="primary" tamano="lg" ancho disabled={mutation.isPending}>
            {mutation.isPending ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>
      </div>
      <Link
        to="/"
        className="mt-4 block py-2 text-center text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        ← Volver al mapa
      </Link>
    </main>
  );
}

/**
 * Sesión válida pero sin permisos. Antes esto devolvía el formulario de ingreso otra
 * vez, y parecía que la contraseña estaba mal.
 */
function SinPermisos({ nombre }: { nombre: string }) {
  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col justify-center p-6 text-center">
      <div className="tarjeta p-6">
        <h1 className="mb-2 text-xl font-bold">No tenés acceso al panel</h1>
        <p className="mb-6 text-sm text-stone-600">
          Entraste como <strong className="text-stone-900">{nombre}</strong>, una cuenta sin
          permisos de administración.
        </p>
        <Button variante="primary" tamano="lg" ancho onClick={() => clearSession()}>
          Entrar con otra cuenta
        </Button>
      </div>
      <Link
        to="/"
        className="mt-4 block py-2 text-center text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        ← Volver al mapa
      </Link>
    </main>
  );
}

function Resumen() {
  const { data } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.admin.stats(),
    staleTime: 0,
  });
  const items = [
    ['Publicados', data?.published],
    ['Borradores', data?.draft],
    ['Archivados', data?.archived],
    ['Usuarios', data?.users],
  ] as const;

  return (
    <dl className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(([label, valor]) => (
        <div key={label} className="tarjeta px-4 py-3">
          <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase">{label}</dt>
          <dd className="mt-0.5 text-3xl font-bold tabular-nums">{valor ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminPage() {
  const session = useSession();
  const [modal, setModal] = useState<{ editing?: AdminCircuitDetail } | null>(null);
  const [filtro, setFiltro] = useState<CircuitStatus | 'todos'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  const esAdmin = session?.user.role === 'admin';
  const { data: circuits, isPending, isError, error } = useAdminCircuits(!!esAdmin);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return (circuits ?? []).filter(
      (c) =>
        (filtro === 'todos' || c.status === filtro) &&
        (texto === '' || c.name.toLowerCase().includes(texto)),
    );
  }, [circuits, filtro, busqueda]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CircuitStatus }) =>
      status === 'archived' ? api.admin.archive(id) : api.admin.update(id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: circuitKeys.all });
      void queryClient.invalidateQueries({ queryKey: circuitKeys.adminList });
      void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (e) => toast(e instanceof RequestError ? e.message : 'No se pudo actualizar'),
  });

  if (!session) return <LoginForm />;
  if (!esAdmin) return <SinPermisos nombre={session.user.name} />;

  if (isError && error instanceof RequestError && [401, 403].includes(error.statusCode)) {
    clearSession();
    return <LoginForm />;
  }

  async function abrirEdicion(item: AdminCircuitListItem) {
    try {
      setModal({ editing: await api.admin.detail(item.id) });
    } catch {
      toast('No se pudo cargar el circuito');
    }
  }

  const hayCircuitos = (circuits ?? []).length > 0;

  return (
    <div className="min-h-full">
      {/* barra de la aplicación: fija arriba, para no perder la salida al scrollear */}
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <h1 className="text-lg font-bold">Administración</h1>
          <div className="flex items-center gap-1">
            <ButtonLink to="/" variante="ghost" tamano="sm">
              Ver mapa
            </ButtonLink>
            <Button variante="secondary" tamano="sm" onClick={() => clearSession()}>
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-4">
        <Resumen />

        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field
              label="Buscar circuito"
              id="buscar"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre…"
            />
          </div>
          {/* única acción primaria de la pantalla */}
          <Button variante="primary" onClick={() => setModal({})} className="shrink-0">
            <span aria-hidden="true">+</span> Nuevo circuito
          </Button>
        </div>

        <div
          className="mb-4 inline-flex rounded-lg border border-stone-200 bg-stone-100 p-1"
          role="group"
          aria-label="Filtrar por estado"
        >
          {FILTROS.map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              aria-pressed={filtro === f}
              className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors ${
                filtro === f
                  ? 'bg-white text-stone-900 shadow-card'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {f === 'todos' ? 'Todos' : STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        {isPending && (
          <div className="space-y-2" aria-busy="true">
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-24 w-full" />
          </div>
        )}
        {isError && (
          <p className="rounded-lg bg-red-50 p-3 text-red-800">No se pudo cargar el listado.</p>
        )}
        {!isPending && visibles.length === 0 && (
          <div className="tarjeta px-4 py-10 text-center">
            <p className="font-medium text-stone-700">
              {hayCircuitos ? 'Ningún circuito coincide con el filtro.' : 'Todavía no hay circuitos.'}
            </p>
            <p className="mt-1 text-sm text-stone-500">
              {hayCircuitos
                ? 'Probá con otro estado o borrá la búsqueda.'
                : 'Cargá el primero con su archivo GPX y quedará listo para publicar.'}
            </p>
          </div>
        )}

        <ul className="space-y-2">
          {visibles.map((item) => (
            <li key={item.id} className="tarjeta p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-stone-900">{item.name}</p>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {nombreDisciplina(item.discipline)} · {nombreProvincia(item.province)} ·{' '}
                    {(item.distanceM / 1000).toFixed(1).replace('.', ',')} km
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[item.status]}`}
                >
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.status !== 'published' ? (
                  <Button
                    variante="success"
                    tamano="sm"
                    onClick={() => statusMutation.mutate({ id: item.id, status: 'published' })}
                  >
                    Publicar
                  </Button>
                ) : (
                  <Button
                    variante="secondary"
                    tamano="sm"
                    onClick={() => statusMutation.mutate({ id: item.id, status: 'draft' })}
                  >
                    Despublicar
                  </Button>
                )}
                <Button variante="secondary" tamano="sm" onClick={() => void abrirEdicion(item)}>
                  Editar
                </Button>
                {item.status === 'published' && (
                  <ButtonLink to={`/circuitos/${item.slug}`} variante="ghost" tamano="sm">
                    Ver ficha
                  </ButtonLink>
                )}
                {item.status !== 'archived' && (
                  <Button
                    variante="danger"
                    tamano="sm"
                    className="ml-auto"
                    onClick={() => {
                      if (confirm(`¿Archivar "${item.name}"? Dejará de verse en el mapa.`)) {
                        statusMutation.mutate({ id: item.id, status: 'archived' });
                      }
                    }}
                  >
                    Archivar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {modal && (
          <Modal
            title={modal.editing ? `Editar: ${modal.editing.name}` : 'Nuevo circuito'}
            onClose={() => setModal(null)}
            size="lg"
          >
            <CircuitForm editing={modal.editing} onDone={() => setModal(null)} />
          </Modal>
        )}
      </main>
    </div>
  );
}
