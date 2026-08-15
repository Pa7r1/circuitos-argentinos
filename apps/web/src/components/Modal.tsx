import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Lo que dura la animación de salida; tiene que coincidir con --duracion-media. */
const SALIDA_MS = 260;

/** Modal accesible: cierra con Escape, atrapa el foco y bloquea el scroll de fondo. */
export function Modal({
  title,
  onClose,
  children,
  size = 'md',
  cierreExterno = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg';
  /**
   * Si es `false`, el clic en el fondo y Escape dejan de cerrar. Para formularios
   * largos: un toque al aire tiraba todo lo cargado sin preguntar. El botón ✕
   * sigue funcionando siempre, así que nunca queda una trampa sin salida.
   */
  cierreExterno?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [cerrando, setCerrando] = useState(false);
  // el listener de teclado se registra una vez y se queda con el primer render;
  // sin este ref leería `cerrando` siempre en false y Escape repetido programaría
  // un onClose por cada pulsación
  const cerrandoRef = useRef(false);
  const cierreExternoRef = useRef(cierreExterno);
  cierreExternoRef.current = cierreExterno;

  /*
   * Salida animada sin tocar a quien usa el modal.
   *
   * El patrón de siempre es `{abierto && <Modal/>}`, así que React desmonta el
   * nodo apenas cambia el estado y no queda nada que animar. En vez de cambiar
   * todos los llamadores por un sistema de presencia, el modal se cierra a sí
   * mismo: pinta la salida y recién entonces avisa. Todo lo que llama a cerrar
   * pasa por acá, incluidos Escape y el clic en el fondo.
   */
  const cerrar = () => {
    if (cerrandoRef.current) return;
    cerrandoRef.current = true;
    setCerrando(true);
    setTimeout(onClose, SALIDA_MS);
  };

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('input, button, select, textarea')?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // por ref: el listener se registra una vez y `cierreExterno` puede cambiar
        // después, en cuanto el formulario de adentro tiene algo escrito
        if (cierreExternoRef.current) cerrar();
        return;
      }
      if (e.key !== 'Tab') return;
      // foco atrapado dentro del panel
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const primero = focusables[0]!;
      const ultimo = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previo?.focus();
    };
    // el efecto depende solo de `onClose`: `cerrar` se recrea en cada render y
    // solo lee estado propio, así que incluirlo remontaría el listener sin motivo
  }, [onClose]);

  return (
    <div
      className={`fondo-modal fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4 ${
        cerrando ? 'saliendo' : ''
      }`}
      onClick={cierreExterno ? cerrar : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`panel-modal flotante max-h-[92vh] w-full overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl ${
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md'
        } ${cerrando ? 'saliendo' : ''}`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          {/* el tirador solo aparece en teléfono, donde el modal es una hoja */}
          <h2 className="titulo text-xl">{title}</h2>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="-mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-white/55 transition-colors duration-[var(--duracion-rapida)] hover:bg-white/12 hover:text-white"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
