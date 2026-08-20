import { useEffect, useState } from 'react';

/** Menos que esto es la barra de direcciones encogiéndose, no un teclado. */
const MINIMO_TECLADO = 160;

/**
 * ¿Está abierto el teclado virtual?
 *
 * El `interactive-widget=resizes-content` del viewport arregla Android —el layout
 * se achica y `position: fixed` vuelve a caer donde corresponde—, pero iOS no
 * redimensiona nada: deja el layout igual y solo mueve el *visual viewport*. Por eso
 * la señal se saca de ahí, comparando su alto con el de la ventana.
 *
 * Donde `visualViewport` no existe devuelve siempre false, que es el estado de antes.
 */
export function useTecladoAbierto(): boolean {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const mirar = () => setAbierto(window.innerHeight - vv.height > MINIMO_TECLADO);
    mirar();
    vv.addEventListener('resize', mirar);
    return () => vv.removeEventListener('resize', mirar);
  }, []);

  return abierto;
}
