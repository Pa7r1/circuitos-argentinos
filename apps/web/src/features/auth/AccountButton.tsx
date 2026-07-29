import { useState } from 'react';
import { Link } from 'react-router-dom';
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

  if (!session) {
    return (
      <button
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
    <div className="relative shrink-0">
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
          </div>
        </>
      )}
    </div>
  );
}
