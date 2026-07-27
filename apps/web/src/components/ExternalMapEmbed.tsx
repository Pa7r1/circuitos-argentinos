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
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-200">
          <iframe
            src={mapa.embedUrl}
            title={`Recorrido del circuito en ${mapa.providerName}`}
            loading="lazy"
            // el contenido es de un tercero: sin acceso a la página que lo aloja
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            allowFullScreen
            className="block aspect-video w-full border-0"
          />
        </div>
      ) : (
        <p className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
          El recorrido está publicado en <strong className="text-stone-900">{mapa.providerName}</strong>
          , que no permite mostrarlo acá dentro.
        </p>
      )}

      <a
        href={mapa.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        Ver el recorrido en {mapa.providerName}
        <span aria-hidden="true">↗</span>
      </a>
    </section>
  );
}
