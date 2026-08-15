import { useState } from 'react';
import { useInstalar } from '../lib/use-instalar';
import { Modal } from './Modal';

/**
 * Ofrece instalar la app. No se dibuja si ya está instalada o si el navegador no
 * ofrece ninguna vía, así que quien no puede hacer nada con esto no lo ve.
 *
 * Hereda las clases de quien lo usa porque va siempre dentro de una fila de
 * enlaces —el pie y el menú de cuenta—, no como acción propia: instalar es una
 * comodidad, no lo que venimos a pedirle a nadie.
 */
export function BotonInstalar({ className = '' }: { className?: string }) {
  const { estado, instalar } = useInstalar();
  const [verPasos, setVerPasos] = useState(false);

  if (estado === 'no-disponible') return null;

  return (
    <>
      <button
        type="button"
        onClick={estado === 'listo' ? instalar : () => setVerPasos(true)}
        className={className}
      >
        Instalar app
      </button>

      {/* Safari no expone ninguna API de instalación: lo único que podemos hacer
          es contar dónde está el botón que sí la instala. */}
      {verPasos && (
        <Modal title="Instalar en tu iPhone" onClose={() => setVerPasos(false)}>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-white/80 marker:text-white/40">
            <li>
              Tocá el botón <strong className="text-white">Compartir</strong> abajo en el medio de
              Safari.
            </li>
            <li>
              Deslizá y elegí <strong className="text-white">Agregar a pantalla de inicio</strong>.
            </li>
            <li>Tocá Agregar y listo: te queda el ícono junto al resto de tus apps.</li>
          </ol>
        </Modal>
      )}
    </>
  );
}
