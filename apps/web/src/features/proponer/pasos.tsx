import type { ReactNode } from 'react';

/** Los cuatro tramos del asistente, en orden. */
export const PASOS = ['El recorrido', 'Dónde queda', 'Cómo es', 'Fotos y contacto'] as const;

/**
 * Barra de progreso del asistente.
 *
 * Muestra en qué paso se está y cuántos faltan: sin eso, un formulario partido en
 * pantallas se siente más largo que uno solo, porque no se ve el final.
 */
export function Progreso({ actual }: { actual: number }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-semibold tracking-[0.08em] text-white/55 uppercase">
        Paso {actual + 1} de {PASOS.length} · {PASOS[actual]}
      </p>
      <ol className="flex gap-1.5" aria-label="Progreso">
        {PASOS.map((paso, i) => (
          <li
            key={paso}
            aria-current={i === actual ? 'step' : undefined}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-[var(--duracion-media)] ease-suave ${
              i <= actual ? 'bg-brand-500' : 'bg-white/15'
            }`}
          >
            <span className="sr-only">
              {paso}
              {i < actual ? ' (completado)' : ''}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Una pantalla del asistente: título, una línea de contexto y los campos.
 *
 * La `key` del paso remonta el bloque, así que la animación de entrada se dispara
 * sola en cada avance sin un efecto que ponga una clase un tick después.
 */
export function Paso({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda: string;
  children: ReactNode;
}) {
  return (
    <section className="paso-entra tarjeta p-4 sm:p-5">
      <h2 className="titulo mb-1 text-xl">{titulo}</h2>
      <p className="mb-5 text-sm text-white/65">{ayuda}</p>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/**
 * Opciones que se ven todas de una y se tocan sin desplegar nada.
 *
 * Reemplaza al `<select>` donde hay pocas alternativas: en un teléfono, abrir la
 * lista del sistema para elegir entre tres es un paso de más.
 */
export function Opciones<T extends string>({
  label,
  valor,
  opciones,
  onChange,
}: {
  label: string;
  valor: T;
  opciones: readonly { valor: T; nombre: string }[];
  onChange: (valor: T) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-white/80">{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {opciones.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={valor === opcion.valor}
            onClick={() => onChange(opcion.valor)}
            className={`min-h-11 rounded-xl px-4 text-sm font-medium transition-[background-color,box-shadow] duration-[var(--duracion-rapida)] ease-suave ${
              valor === opcion.valor
                ? 'bg-brand-700 text-white shadow-card'
                : 'bg-white/8 text-white/70 ring-1 ring-white/12 hover:bg-white/14 hover:text-white'
            }`}
          >
            {opcion.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}
