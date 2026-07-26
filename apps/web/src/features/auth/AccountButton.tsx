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
        className="min-h-11 shrink-0 rounded-full bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700"
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
        className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-800 text-sm font-bold text-white"
      >
        {iniciales(session.user.name)}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute top-full right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl bg-white py-1 shadow-xl">
            <div className="border-b border-stone-100 px-3 py-2">
              <p className="truncate text-sm font-semibold">{session.user.name}</p>
              <p className="truncate text-xs text-stone-500">
                {session.user.email || 'Administración'}
              </p>
            </div>
            {session.user.role === 'admin' && (
              <Link
                to="/admin"
                onClick={() => setAbierto(false)}
                className="block px-3 py-2.5 text-sm hover:bg-stone-100"
              >
                Panel de administración
              </Link>
            )}
            <button
              onClick={() => {
                clearSession();
                setAbierto(false);
              }}
              className="block w-full px-3 py-2.5 text-left text-sm text-red-700 hover:bg-red-50"
            >
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}
