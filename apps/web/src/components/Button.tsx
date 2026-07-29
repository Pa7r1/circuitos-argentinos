import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Botón único de la app. Existe porque la misma cadena de clases estaba copiada
 * en una docena de lugares y cada copia se fue desviando un poco.
 *
 * `primary` es la acción que queremos que la persona haga, y va una sola por
 * pantalla: es la regla que hace que el naranja signifique algo.
 */
export type Variante = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

const VARIANTE: Record<Variante, string> = {
  /*
   * El fondo es brand-700 y no brand-600 por contraste medido, no por gusto:
   * blanco sobre el 600 (#0891b2) da 3,68:1 y WCAG AA pide 4,5:1 para texto normal
   * —y `text-sm`/`text-base` en negrita siguen siendo texto normal, porque "grande"
   * arranca en 18,66 px—. El 700 da 5,36:1. El cian claro queda para el aro de foco
   * y los detalles, donde el piso es 3:1 y sí lo cumple.
   *
   * Se oscurece al pasar por encima y al tocar: el gesto es hundir, y de paso cada
   * estado tiene más contraste que el anterior, no menos.
   */
  primary:
    'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-[0_1px_2px_rgb(22_78_99/.3),0_4px_12px_-2px_rgb(8_145_178/.3)]',
  secondary: 'border border-stone-300 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50',
  ghost: 'text-stone-700 hover:bg-stone-100',
  danger: 'text-red-700 hover:bg-red-50',
  success: 'bg-green-700 text-white hover:bg-green-800',
};

/** 44 px de alto mínimo en todos los tamaños: es el objetivo táctil accesible. */
const TAMANO = {
  sm: 'min-h-11 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
} as const;

/**
 * El `active:scale` es el acuse del toque. En un teléfono no hay `:hover`, así que
 * entre que la persona toca y la red contesta el botón no da ninguna señal de vida
 * y el reflejo es volver a tocar. Un 3 % de reducción alcanza: se percibe como
 * respuesta física sin llegar a leerse como animación.
 *
 * Va bajo `motion-safe:` en vez de confiar en la regla global de movimiento
 * reducido: ahí el gesto sería instantáneo pero seguiría ocurriendo, y quien pide
 * menos movimiento no debería ver saltar el botón.
 *
 * `scale` es una propiedad compositada: no dispara layout ni repintado.
 */
const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-[-0.01em] ' +
  'transition-[color,background-color,border-color,scale] duration-[var(--duracion-rapida)] ease-suave ' +
  'motion-safe:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';

interface Comun {
  variante?: Variante;
  tamano?: keyof typeof TAMANO;
  ancho?: boolean;
  children: ReactNode;
  className?: string;
}

function clases({ variante = 'secondary', tamano = 'md', ancho, className = '' }: Comun): string {
  return `${BASE} ${VARIANTE[variante]} ${TAMANO[tamano]} ${ancho ? 'w-full' : ''} ${className}`;
}

export function Button({
  variante,
  tamano,
  ancho,
  className,
  children,
  ...props
}: Comun & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={clases({ variante, tamano, ancho, className, children })} {...props}>
      {children}
    </button>
  );
}

/** Mismo aspecto que el botón, pero navega. */
export function ButtonLink({
  to,
  variante,
  tamano,
  ancho,
  className,
  children,
  ...props
}: Comun & { to: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const cls = clases({ variante, tamano, ancho, className, children });
  // los enlaces externos y los esquemas propios (geo:, https:) no pasan por el router
  return /^[a-z]+:/i.test(to) ? (
    <a href={to} className={cls} {...props}>
      {children}
    </a>
  ) : (
    <Link to={to} className={cls} {...props}>
      {children}
    </Link>
  );
}
