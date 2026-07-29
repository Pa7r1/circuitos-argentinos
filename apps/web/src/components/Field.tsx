import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

/**
 * Campo de formulario con etiqueta, ayuda y error. El error va pegado al campo
 * y no solo en un toast: si el aviso vive lejos del control, la persona no sabe
 * qué corregir.
 */
const CONTROL =
  'min-h-11 w-full rounded-lg border bg-white px-3 py-2.5 text-base transition-colors placeholder:text-stone-400';

const borde = (error?: string) =>
  error ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-brand-600';

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
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-stone-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={`${id}-ayuda`} className="mt-1 text-xs text-stone-500">
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
      className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 transition-colors duration-[var(--duracion-rapida)] hover:bg-stone-100 hover:text-stone-800"
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
