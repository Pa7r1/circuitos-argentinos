import { useState } from 'react';
import { resolveExternalMap } from '@circuitos/shared';

/**
 * Recorrido publicado en otra aplicación (Relive, Strava, Wikiloc…). Se muestra
 * embebido cuando el proveedor lo permite, y el enlace queda **siempre** visible
 * debajo: si el embed no carga, la persona igual llega al recorrido.
 */
export function ExternalMapEmbed({ url, className = '' }: { url: string; className?: string }) {
  const [cargado, setCargado] = useState(false);
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
        <div className="relative mx-auto max-h-[70vh] w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-card">
          <iframe
            src={mapa.embedUrl}
            title={`Recorrido del circuito en ${mapa.providerName}`}
            /*
              Sin `loading="lazy"`: este bloque está arriba de todo y siempre a la
              vista, así que diferirlo solo retrasa lo que la persona vino a ver.
              En las fotos, que están más abajo, el lazy sí corresponde.
            */
            onLoad={() => setCargado(true)}
            // el contenido es de un tercero: sin acceso a la página que lo aloja
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            allowFullScreen
            className="block aspect-video max-h-[70vh] w-full border-0"
          />

          {/*
            El recorrido es lo más pesado de la ficha y tarda bastante más que el
            texto. Sin esto quedaba un rectángulo negro del alto de la pantalla, que
            se lee como error y no como espera. El iframe se monta igual desde el
            principio —si no, no empezaría a cargar nunca— y esto va encima.

            `pointer-events-none` para no robarle el primer clic al reproductor
            durante el fundido de salida.
          */}
          {!cargado && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black">
              {/*
                El fondo va opaco y no con la clase `skeleton`, que es blanco con
                alfa: translúcido dejaba asomar el botón de play del reproductor a
                medio dibujar por detrás del texto. El pulso se toma del keyframe
                que ya usa `.skeleton`, para no inventar movimiento nuevo.
              */}
              <p className="animate-[pulse-soft_1.5s_ease-in-out_infinite] text-sm font-medium text-white/70">
                Cargando el recorrido en {mapa.providerName}…
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="tarjeta p-3 text-sm text-white/70">
          El recorrido está publicado en <strong className="text-white">{mapa.providerName}</strong>
          , que no permite mostrarlo acá dentro.
        </p>
      )}

      {/*
        El video es de UNA salida y la ficha es del circuito, así que sus cifras
        —distancia, tiempo, velocidad— no tienen por qué coincidir con las de acá.
        Sin esta línea, ver "43 km" en el video y "12,5 km" en la ficha se lee como
        que uno de los dos está mal.
      */}
      {mapa.embedUrl && (
        <p className="mt-2 text-sm text-white/55">
          El video es para ver por dónde va el recorrido. Los datos del circuito son los de esta
          ficha.
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
