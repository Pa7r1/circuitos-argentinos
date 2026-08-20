import { registerSW } from 'virtual:pwa-register';
import { marcarActualizacionLista } from './actualizacion';

/**
 * Registro del service worker.
 *
 * Antes nadie importaba este módulo virtual, así que vite-plugin-pwa caía en el
 * registro plano de `registerSW.js`: registraba el worker y nada más. El worker
 * nuevo se activaba (lleva `skipWaiting` + `clientsClaim` cocidos en el bundle) y
 * limpiaba las cachés viejas, pero la pestaña abierta seguía corriendo el
 * JavaScript anterior. De ahí el "no veo los cambios hasta cerrar el navegador".
 *
 * Importarlo acá hace dos cosas: el plugin deja de inyectar aquel registro plano,
 * y `onNeedReload` nos entrega el momento en que el worker nuevo toma el control
 * en vez de recargar la página por su cuenta.
 */

/** Cada cuánto se le pregunta al servidor si hay versión nueva. */
const CADA_MS = 60 * 60 * 1000;

export function registrarServiceWorker(): void {
  registerSW({
    immediate: true,
    // el plugin llamaría a window.location.reload() acá; se lo cambiamos por el aviso
    onNeedReload: marcarActualizacionLista,
    onRegisteredSW(_url, registro) {
      if (!registro) return;
      /*
       * Una pestaña abierta durante días no vuelve a pedir el sw.js sola. Sin este
       * repaso, la persona que deja la app abierta en el teléfono nunca se entera
       * de que se publicó algo. Se saltea si la pestaña está en segundo plano o sin
       * red: pedirlo ahí es gastar batería y datos para recibir un error.
       */
      setInterval(() => {
        if (document.hidden || !navigator.onLine) return;
        void registro.update();
      }, CADA_MS);
    },
  });
}
