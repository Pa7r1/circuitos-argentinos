import { useEffect, useState } from 'react';

/**
 * `beforeinstallprompt` no está en lib.dom porque no es estándar: lo implementan
 * Chrome, Edge y los navegadores basados en Chromium, y la especificación quedó
 * en borrador. Se declara acá con lo único que usamos.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * - `no-disponible`: ya está instalada, o el navegador no ofrece nada que hacer.
 * - `listo`: hay un evento guardado y se puede abrir el diálogo nativo.
 * - `manual-ios`: Safari no expone ninguna API; se instala a mano desde Compartir.
 */
export type EstadoInstalacion = 'no-disponible' | 'listo' | 'manual-ios';

/**
 * `standalone` en `navigator` es una propiedad vieja de Safari en iOS y no existe
 * en ningún otro navegador: sirve a la vez para saber si la app está abierta como
 * app y para reconocer el caso iOS, sin mirar el user agent.
 */
function navegador(): Navigator & { standalone?: boolean } {
  return navigator as Navigator & { standalone?: boolean };
}

function yaInstalada(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || navegador().standalone === true;
}

/**
 * Instalación de la PWA. La plataforma ya hace todo el trabajo —el manifest está
 * en `vite.config.ts` y el service worker lo registra el plugin—, así que esto es
 * solo guardar el evento que el navegador ofrece una vez y volver a dispararlo
 * cuando la persona lo pide.
 */
export function useInstalar(): { estado: EstadoInstalacion; instalar: () => void } {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalada, setInstalada] = useState(yaInstalada);

  useEffect(() => {
    function alOfrecer(e: Event) {
      // sin esto Chrome dibuja su propia barra de instalación abajo de todo, que
      // sobre el mapa tapa la hoja del circuito
      e.preventDefault();
      setEvento(e as BeforeInstallPromptEvent);
    }
    function alInstalar() {
      setInstalada(true);
      setEvento(null);
    }
    window.addEventListener('beforeinstallprompt', alOfrecer);
    window.addEventListener('appinstalled', alInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', alOfrecer);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  const estado: EstadoInstalacion = instalada
    ? 'no-disponible'
    : evento
      ? 'listo'
      : 'standalone' in navegador()
        ? 'manual-ios'
        : 'no-disponible';

  return {
    estado,
    instalar: () => {
      if (!evento) return;
      void evento.prompt();
      // el evento es de un solo uso: reusarlo tira una excepción y el botón
      // quedaría ofreciendo un diálogo que nunca aparece
      setEvento(null);
    },
  };
}
