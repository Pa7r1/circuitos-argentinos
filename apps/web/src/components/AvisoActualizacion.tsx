import { useState } from 'react';
import { aplicarActualizacion } from '../lib/actualizacion';
import { useActualizacion } from '../lib/use-actualizacion';
import { Button } from './Button';

/**
 * Barra de "hay una versión nueva".
 *
 * No usa `useToast` a propósito: un aviso de la cola se va solo a los pocos
 * segundos y no lleva acción. Quien no llegue a leerlo se queda con la versión
 * vieja hasta la próxima publicación, que es justo el problema que esto viene a
 * resolver. Esta barra se queda hasta que la persona decide.
 *
 * Va abajo y no arriba: arriba está la cola de avisos (z-1100) y taparla escondería
 * un error de verdad. Por encima de la hoja del circuito (z-600) para que no quede
 * enterrada dentro de una ficha abierta.
 */
export function AvisoActualizacion() {
  const hay = useActualizacion();
  const [descartado, setDescartado] = useState(false);

  if (!hay || descartado) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      /*
        z-2100: por encima de todo lo que dibuja la app, incluido el recorrido
        guiado (z-2000) y los modales (z-1000). No es capricho de orden: con el
        aviso en z-1050, el fondo del tour lo tapaba y **se veía pero no se podía
        tocar**, que es la peor combinación posible para un botón. Comprobado en
        navegador: el clic lo interceptaba `.fondo-modal`.

        Que quede por encima de un modal abierto es a propósito. El botón dice lo
        que hace y quien lo aprieta decide; esconderlo mientras hay un formulario
        abierto lo dejaría invisible justo en la sesión larga, que es cuando la
        versión vieja más tiempo lleva dando vueltas.
      */
      className="flotante fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-1/2 z-[2100] flex w-[92%] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-3"
    >
      <p className="flex-1 text-sm font-medium">Hay una versión nueva de la app.</p>
      <Button tamano="sm" variante="primary" onClick={aplicarActualizacion}>
        Actualizar
      </Button>
      <button
        type="button"
        onClick={() => setDescartado(true)}
        aria-label="Descartar el aviso de actualización"
        className="-my-1 -mr-2 flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors duration-[var(--duracion-rapida)] hover:bg-white/15 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}
