import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { PieSitio } from '../../components/PieSitio';
import { api, RequestError } from '../../lib/api';
import { clearSession } from '../../lib/session';
import { useSession } from '../../lib/use-session';

const iniciales = (nombre: string) =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

/** Botón de cuenta: entra si no hay sesión, o abre el menú del usuario. */
export function AccountButton({ onPedirCuenta }: { onPedirCuenta: () => void }) {
  const session = useSession();
  const [abierto, setAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  if (!session) {
    return (
      <button
        data-tour="cuenta"
        onClick={onPedirCuenta}
        // brand-700 y no brand-600: con blanco encima, el 600 se queda en 3,56:1
        // y AA pide 4,5:1 para este tamaño de texto. Ver el comentario en Button.tsx.
        className="min-h-11 shrink-0 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white transition-[background-color,scale] duration-[var(--duracion-rapida)] ease-suave hover:bg-brand-800 motion-safe:active:scale-[0.97]"
      >
        Entrar
      </button>
    );
  }

  return (
    <div data-tour="cuenta" className="relative shrink-0">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={`Cuenta de ${session.user.name}`}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white ring-1 ring-white/20 transition-[background-color,scale] duration-[var(--duracion-rapida)] ease-suave hover:bg-white/25 motion-safe:active:scale-[0.97]"
      >
        {iniciales(session.user.name)}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="hoja flotante absolute top-full right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl py-1">
            <div className="border-b border-white/10 px-3 py-2">
              <p className="truncate text-sm font-semibold text-white">{session.user.name}</p>
              <p className="truncate text-xs text-white/60">
                {session.user.email || 'Administración'}
              </p>
            </div>
            {session.user.role === 'admin' && (
              <Link
                to="/admin"
                onClick={() => setAbierto(false)}
                className="block px-3 py-2.5 text-sm text-white transition-colors duration-[var(--duracion-rapida)] hover:bg-white/12"
              >
                Panel de administración
              </Link>
            )}
            <button
              onClick={() => {
                clearSession();
                setAbierto(false);
              }}
              className="block w-full px-3 py-2.5 text-left text-sm text-red-300 transition-colors duration-[var(--duracion-rapida)] hover:bg-red-500/15"
            >
              Cerrar sesión
            </button>

            <div className="border-t border-white/10 px-3 py-2">
              {/*
                El borrado va acá abajo, separado y sin ser lo primero que se toca:
                es irreversible. La política de privacidad promete este derecho
                (ley 25.326), así que tiene que existir de verdad y no por correo.
              */}
              <button
                onClick={() => {
                  setAbierto(false);
                  setConfirmando(true);
                }}
                className="min-h-9 text-xs text-white/50 underline-offset-4 hover:text-white/80 hover:underline"
              >
                Borrar mi cuenta
              </button>
              {/* el mismo pie que el resto del sitio: los cuatro enlaces en un
                  solo lugar, sin una segunda copia que se desvíe */}
              <PieSitio className="mt-2 gap-y-1 text-xs text-white/35" />
            </div>
          </div>
        </>
      )}

      {confirmando && <BorrarCuentaModal onClose={() => setConfirmando(false)} />}
    </div>
  );
}

/**
 * Confirmación de borrado. Pide escribir la palabra en vez de un "¿estás seguro?":
 * la acción no se puede deshacer y un botón de sí a un clic se aprieta sin leer.
 */
function BorrarCuentaModal({ onClose }: { onClose: () => void }) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.deleteAccount(),
    // clearSession vacía el almacenamiento y avisa a toda la app: la pantalla
    // vuelve sola al estado de visitante
    onSuccess: () => clearSession(),
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'No pudimos borrar la cuenta. Reintentá en un rato.',
      ),
  });

  return (
    <Modal title="Borrar mi cuenta" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
      >
        <p className="text-sm text-white/80">
          Se borran tu nombre, tu email y tu contraseña de la base.{' '}
          <strong className="text-white">No se puede deshacer</strong> y vas a perder el acceso a
          las fichas de los circuitos.
        </p>
        <Field
          label="Escribí BORRAR para confirmar"
          id="borrar-confirmacion"
          required
          autoComplete="off"
          value={texto}
          onChange={(ev) => setTexto(ev.target.value)}
          error={error ?? undefined}
        />
        <Button
          type="submit"
          variante="danger"
          tamano="lg"
          ancho
          disabled={texto.trim().toUpperCase() !== 'BORRAR' || mutation.isPending}
        >
          {mutation.isPending ? 'Borrando…' : 'Borrar mi cuenta para siempre'}
        </Button>
        <Button type="button" variante="secondary" tamano="lg" ancho onClick={onClose}>
          Cancelar
        </Button>
      </form>
    </Modal>
  );
}
