import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CONTACTO } from '../features/legal/LegalLayout';
import { BotonInstalar } from './BotonInstalar';
import { Button } from './Button';
import { Modal } from './Modal';
import { useToast } from './Toast';

/**
 * Mismo aspecto para los cuatro: son pares, ninguno es una acción destacada.
 *
 * El `flex items-center` no es decorativo: como hijos de un flex, los `<a>` se
 * blockifican y apoyan el texto arriba de sus 36 px, mientras que el `<button>` lo
 * centra solo. Sin esto, "Contacto" queda medio renglón más abajo que el resto.
 */
const ENLACE =
  'flex min-h-9 items-center underline-offset-4 transition-colors hover:text-white hover:underline';

/**
 * Términos · Privacidad · Contacto · Instalar.
 *
 * Existe porque los textos legales solo se alcanzaban desde el menú de cuenta, o
 * sea con sesión iniciada: quien todavía no se registró no tenía forma de leer lo
 * que se le pide aceptar.
 */
export function PieSitio({ className = '' }: { className?: string }) {
  const [contacto, setContacto] = useState(false);

  return (
    <>
      {/*
        Separados por espacio y no por "·": el botón de instalar no se dibuja en
        todos los navegadores, y un separador colgado al final se ve roto.

        El tamaño y el color los pone quien lo usa, no este componente: una clase de
        tamaño acá y otra en `className` son la misma propiedad, y cuál gana lo
        decide el orden del CSS generado, no el de la cadena. Puestos los dos, el pie
        del mapa se dibujaba a 12 px y el texto se partía en dos líneas.
      */}
      <div className={`flex flex-wrap items-center gap-x-4 ${className}`}>
        <Link to="/proponer" className={ENLACE}>
          Sumá tu circuito
        </Link>
        <Link to="/terminos" className={ENLACE}>
          Términos
        </Link>
        <Link to="/privacidad" className={ENLACE}>
          Privacidad
        </Link>
        <button type="button" onClick={() => setContacto(true)} className={ENLACE}>
          Contacto
        </button>
        <BotonInstalar className={ENLACE} />
      </div>

      {contacto && <ContactoModal onClose={() => setContacto(false)} />}
    </>
  );
}

/**
 * Enlace que sale del sitio.
 *
 * `rel="noopener"` no es opcional al abrir en otra pestaña: sin él la página de
 * destino recibe una referencia a esta por `window.opener` y puede cambiarle la
 * dirección. `noreferrer` va con él para no filtrar de dónde vino la visita.
 */
function Externo({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-200 underline underline-offset-4 hover:text-white"
    >
      {children}
    </a>
  );
}

/**
 * Contacto con el desarrollador. Es un `mailto:`, no un formulario: un formulario
 * pide endpoint, antispam y una casilla que alguien tiene que mirar, para terminar
 * mandando el mismo correo. El botón de copiar está porque en escritorio el
 * `mailto:` cae en un cliente de correo que mucha gente no tiene configurado.
 */
function ContactoModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();

  return (
    <Modal title="Contacto" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-white/80">
          El sitio lo hace y lo mantiene <strong className="text-white">Pa7r1</strong>. Si
          encontraste un error, querés sumar un circuito o falta algo de un lugar que conocés,
          escribime y lo vemos.
        </p>

        <a
          href={`mailto:${CONTACTO}`}
          className="tarjeta block rounded-xl px-4 py-3 text-center text-sm font-semibold break-all text-brand-200 transition-colors hover:text-white"
        >
          {CONTACTO}
        </a>

        <Button
          variante="secondary"
          ancho
          onClick={() => {
            void navigator.clipboard
              .writeText(CONTACTO)
              .then(() => toast('Dirección copiada', 'success'))
              .catch(() => toast('No pudimos copiarla. Tocá la dirección para escribirnos.'));
          }}
        >
          Copiar dirección
        </Button>

        {/* los otros dos canales van juntos y en segundo plano: quien abre esto
            viene a avisar de un circuito, no a ver quién lo hizo */}
        <p className="text-sm text-white/60">
          También me encontrás en <Externo href="https://github.com/Pa7r1">GitHub</Externo> y en{' '}
          <Externo href="https://www.makkem.com">Makem</Externo>, donde trabajo como freelance.
        </p>
      </div>
    </Modal>
  );
}
