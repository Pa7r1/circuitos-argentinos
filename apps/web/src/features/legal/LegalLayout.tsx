import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Fecha de la última revisión de los dos textos. Cambiarla al editarlos. */
export const VIGENCIA = '14 de agosto de 2026';

export const CONTACTO = 'carpiop997@gmail.com';

/**
 * Marco común de Términos y Privacidad. Son dos páginas de texto y nada más: sin
 * markdown, sin CMS y sin librería, porque el contenido cambia una vez por año y
 * cualquier otra cosa sería infraestructura para mantener.
 */
export function LegalLayout({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link
        to="/"
        className="mb-6 inline-flex min-h-11 items-center text-sm text-white/60 underline-offset-4 hover:text-white hover:underline"
      >
        ← Volver al mapa
      </Link>

      <h1 className="titulo mb-1 text-2xl">{titulo}</h1>
      <p className="mb-8 text-sm text-white/50">Última actualización: {VIGENCIA}</p>

      {/*
        Los estilos van acá y no repetidos en cada párrafo: estas páginas son texto
        corrido y necesitan un ancho de línea y un interlineado propios, distintos
        de los de la interfaz.
      */}
      <div className="space-y-4 leading-relaxed text-white/80 [&_a]:text-brand-200 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_li]:mb-2 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_strong]:text-white [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>

      <p className="mt-10 border-t border-white/10 pt-5 text-sm text-white/50">
        Responsable: Patricio Carpio · Contacto:{' '}
        <a className="text-brand-200 underline underline-offset-4" href={`mailto:${CONTACTO}`}>
          {CONTACTO}
        </a>
      </p>

      <p className="mt-3 text-sm text-white/50">
        <Link to="/terminos" className="underline underline-offset-4 hover:text-white">
          Términos y condiciones
        </Link>
        {' · '}
        <Link to="/privacidad" className="underline underline-offset-4 hover:text-white">
          Política de privacidad
        </Link>
      </p>
    </main>
  );
}
