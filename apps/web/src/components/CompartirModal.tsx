import { DESTINOS } from '../lib/compartir';
import { Button } from './Button';
import { Modal } from './Modal';
import { useToast } from './Toast';

/** Glifos de cada marca. Los dibujamos acá para no sumar una librería de iconos. */
const LOGOS: Record<string, string> = {
  whatsapp:
    'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2m5.8 14.17c-.25.69-1.45 1.32-1.99 1.4-.51.08-1.15.11-1.86-.12-.43-.14-.98-.32-1.68-.62-2.96-1.28-4.89-4.26-5.04-4.46s-1.2-1.6-1.2-3.05.76-2.16 1.03-2.46c.27-.3.59-.37.79-.37h.56c.18 0 .42-.07.66.5.25.59.84 2.04.91 2.19.08.15.13.32.02.52-.1.2-.16.32-.31.5s-.32.39-.46.53c-.15.15-.31.31-.13.61s.79 1.31 1.7 2.12c1.17 1.04 2.15 1.37 2.45 1.52.3.15.48.13.66-.08s.76-.89.96-1.19c.2-.3.4-.25.67-.15s1.73.82 2.03.97.5.22.57.35c.07.12.07.71-.18 1.4',
  facebook:
    'M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46H15.2c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.43-4.92 8.43-9.94',
  telegram:
    'M21.94 4.6 18.62 20.3c-.25 1.1-.9 1.38-1.83.86l-5.05-3.74-2.43 2.35c-.27.27-.5.5-1.02.5l.36-5.16 9.36-8.48c.4-.36-.09-.56-.63-.2L5.83 13.72.85 12.15c-1.08-.34-1.1-1.08.23-1.6l19.2-7.42c.9-.33 1.69.21 1.66 1.47',
  x: 'M17.53 3h3.02l-6.6 7.54L21.72 21h-6.08l-4.76-6.23L5.43 21H2.4l7.06-8.07L2.28 3h6.23l4.3 5.69zm-1.06 16.18h1.67L7.6 4.73H5.81z',
};

/**
 * Adónde mandar el circuito.
 *
 * Antes esto era un solo botón: en el teléfono abría la hoja del sistema, pero en
 * computadora se limitaba a copiar el enlace sin decir a dónde llevarlo. Las apps
 * a la vista ahorran ese paso a ciegas, y en el teléfono "Más apps" sigue abriendo
 * la hoja nativa, que es donde aparece Instagram si está instalada —Instagram no
 * tiene URL de compartir, así que ese es el único camino real.
 */
export function CompartirModal({
  nombre,
  texto,
  url,
  onClose,
}: {
  nombre: string;
  texto: string;
  url: string;
  onClose: () => void;
}) {
  const toast = useToast();

  return (
    <Modal title="Compartir circuito" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-white/70">
          Mandale <strong className="text-white">{nombre}</strong> a quien quieras llevar.
        </p>

        <div className="grid grid-cols-4 gap-2">
          {DESTINOS.map((destino) => (
            <a
              key={destino.id}
              href={destino.href(url, texto)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex min-h-11 flex-col items-center gap-2 rounded-xl px-1 py-3 text-xs font-medium text-white/80 transition-colors duration-[var(--duracion-rapida)] hover:bg-white/10 hover:text-white"
            >
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: destino.color }}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white">
                  <path d={LOGOS[destino.id]} />
                </svg>
              </span>
              {destino.nombre}
            </a>
          ))}
        </div>

        <Button
          variante="secondary"
          ancho
          onClick={() => {
            void navigator.clipboard
              .writeText(url)
              .then(() => {
                toast('Enlace copiado', 'success');
                onClose();
              })
              .catch(() => toast('No pudimos copiar el enlace'));
          }}
        >
          Copiar enlace
        </Button>

        {/* solo donde el sistema tiene su propia hoja: en escritorio no existe */}
        {typeof navigator.share === 'function' && (
          <Button
            variante="ghost"
            ancho
            onClick={() => {
              void navigator
                .share({ title: nombre, text: texto, url })
                .then(onClose)
                // cancelar la hoja entra por acá: no es un error que mostrar
                .catch(() => {});
            }}
          >
            Más apps…
          </Button>
        )}
      </div>
    </Modal>
  );
}
