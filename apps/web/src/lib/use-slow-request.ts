import { useEffect, useState } from 'react';

/** Umbral a partir del cual una carga deja de parecer normal (ms). */
const UMBRAL_MS = 4000;

/**
 * `true` cuando una carga se está haciendo larga. Sirve para avisar que la API
 * del plan gratuito se duerme a los 15 minutos y el primer pedido puede tardar
 * casi un minuto en despertarla, en vez de dejar al visitante mirando un
 * "Cargando…" que parece colgado.
 *
 * El cron del Worker (`worker/index.ts`) la mantiene despierta, pero esto sigue
 * haciendo falta: Render la reinicia en cada despliegue y el cron puede fallar.
 */
export function useSlowRequest(loading: boolean, umbralMs = UMBRAL_MS): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const id = setTimeout(() => setSlow(true), umbralMs);
    return () => clearTimeout(id);
  }, [loading, umbralMs]);

  return slow;
}
