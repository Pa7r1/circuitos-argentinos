import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminCircuitDetail, AdminCircuitListItem, CircuitStatus } from '@circuitos/shared';
import { useToast } from '../../components/Toast';
import { api, RequestError } from '../../lib/api';
import { clearToken, getToken, setToken } from '../../lib/auth';
import { STATUS_LABEL } from '../../lib/format';
import { circuitKeys, useAdminCircuits } from '../../lib/queries';
import { CircuitForm } from './CircuitForm';

const STATUS_STYLE: Record<CircuitStatus, string> = {
  draft: 'bg-stone-200 text-stone-700',
  published: 'bg-green-100 text-green-800',
  archived: 'bg-red-100 text-red-800',
};

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: () => api.login({ user, password }),
    onSuccess: (res) => {
      setToken(res.token);
      onLogin();
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
          <label htmlFor="user" className="mb-1 block text-sm font-medium">
            Usuario
          </label>
          <input
            id="user"
            required
            autoComplete="username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
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
      </form>
    </main>
  );
}

export function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(() => getToken() !== null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editing, setEditing] = useState<AdminCircuitDetail | undefined>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: circuits, isPending, isError, error } = useAdminCircuits(loggedIn);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CircuitStatus }) =>
      status === 'archived' ? api.admin.archive(id) : api.admin.update(id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: circuitKeys.all });
      void queryClient.invalidateQueries({ queryKey: circuitKeys.adminList });
    },
    onError: (e) => toast(e instanceof RequestError ? e.message : 'No se pudo actualizar'),
  });

  if (!loggedIn) return <LoginForm onLogin={() => setLoggedIn(true)} />;

  if (isError && error instanceof RequestError && error.statusCode === 401) {
    clearToken();
    if (loggedIn) setLoggedIn(false);
    return null;
  }

  async function startEdit(item: AdminCircuitListItem) {
    try {
      setEditing(await api.admin.detail(item.id));
      setMode('edit');
    } catch {
      toast('No se pudo cargar el circuito');
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Administración</h1>
        <div className="flex gap-2">
          <Link to="/" className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-brand-700">
            Ver mapa
          </Link>
          <button
            onClick={() => {
              clearToken();
              setLoggedIn(false);
            }}
            className="min-h-11 rounded-lg border border-stone-300 px-3 text-sm font-medium hover:bg-stone-50"
          >
            Salir
          </button>
        </div>
      </header>

      {mode !== 'list' ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            {mode === 'edit' ? `Editar: ${editing?.name}` : 'Nuevo circuito'}
          </h2>
          <CircuitForm
            editing={mode === 'edit' ? editing : undefined}
            onDone={() => {
              setMode('list');
              setEditing(undefined);
            }}
          />
        </section>
      ) : (
        <section>
          <button
            onClick={() => setMode('create')}
            className="mb-4 min-h-11 w-full rounded-lg bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
          >
            + Nuevo circuito
          </button>

          {isPending && (
            <div className="space-y-2" aria-busy="true">
              <div className="skeleton h-20 w-full" />
              <div className="skeleton h-20 w-full" />
            </div>
          )}
          {isError && <p className="text-red-700">No se pudo cargar el listado.</p>}

          <ul className="space-y-2">
            {circuits?.map((item) => (
              <li key={item.id} className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-stone-500">
                      {item.discipline} · {item.province}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[item.status]}`}>
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
                    onClick={() => void startEdit(item)}
                    className="min-h-11 rounded-lg border border-stone-300 px-3 font-medium hover:bg-stone-50"
                  >
                    Editar
                  </button>
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
        </section>
      )}
    </main>
  );
}
