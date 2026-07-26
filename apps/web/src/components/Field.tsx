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
  ...props
}: { label: string; ayuda?: ReactNode; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const generado = useId();
  const campoId = id ?? generado;
  return (
    <Envoltura id={campoId} label={label} ayuda={ayuda} error={error}>
      <input
        id={campoId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${campoId}-error` : ayuda ? `${campoId}-ayuda` : undefined}
        className={`${CONTROL} ${borde(error)}`}
        {...props}
      />
    </Envoltura>
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
