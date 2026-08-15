import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

/** Lo que dura la animación de salida; tiene que coincidir con --duracion-rapida. */
const SALIDA_MS = 180;
/** Piso de lectura. Un aviso más largo se queda más tiempo, hasta el tope. */
const MINIMO_MS = 4000;
const TOPE_MS = 9000;
/** Más de tres a la vez tapan la pantalla; los viejos se van antes de tiempo. */
const MAX_VISIBLES = 3;

interface Aviso {
  id: number;
  message: string;
  kind: 'error' | 'success';
  saliendo?: boolean;
}

let siguienteId = 0;

const ToastContext = createContext<(message: string, kind?: Aviso['kind']) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const cerrar = useCallback((id: number) => {
    setAvisos((prev) => prev.map((a) => (a.id === id ? { ...a, saliendo: true } : a)));
    setTimeout(() => setAvisos((prev) => prev.filter((a) => a.id !== id)), SALIDA_MS);
  }, []);

  /*
   * Los avisos se encolan en vez de pisarse. Antes había uno solo: al guardar un
   * circuito con dos problemas, el segundo mensaje borraba el primero y solo se
   * leía la mitad de lo que estaba mal.
   */
  const show = useCallback(
    (message: string, kind: Aviso['kind'] = 'error') => {
      const id = siguienteId++;
      setAvisos((prev) => [...prev, { id, message, kind }].slice(-MAX_VISIBLES));
      // leer lleva tiempo: "Enlace copiado" y un error de tres renglones no pueden
      // durar lo mismo en pantalla
      const duracion = Math.min(TOPE_MS, Math.max(MINIMO_MS, message.length * 60));
      setTimeout(() => cerrar(id), duracion);
    },
    [cerrar],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/*
       * Va ARRIBA y con z-index por encima de todo. Abajo quedaba tapado por la
       * hoja del circuito, que está en z-600 contra el z-50 que tenía: el aviso
       * de error existía pero no se veía. Arriba tampoco compite con el pulgar.
       */}
      <div className="pointer-events-none fixed top-3 left-1/2 z-[1100] flex w-[92%] max-w-md -translate-x-1/2 flex-col gap-2">
        {avisos.map((aviso) => (
          <div
            key={aviso.id}
            role="alert"
            aria-live="assertive"
            className={`aviso pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-float ${
              aviso.kind === 'error' ? 'bg-red-800' : 'bg-green-800'
            } ${aviso.saliendo ? 'saliendo' : ''}`}
          >
            <span aria-hidden="true" className="mt-px shrink-0">
              {aviso.kind === 'error' ? '⚠' : '✓'}
            </span>
            <p className="flex-1">{aviso.message}</p>
            <button
              type="button"
              onClick={() => cerrar(aviso.id)}
              aria-label="Cerrar el aviso"
              className="-my-1 -mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors duration-[var(--duracion-rapida)] hover:bg-white/15 hover:text-white"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
