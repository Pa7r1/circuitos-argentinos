import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminCircuitDetail, AdminCircuitListItem, CircuitStatus } from '@circuitos/shared';
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

/**
 * Ingreso al panel con la misma credencial que el resto de la app: una sola cuenta
 * para todo. El permiso lo da el rol de administrador de la cuenta, no una puerta
 * aparte.
 */
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      const { token, user } = await api.login({ email, password });
      setSession({ token, user });
    },
    onError: (error) => {
      toast(error instanceof RequestError ? error.message : 'No se pudo iniciar sesión');
    },
  });

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col justify-center p-6">
      <h1 className="mb-6 text-center text-2xl font-bold">Panel de administración</h1>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5"
          />
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="min-h-11 w-full rounded-lg bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Ingresando…' : 'Ingresar'}
        </button>
        <Link to="/" className="block py-2 text-center text-sm font-medium text-brand-700">
          Volver al mapa
        </Link>
      </form>
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
      <h1 className="mb-2 text-2xl font-bold">No tenés acceso al panel</h1>
      <p className="mb-6 text-stone-600">
        Entraste como <strong>{nombre}</strong>, una cuenta sin permisos de administración.
      </p>
      <button
        onClick={() => clearSession()}
        className="min-h-11 w-full rounded-lg bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
      >
        Entrar con otra cuenta
      </button>
      <Link to="/" className="block py-3 text-sm font-medium text-brand-700">
        Volver al mapa
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
    <dl className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(([label, valor]) => (
        <div key={label} className="rounded-lg border border-stone-200 bg-white p-3">
          <dt className="text-xs text-stone-500">{label}</dt>
          <dd className="text-2xl font-bold">{valor ?? '—'}</dd>
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

  return (
    <main className="mx-auto max-w-2xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Administración</h1>
        <div className="flex gap-2">
          <Link
            to="/"
            className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-brand-700"
          >
            Ver mapa
          </Link>
          <button
            onClick={() => clearSession()}
            className="min-h-11 rounded-lg border border-stone-300 px-3 text-sm font-medium hover:bg-stone-50"
          >
            Salir
          </button>
        </div>
      </header>

      <Resumen />

      <button
        onClick={() => setModal({})}
        className="mb-4 min-h-11 w-full rounded-lg bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
      >
        + Nuevo circuito
      </button>

      <div className="mb-3 space-y-2">
        <label htmlFor="buscar" className="sr-only">
          Buscar circuito por nombre
        </label>
        <input
          id="buscar"
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre…"
          className="min-h-11 w-full rounded-lg border border-stone-300 px-3"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              aria-pressed={filtro === f}
              className={`min-h-11 rounded-full px-3 text-sm font-medium ${
                filtro === f ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-700'
              }`}
            >
              {f === 'todos' ? 'Todos' : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {isPending && (
        <div className="space-y-2" aria-busy="true">
          <div className="skeleton h-20 w-full" />
          <div className="skeleton h-20 w-full" />
        </div>
      )}
      {isError && <p className="text-red-700">No se pudo cargar el listado.</p>}
      {!isPending && visibles.length === 0 && (
        <p className="py-6 text-center text-stone-500">No hay circuitos que coincidan.</p>
      )}

      <ul className="space-y-2">
        {visibles.map((item) => (
          <li key={item.id} className="rounded-lg border border-stone-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-stone-500">
                  {item.discipline} · {item.province}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[item.status]}`}
              >
                {STATUS_LABEL[item.status]}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {item.status !== 'published' ? (
                <button
                  onClick={() => statusMutation.mutate({ id: item.id, status: 'published' })}
                  className="min-h-11 rounded-lg bg-green-700 px-3 font-medium text-white hover:bg-green-800"
                >
                  Publicar
                </button>
              ) : (
                <button
                  onClick={() => statusMutation.mutate({ id: item.id, status: 'draft' })}
                  className="min-h-11 rounded-lg border border-stone-300 px-3 font-medium hover:bg-stone-50"
                >
                  Despublicar
                </button>
              )}
              <button
                onClick={() => void abrirEdicion(item)}
                className="min-h-11 rounded-lg border border-stone-300 px-3 font-medium hover:bg-stone-50"
              >
                Editar
              </button>
              {item.status === 'published' && (
                <Link
                  to={`/circuitos/${item.slug}`}
                  className="flex min-h-11 items-center rounded-lg px-3 font-medium text-brand-700"
                >
                  Ver ficha
                </Link>
              )}
              {item.status !== 'archived' && (
                <button
                  onClick={() => {
                    if (confirm(`¿Archivar "${item.name}"? Dejará de verse en el mapa.`)) {
                      statusMutation.mutate({ id: item.id, status: 'archived' });
                    }
                  }}
                  className="min-h-11 rounded-lg px-3 font-medium text-red-700 hover:bg-red-50"
                >
                  Archivar
                </button>
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
  );
}
