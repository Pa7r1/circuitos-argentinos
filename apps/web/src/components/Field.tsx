import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

/**
 * Campo de formulario con etiqueta, ayuda y error. El error va pegado al campo
 * y no solo en un toast: si el aviso vive lejos del control, la persona no sabe
 * qué corregir.
 */
/*
 * Campo de vidrio: un relleno de blanco al 8 % con un aro sutil. Al enfocarlo se
 * aclara y el aro se pone cian, así que el estado se ve sin leer nada.
 *
 * `text-base` (16 px) no es capricho: por debajo de eso, Safari en iPhone hace zoom
 * automático al tocar el campo y descoloca toda la pantalla.
 */
/* `scroll-mb-28` deja aire bajo el campo al enfocarlo: sin eso el navegador lo
   sube justo pegado al borde inferior, debajo de la barra fija del asistente. */
const CONTROL =
  'scroll-mb-28 min-h-11 w-full rounded-xl bg-white/8 px-3 py-2.5 text-base text-white ring-1 transition-[background-color,box-shadow] duration-[var(--duracion-rapida)] ease-suave placeholder:text-white/40 focus:bg-white/12 focus:outline-none';

const borde = (error?: string) =>
  error
    ? 'ring-red-400/70 focus:ring-2 focus:ring-red-400'
    : 'ring-white/12 focus:ring-2 focus:ring-brand-400';

function Envoltura({
  id,
  label,
  ayuda,
  error,
  children,
}: {
  id: string;
  label: string;
  ayuda?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-white/80">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-red-300">
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={`${id}-ayuda`} className="mt-1.5 text-xs text-white/55">
            {ayuda}
          </p>
        )
      )}
    </div>
  );
}

export function Field({
  label,
  ayuda,
  error,
  id,
  adorno,
  ...props
}: {
  label: string;
  ayuda?: ReactNode;
  error?: string;
  /** Control al final del campo (revelar contraseña, limpiar, unidad…). */
  adorno?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  const generado = useId();
  const campoId = id ?? generado;
  const input = (
    <input
      id={campoId}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${campoId}-error` : ayuda ? `${campoId}-ayuda` : undefined}
      className={`${CONTROL} ${borde(error)} ${adorno ? 'pr-12' : ''}`}
      {...props}
    />
  );
  return (
    <Envoltura id={campoId} label={label} ayuda={ayuda} error={error}>
      {adorno ? (
        // el adorno se apoya encima del input, no al lado: si fuera un hermano en
        // flex, el input dejaría de ocupar todo el ancho y el borde se partiría
        <div className="relative">
          {input}
          <div className="absolute inset-y-0 right-1 flex items-center">{adorno}</div>
        </div>
      ) : (
        input
      )}
    </Envoltura>
  );
}

/**
 * Botón de mostrar/ocultar contraseña.
 *
 * Existe porque escribir una contraseña a ciegas en un teclado de teléfono, con
 * mayúsculas y símbolos, es la causa más común de "mi contraseña no anda". El tipo
 * del input cambia pero el `autoComplete` no, así que el gestor de contraseñas del
 * navegador la sigue reconociendo y guardando.
 */
export function VerPassword({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={visible}
      aria-label={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
      title={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-white/60 transition-colors duration-[var(--duracion-rapida)] hover:bg-white/12 hover:text-white"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="3.2" />
        {/* la barra tachando el ojo aparece cuando la contraseña está a la vista:
            el ícono muestra lo que va a pasar si se toca, no el estado actual */}
        {visible && <path d="m4 20 16-16" />}
      </svg>
    </button>
  );
}

export function SelectField({
  label,
  ayuda,
  error,
  id,
  children,
  ...props
}: {
  label: string;
  ayuda?: ReactNode;
  error?: string;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const generado = useId();
  const campoId = id ?? generado;
  return (
    <Envoltura id={campoId} label={label} ayuda={ayuda} error={error}>
      <select id={campoId} className={`${CONTROL} ${borde(error)}`} {...props}>
        {children}
      </select>
    </Envoltura>
  );
}
