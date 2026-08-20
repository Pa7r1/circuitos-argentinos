import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  AdminCircuitDetail,
  AdminCircuitListItem,
  AdminStats,
  CircuitStatus,
} from '@circuitos/shared';
import { DISCIPLINES, PROVINCES } from '@circuitos/shared';
import { Button, ButtonLink } from '../../components/Button';
import { Field, VerPassword } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { api, mensajeParaPersona, RequestError } from '../../lib/api';
import { STATUS_LABEL } from '../../lib/format';
import { circuitKeys, useAdminCircuits, useAdminStats } from '../../lib/queries';
import { clearSession, setSession } from '../../lib/session';
import { useSession } from '../../lib/use-session';
import { CircuitForm } from './CircuitForm';

const STATUS_STYLE: Record<CircuitStatus, string> = {
  draft: 'bg-white/12 text-white/75',
  published: 'bg-green-500/15 text-green-300',
  archived: 'bg-red-500/15 text-red-300',
  // el cian es el color de acción del sitio: lo propuesto es lo único que pide algo de vos
  propuesto: 'bg-brand-500/20 text-brand-200',
  rechazado: 'bg-white/8 text-white/50',
};

/*
 * Orden de las pestañas: primero lo que está vivo en el mapa, después lo que
 * espera una decisión, después lo retirado, y al final los dos estados de paso.
 * «Ver todos» no es un estado: va detrás de un separador, porque mezclado con
 * los demás se leía como un sexto estado llamado «Todos».
 */
const FILTROS: CircuitStatus[] = ['published', 'propuesto', 'archived', 'draft', 'rechazado'];

/** En una pestaña se cuenta un conjunto, así que van en plural. */
const FILTRO_LABEL: Record<CircuitStatus, string> = {
  published: 'Publicados',
  propuesto: 'Propuestas',
  archived: 'Archivados',
  draft: 'Borradores',
  rechazado: 'Rechazados',
};

/**
 * Filas por página. La API admite hasta 100, pero cada circuito es una tarjeta
 * con dos renglones y una botonera: de a veinte, la página entra en dos o tres
 * pantallas de teléfono y los controles de paginación quedan al alcance.
 */
const POR_PAGINA = 20;

/** Tacho: la única acción del panel que no se puede deshacer lleva su propia marca. */
function IconoTacho() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

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
  const [verPassword, setVerPassword] = useState(false);
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
        <h1 className="titulo text-xl">Panel de administración</h1>
        <p className="mt-1 mb-5 text-sm text-white/65">
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
            type={verPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error ?? undefined}
            adorno={<VerPassword visible={verPassword} onToggle={() => setVerPassword((v) => !v)} />}
          />
          <Button type="submit" variante="primary" tamano="lg" ancho disabled={mutation.isPending}>
            {mutation.isPending ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>
      </div>
      <Link
        to="/"
        className="mt-4 block py-2 text-center text-sm font-medium text-white/65 hover:text-white"
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
        <h1 className="mb-2 titulo text-xl">No tenés acceso al panel</h1>
        <p className="mb-6 text-sm text-white/65">
          Entraste como <strong className="text-white">{nombre}</strong>, una cuenta sin
          permisos de administración.
        </p>
        <Button variante="primary" tamano="lg" ancho onClick={() => clearSession()}>
          Entrar con otra cuenta
        </Button>
      </div>
      <Link
        to="/"
        className="mt-4 block py-2 text-center text-sm font-medium text-white/65 hover:text-white"
      >
        ← Volver al mapa
      </Link>
    </main>
  );
}

/**
 * Contadores del panel. Antes faltaban propuestos y rechazados, así que la suma
 * del resumen nunca daba la cantidad de filas de la lista y parecía un error.
 */
function Resumen({ data }: { data?: AdminStats }) {
  const items = [
    ['Publicados', data?.published, false],
    ['Propuestas', data?.propuesto, true],
    ['Borradores', data?.draft, false],
    ['Archivados', data?.archived, false],
    ['Rechazados', data?.rechazado, false],
    ['Usuarios', data?.users, false],
  ] as const;

  return (
    <dl className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map(([label, valor, destacado]) => (
        <div key={label} className="tarjeta px-4 py-3">
          <dt className="text-xs font-medium tracking-wide text-white/55 uppercase">{label}</dt>
          {/* lo propuesto es lo único que pide una decisión: se pinta con el
              color de acción cuando hay algo esperando, y no cuando está en cero */}
          <dd
            className={`mt-0.5 text-3xl font-bold tabular-nums ${
              destacado && (valor ?? 0) > 0 ? 'text-brand-200' : ''
            }`}
          >
            {valor ?? '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminPage() {
  const session = useSession();
  const [modal, setModal] = useState<{ editing?: AdminCircuitDetail } | null>(null);
  // si el formulario tiene algo escrito, el modal deja de cerrarse solo
  const [sucio, setSucio] = useState(false);
  // el confirm() del navegador se ve distinto en cada sistema, no se puede
  // traducir ni estilar, y aparecía en medio de una interfaz cuidada
  const [porArchivar, setPorArchivar] = useState<AdminCircuitListItem | null>(null);
  const [porRechazar, setPorRechazar] = useState<AdminCircuitListItem | null>(null);
  const [porBorrar, setPorBorrar] = useState<AdminCircuitListItem | null>(null);
  // el panel abre en lo que está publicado: es el estado del que se parte para
  // trabajar, y «todos» de entrada mezclaba borradores y rechazos con el mapa real
  const [filtro, setFiltro] = useState<CircuitStatus | 'todos'>('published');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(0);
  const queryClient = useQueryClient();
  const toast = useToast();

  const esAdmin = session?.user.role === 'admin';
  const { data: stats } = useAdminStats(!!esAdmin);
  /*
   * El texto que se manda al servidor va con retardo respecto del que se escribe.
   * Sin esto cada tecla dispara un pedido, y en el teléfono de quien administra
   * eso son diez llamadas para escribir «Chilecito». 300 ms es lo que tarda una
   * pausa entre palabras.
   */
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setBusquedaAplicada(busqueda.trim());
      setPagina(0);
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const { data, isPending, isError, error } = useAdminCircuits(!!esAdmin, {
    limit: POR_PAGINA,
    offset: pagina * POR_PAGINA,
    estado: filtro === 'todos' ? undefined : filtro,
    q: busquedaAplicada || undefined,
  });
  const enPagina = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  /**
   * Lo que espera una decisión tuya. Sale de los contadores y no de la lista:
   * con la lista paginada, contar sobre lo que llegó daría «los propuestos de
   * esta página», que es un número sin significado.
   */
  const pendientes = stats?.propuesto ?? 0;

  /*
   * La búsqueda la resuelve el servidor con `?q=`, así que lo que llega ya está
   * filtrado y `total` es el total de lo que coincide. Antes esto filtraba en el
   * cliente sobre la página cargada: con la paginación en el servidor eso pasó a
   * buscar solo entre veinte, y un resultado vacío se leía como «no existe».
   */
  const visibles = enPagina;

  /** Cambiar de filtro o de texto arranca de nuevo: la página 4 de otra cosa no existe. */
  const cambiarFiltro = (f: CircuitStatus | 'todos') => {
    setFiltro(f);
    setPagina(0);
  };

  /*
   * Si la última página se queda sin filas —se archivó, se rechazó o se borró lo
   * que había— el offset queda apuntando fuera del total y la lista sale vacía
   * sin ninguna explicación. Se retrocede a la última que sí existe.
   */
  useEffect(() => {
    if (data && pagina >= totalPaginas) setPagina(totalPaginas - 1);
  }, [data, pagina, totalPaginas]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CircuitStatus }) =>
      status === 'archived' ? api.admin.archive(id) : api.admin.update(id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: circuitKeys.all });
      void queryClient.invalidateQueries({ queryKey: circuitKeys.adminList });
      void queryClient.invalidateQueries({ queryKey: circuitKeys.adminStats });
    },
    onError: (e) => toast(mensajeParaPersona(e)),
  });

  /** De qué fila es el cambio de estado que está en curso, si hay alguno. */
  const cambiando = statusMutation.isPending ? statusMutation.variables.id : null;

  /*
   * Borrar la sesión es un efecto sobre un store externo, así que no puede pasar
   * durante el render: en StrictMode el render corre dos veces y se ejecutaba dos
   * veces. Va acá arriba con el resto de los hooks porque debajo hay returns
   * tempranos, y un hook después de un return condicional no es un hook.
   */
  const sesionVencida =
    isError && error instanceof RequestError && [401, 403].includes(error.statusCode);
  useEffect(() => {
    if (sesionVencida) clearSession();
  }, [sesionVencida]);

  if (!session) return <LoginForm />;
  if (!esAdmin) return <SinPermisos nombre={session.user.name} />;
  if (sesionVencida) return <LoginForm />;

  async function abrirEdicion(item: AdminCircuitListItem) {
    try {
      setSucio(false);
      setModal({ editing: await api.admin.detail(item.id) });
    } catch {
      toast('No se pudo cargar el circuito');
    }
  }

  return (
    <div className="min-h-full">
      {/* barra de la aplicación: fija arriba, para no perder la salida al scrollear */}
      <header className="flotante sticky top-0 z-10 rounded-none">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <h1 className="titulo text-lg">Administración</h1>
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
        <Resumen data={stats} />

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
          <Button
            variante="primary"
            onClick={() => {
              setSucio(false);
              setModal({});
            }}
            className="shrink-0"
          >
            <span aria-hidden="true">+</span> Nuevo circuito
          </Button>
        </div>

        {/* se envuelve en vez de desbordarse: seis pestañas no entran en un
            teléfono, y un carrusel horizontal esconde las últimas sin avisar */}
        <div
          className="mb-4 flex flex-wrap items-center gap-1 rounded-xl bg-white/8 p-1 ring-1 ring-white/10"
          role="group"
          aria-label="Filtrar por estado"
        >
          {FILTROS.map((f) => (
            <button
              key={f}
              onClick={() => cambiarFiltro(f)}
              aria-pressed={filtro === f}
              className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors duration-[var(--duracion-rapida)] ease-suave ${
                filtro === f
                  ? 'bg-white/15 text-white shadow-card'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {FILTRO_LABEL[f]}
              {f === 'propuesto' && pendientes > 0 && (
                <span className="ml-1.5 rounded-full bg-brand-700 px-1.5 py-0.5 text-xs font-bold text-white tabular-nums">
                  {pendientes}
                </span>
              )}
            </button>
          ))}
          <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-white/15" />
          <button
            onClick={() => cambiarFiltro('todos')}
            aria-pressed={filtro === 'todos'}
            className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors duration-[var(--duracion-rapida)] ease-suave ${
              filtro === 'todos'
                ? 'bg-white/15 text-white shadow-card'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Ver todos
          </button>
        </div>

        {isPending && (
          <div className="space-y-2" aria-busy="true">
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-24 w-full" />
          </div>
        )}
        {isError && (
          <p className="rounded-xl border border-red-400/30 bg-red-500/12 p-3 text-red-200">No se pudo cargar el listado.</p>
        )}
        {!isPending && visibles.length === 0 && (
          <div className="tarjeta px-4 py-10 text-center">
            <p className="font-medium text-white/80">
              {busquedaAplicada
                ? `Ningún circuito coincide con «${busquedaAplicada}».`
                : filtro === 'todos'
                  ? 'Todavía no hay circuitos.'
                  : `No hay circuitos en «${FILTRO_LABEL[filtro]}».`}
            </p>
            <p className="mt-1 text-sm text-white/55">
              {busquedaAplicada
                ? filtro === 'todos'
                  ? 'Probá con otro texto o borralo para ver la lista entera.'
                  : `Buscá en «Ver todos»: puede estar en otro estado.`
                : filtro === 'todos'
                  ? 'Cargá el primero con su archivo GPX y quedará listo para publicar.'
                  : 'Probá con otro estado o mirá «Ver todos».'}
            </p>
          </div>
        )}

        <ul className="space-y-2">
          {visibles.map((item) => (
            <li key={item.id} className="tarjeta p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{item.name}</p>
                  <p className="mt-0.5 text-sm text-white/55">
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
              {/*
                Dos grupos y no una fila que se desborda: con `flex-wrap` y un
                `ml-auto` en la acción destructiva, al angostarse la pantalla
                "Archivar" caía a un renglón propio pegado a la derecha y parecía
                un error de maquetado. Agrupadas, la fila se parte de forma
                previsible y lo destructivo queda siempre separado de lo demás.
              */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {/* la mutación es una sola para toda la lista, así que se mira
                      también de qué fila es: sin esto, un doble clic mandaba dos
                      PATCH del mismo circuito, y deshabilitar por `isPending` a
                      secas apagaba los botones de todas las filas a la vez */}
                  {item.status !== 'published' ? (
                    <Button
                      variante="success"
                      tamano="sm"
                      disabled={cambiando === item.id}
                      onClick={() => statusMutation.mutate({ id: item.id, status: 'published' })}
                    >
                      Publicar
                    </Button>
                  ) : (
                    <Button
                      variante="secondary"
                      tamano="sm"
                      disabled={cambiando === item.id}
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
                </div>
                {/*
                  El borrado definitivo solo existe donde la API lo acepta
                  —rechazado y archivado—: en cualquier otro estado responde 409,
                  así que ofrecerlo sería prometer algo que no va a pasar. Lleva
                  icono además de texto, para que no se confunda de un vistazo con
                  «Archivar», que sí se deshace.
                */}
                {item.status === 'propuesto' ? (
                  <Button
                    variante="danger"
                    tamano="sm"
                    className="shrink-0"
                    onClick={() => setPorRechazar(item)}
                  >
                    Rechazar
                  </Button>
                ) : item.status === 'archived' || item.status === 'rechazado' ? (
                  <Button
                    variante="danger"
                    tamano="sm"
                    className="shrink-0"
                    onClick={() => setPorBorrar(item)}
                  >
                    <IconoTacho />
                    Borrar
                  </Button>
                ) : (
                  <Button
                    variante="danger"
                    tamano="sm"
                    className="shrink-0"
                    onClick={() => setPorArchivar(item)}
                  >
                    Archivar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* mientras hay una sola página no ocupa lugar: no hay nada que decidir */}
        {totalPaginas > 1 && (
          <nav
            className="mt-4 flex items-center justify-between gap-3"
            aria-label="Paginación del listado"
          >
            <Button
              variante="secondary"
              tamano="sm"
              disabled={pagina === 0}
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
            >
              <span aria-hidden="true">←</span> Anterior
            </Button>
            {/* aria-live: quien navega con lector se entera de que cambió la página,
                que si no es un cambio silencioso en medio de la lista */}
            <p className="text-sm text-white/65 tabular-nums" aria-live="polite">
              Página {pagina + 1} de {totalPaginas}
              <span className="hidden sm:inline"> · {total} circuitos</span>
            </p>
            <Button
              variante="secondary"
              tamano="sm"
              disabled={pagina >= totalPaginas - 1}
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente <span aria-hidden="true">→</span>
            </Button>
          </nav>
        )}

        {porBorrar && (
          <BorrarModal
            item={porBorrar}
            onClose={() => setPorBorrar(null)}
            onHecho={() => {
              setPorBorrar(null);
              void queryClient.invalidateQueries({ queryKey: circuitKeys.all });
              void queryClient.invalidateQueries({ queryKey: circuitKeys.adminList });
              void queryClient.invalidateQueries({ queryKey: circuitKeys.adminStats });
              toast('Circuito borrado para siempre', 'success');
            }}
          />
        )}

        {porRechazar && (
          <RechazarModal
            item={porRechazar}
            onClose={() => setPorRechazar(null)}
            onHecho={() => {
              setPorRechazar(null);
              void queryClient.invalidateQueries({ queryKey: circuitKeys.adminList });
              void queryClient.invalidateQueries({ queryKey: circuitKeys.adminStats });
              toast('Propuesta rechazada', 'success');
            }}
          />
        )}

        {porArchivar && (
          <Modal title="¿Archivar este circuito?" onClose={() => setPorArchivar(null)}>
            <p className="mb-1 text-white/80">
              <strong className="font-semibold text-white">{porArchivar.name}</strong> va a dejar
              de verse en el mapa.
            </p>
            <p className="mb-5 text-sm text-white/55">
              No se borra nada: podés volver a publicarlo cuando quieras desde el filtro
              «Archivado».
            </p>
            <div className="flex gap-2">
              <Button variante="secondary" ancho onClick={() => setPorArchivar(null)}>
                Cancelar
              </Button>
              <Button
                variante="primary"
                ancho
                onClick={() => {
                  statusMutation.mutate({ id: porArchivar.id, status: 'archived' });
                  setPorArchivar(null);
                }}
              >
                Archivar
              </Button>
            </div>
          </Modal>
        )}

        {modal && (
          <Modal
            title={modal.editing ? `Editar: ${modal.editing.name}` : 'Nuevo circuito'}
            onClose={() => setModal(null)}
            size="lg"
            // en cuanto hay algo cargado, un clic al aire deja de tirar el formulario
            cierreExterno={!sucio}
          >
            <CircuitForm
              editing={modal.editing}
              onSucio={() => setSucio(true)}
              onDone={() => setModal(null)}
            />
          </Modal>
        )}
      </main>
    </div>
  );
}

/**
 * Rechazo de una propuesta. Pide el motivo porque sin él, dentro de un mes, no hay
 * forma de saber por qué se descartó ni de responderle a quien la mandó.
 */
function RechazarModal({
  item,
  onClose,
  onHecho,
}: {
  item: AdminCircuitListItem;
  onClose: () => void;
  onHecho: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      api.admin.update(item.id, { status: 'rechazado', rejectionReason: motivo.trim() }),
    onSuccess: onHecho,
    onError: () => toast('No se pudo rechazar. Reintentá en un rato.'),
  });

  return (
    <Modal title="Rechazar esta propuesta" onClose={onClose}>
      <p className="mb-4 text-sm text-white/80">
        <strong className="font-semibold text-white">{item.name}</strong> no va a publicarse. Queda
        guardada con el motivo, así que si alguien la vuelve a proponer vas a saber qué pasó.
      </p>
      <Field
        label="Motivo"
        id="motivo-rechazo"
        required
        maxLength={1000}
        placeholder="Está repetido, el enlace no anda, queda en propiedad privada…"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      <div className="mt-5 flex gap-2">
        <Button variante="secondary" ancho onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variante="danger"
          ancho
          disabled={motivo.trim() === '' || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Rechazando…' : 'Rechazar'}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Borrado definitivo. Es la única acción del panel que no se puede deshacer: no
 * cambia un estado, saca la fila de la base y se lleva con ella las fotos y el
 * archivo del recorrido.
 *
 * Por eso no alcanza con un «¿seguro?»: hay que escribir el nombre del circuito.
 * Un botón de confirmar a un clic de distancia se aprieta por inercia, sobre todo
 * cuando el modal de al lado —«Archivar»— se confirma igual y no borra nada.
 */
function BorrarModal({
  item,
  onClose,
  onHecho,
}: {
  item: AdminCircuitListItem;
  onClose: () => void;
  onHecho: () => void;
}) {
  const [escrito, setEscrito] = useState('');
  const toast = useToast();
  // sin distinguir mayúsculas ni espacios de los bordes: la traba es no borrar
  // por reflejo, no tomar un dictado
  const coincide = escrito.trim().toLowerCase() === item.name.trim().toLowerCase();

  const mutation = useMutation({
    mutationFn: () => api.admin.borrarDefinitivo(item.id),
    onSuccess: onHecho,
    onError: (e) => toast(mensajeParaPersona(e)),
  });

  return (
    <Modal title="Borrar para siempre" onClose={onClose}>
      {/* la advertencia va en rojo y arriba de todo: es lo primero que se lee, no
          una nota al pie debajo del campo */}
      <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/12 p-3">
        <p className="text-sm font-semibold text-red-200">Esto no se puede deshacer.</p>
        <p className="mt-1 text-sm text-red-100/85">
          <strong className="font-semibold text-white">{item.name}</strong> desaparece de la base
          junto con sus fotos y su archivo del recorrido. No queda copia ni forma de recuperarlo.
        </p>
      </div>
      <p className="mb-4 text-sm text-white/65">
        Si solo querés sacarlo del mapa, cerrá esto y usá <strong>Archivar</strong>: eso se puede
        revertir cuando quieras.
      </p>
      <Field
        label={`Escribí «${item.name}» para habilitar el botón`}
        id="confirmar-borrado"
        autoComplete="off"
        value={escrito}
        onChange={(e) => setEscrito(e.target.value)}
        placeholder={item.name}
      />
      <div className="mt-5 flex gap-2">
        <Button variante="secondary" ancho onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variante="danger-solido"
          ancho
          disabled={!coincide || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Borrando…' : 'Borrar para siempre'}
        </Button>
      </div>
    </Modal>
  );
}
