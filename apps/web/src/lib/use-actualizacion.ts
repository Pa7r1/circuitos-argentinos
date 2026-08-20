import { useSyncExternalStore } from 'react';
import { hayActualizacion, suscribirActualizacion } from './actualizacion';

/** `true` cuando hay una versión nueva del sitio esperando una recarga. */
export function useActualizacion(): boolean {
  return useSyncExternalStore(suscribirActualizacion, hayActualizacion, () => false);
}
