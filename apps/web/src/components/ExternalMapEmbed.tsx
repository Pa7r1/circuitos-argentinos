import { resolveExternalMap } from '@circuitos/shared';

/**
 * Recorrido publicado en otra aplicación (Relive, Strava, Wikiloc…). Se muestra
 * embebido cuando el proveedor lo permite, y el enlace queda **siempre** visible
 * debajo: si el embed no carga, la persona igual llega al recorrido.
 */
export function ExternalMapEmbed({ url, className = '' }: { url: string; className?: string }) {
  const mapa = resolveExternalMap(url);
  if (!mapa) return null;

  return (
    <section className={className}>
      {mapa.embedUrl ? (
        /*
          `aspect-video` con tope de alto: el video de Relive es apaisado, pero sin
          el tope, en un monitor ancho la proporción 16:9 lo estira hasta ocupar
          pantallas enteras y hay que hacer scroll para ver qué había debajo.
          El `mx-auto` lo mantiene centrado cuando el tope recorta el ancho.
        */
        <div className="mx-auto max-h-[70vh] w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-card">
          <iframe
            src={mapa.embedUrl}
            title={`Recorrido del circuito en ${mapa.providerName}`}
            loading="lazy"
            // el contenido es de un tercero: sin acceso a la página que lo aloja
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            allowFullScreen
            className="block aspect-video max-h-[70vh] w-full border-0"
          />
        </div>
      ) : (
        <p className="tarjeta p-3 text-sm text-white/70">
          El recorrido está publicado en <strong className="text-white">{mapa.providerName}</strong>
          , que no permite mostrarlo acá dentro.
        </p>
      )}

      <a
        href={mapa.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-300 hover:text-brand-200"
      >
        Ver el recorrido en {mapa.providerName}
        <span aria-hidden="true">↗</span>
      </a>
    </section>
  );
}
