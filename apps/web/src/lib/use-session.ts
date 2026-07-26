import { useSyncExternalStore } from 'react';
import { getSession, subscribe, type Session } from './session';

/** La sesión actual, reactiva en toda la app. */
export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession, () => null);
}
