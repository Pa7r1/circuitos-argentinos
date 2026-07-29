import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface ToastState {
  message: string;
  kind: 'error' | 'success';
}

const ToastContext = createContext<(message: string, kind?: ToastState['kind']) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((message: string, kind: ToastState['kind'] = 'error') => {
    setToast({ message, kind });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        /*
         * Va ARRIBA y con z-index por encima de todo. Abajo quedaba tapado por la
         * hoja del circuito, que está en z-600 contra el z-50 que tenía: el aviso
         * de error existía pero no se veía. Arriba tampoco compite con el pulgar.
         */
        <div
          role="alert"
          aria-live="assertive"
          className={`aviso fixed top-3 left-1/2 z-[1100] flex w-[92%] max-w-md -translate-x-1/2 items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-float ${
            toast.kind === 'error' ? 'bg-red-800' : 'bg-green-800'
          }`}
        >
          <span aria-hidden="true" className="mt-px shrink-0">
            {toast.kind === 'error' ? '⚠' : '✓'}
          </span>
          <p className="flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Cerrar el aviso"
            className="-my-1 -mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors duration-[var(--duracion-rapida)] hover:bg-white/15 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
