import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CONTACTO } from '../features/legal/LegalLayout';
import { BotonInstalar } from './BotonInstalar';
import { Button, ButtonLink } from './Button';
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
 * Sumá tu circuito · Términos · Privacidad · Contacto · Instalar.
 *
 * Existe porque los textos legales solo se alcanzaban desde el menú de cuenta, o
 * sea con sesión iniciada: quien todavía no se registró no tenía forma de leer lo
 * que se le pide aceptar.
 *
 * `accion` saca "Sumá tu circuito" de la fila. En el mapa esta fila se dibuja a
 * 10 px y al 70 % de blanco —es cromo, no interfaz—, así que la única acción del
 * pie, y la que hace crecer el sitio, quedaba tipografiada como letra chica legal e
 * indistinguible de "Privacidad". Ahí se pasa `accion={false}` y el botón lo coloca
 * `MapPage` con `BotonProponer`, porque quien sabe dónde cae respecto del mapa es
 * la página. En la ficha y en las legales sigue en la fila: no hay mapa que
 * estorbar y no hace falta destacarlo dos veces.
 */
export function PieSitio({
  className = '',
  accion = true,
}: {
  className?: string;
  accion?: boolean;
}) {
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
        {accion && (
          <Link to="/proponer" className={ENLACE}>
            Sumá tu circuito
          </Link>
        )}
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
 * "Sumá tu circuito" como acción y no como enlace legal.
 *
 * Reusa `ButtonLink` en vez de una cadena de clases nueva: es exactamente el caso
 * para el que existe, y así el relleno (`brand-700`, 5,36:1 con el blanco) y el
 * acuse de pulsación son los mismos que en el resto de la app. El relleno es opaco
 * a propósito: sobre el mapa, una superficie translúcida cambia de contraste según
 * la foto que tenga debajo —arenal claro contra sierra oscura—, y esto no puede
 * depender de dónde quedó el mapa. El aro negro al 25 % le recorta el borde cuando
 * el terreno de abajo es claro.
 *
 * El `+` va como SVG y no como carácter ni emoji, por lo mismo que los íconos del
 * mapa: hereda `currentColor` y se ve igual en todos los sistemas.
 */
export function BotonProponer({ className = '' }: { className?: string }) {
  return (
    <ButtonLink
      to="/proponer"
      variante="primary"
      tamano="sm"
      className={`ring-1 ring-black/25 ${className}`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M12 5.5v13M5.5 12h13" />
      </svg>
      Sumá tu circuito
    </ButtonLink>
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
