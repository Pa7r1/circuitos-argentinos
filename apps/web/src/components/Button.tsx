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
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-card',
  secondary: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50',
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

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

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
